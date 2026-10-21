// Nightly COI expiry sweep (PHASE2_EXECUTE T10). Idempotent: coi_notices has a unique
// (coiId, tier) index, so a second run the same day — or any later day — sends nothing new
// for a tier already handled.
//
// On expiry: lines assigned on the strength of this certificate are
//   - re-pointed to another compliant certificate the holder already has, else
//   - UNASSIGNED if they are future-dated (planned start after today and not started), else
//   - FLAGGED (coiLapsed) when work is in progress. We never halt in-progress work over a lapsed
//     certificate; the PM decides.
// Every action writes project_events.
import { getCollection } from '../mongo.js';
import { logEvent } from '../access.js';
import { addDays, today as todayIso } from '../dates.js';
import { expiryTier } from './tiers.js';
import { findCompliantCoi } from './gate.js';
import { sendCoiExpiryNotice } from '../email.js';

const SYSTEM = { id: 'system:coi-sweep', role: 'system' };

export async function runCoiSweep({ today = todayIso(), send = sendCoiExpiryNotice } = {}) {
  const cois = await getCollection('cois');
  const notices = await getCollection('coi_notices');
  const users = await getCollection('users');
  const projects = await getCollection('projects');
  const scope = await getCollection('scope_lines');
  const summary = { checked: 0, notices: 0, skippedDuplicates: 0, unassigned: 0, flagged: 0, repointed: 0 };

  const due = await cois.find({ status: 'verified', expiresOn: { $lte: addDays(today, 30) } }).toArray();
  for (const coi of due) {
    summary.checked++;
    const { tier, daysOut } = expiryTier(coi.expiresOn, today);
    if (!tier) continue;
    // Superseded: the holder already has a later verified certificate for this project.
    const newer = await cois.findOne({ projectId: coi.projectId, holderId: coi.holderId, status: 'verified', expiresOn: { $gt: coi.expiresOn } });
    if (newer && tier !== 'expired') continue;

    try {
      await notices.insertOne({ coiId: coi.id, tier, projectId: coi.projectId, holderId: coi.holderId, sentOn: today, at: new Date() });
    } catch (e) {
      if (e.code === 11000) { summary.skippedDuplicates++; continue; }
      throw e;
    }

    const project = await projects.findOne({ id: coi.projectId });
    const holder = await users.findOne({ id: coi.holderId });
    const staff = [process.env.ADMIN_EMAIL || 'admin@boroandnestnyc.com'];
    const to = new Set([holder?.email, ...staff]);
    if (tier !== 'day30' && project?.pmEmail) to.add(project.pmEmail);
    if (tier === 'expired' && project?.clientEmail) to.add(project.clientEmail);
    const recipients = [...to].filter(Boolean);
    const sent = await send({ to: recipients, tier, daysOut, holderName: holder?.company || holder?.name || 'Subcontractor', projectName: project?.name || '', expiresOn: coi.expiresOn }).catch(e => ({ error: e.message }));
    await notices.updateOne({ coiId: coi.id, tier }, { $set: { recipients, emailId: sent?.id || null, emailSkipped: !!sent?.skipped, emailError: sent?.error || null } });
    await logEvent(coi.projectId, SYSTEM, 'system', 'coi_expiry_notice', { coiId: coi.id, tier, daysOut, recipients: recipients.length });
    summary.notices++;

    if (tier !== 'expired' || !project) continue;
    const building = project.buildingId ? await (await getCollection('buildings')).findOne({ id: project.buildingId }) : null;
    const lines = await scope.find({ projectId: project.id, assignedSub: coi.holderId, assignedCoiId: coi.id }).toArray();
    for (const line of lines) {
      if (building) {
        const replacement = await findCompliantCoi({ project, building, holderId: coi.holderId, workDate: line.plannedStart || today, asOf: today });
        if (replacement.coi) {
          await scope.updateOne({ id: line.id }, { $set: { assignedCoiId: replacement.coi.id } });
          await logEvent(project.id, SYSTEM, 'system', 'coi_replaced', { lineId: line.id, from: coi.id, to: replacement.coi.id });
          summary.repointed++;
          continue;
        }
      }
      const futureDated = line.plannedStart && line.plannedStart > today && ['not_started', 'paused', undefined].includes(line.status);
      if (futureDated) {
        await scope.updateOne({ id: line.id }, { $set: { assignedSub: null, unassignedReason: 'coi_expired', unassignedAt: new Date() }, $unset: { assignedCoiId: '' } });
        await logEvent(project.id, SYSTEM, 'system', 'coi_lapsed_unassigned', { lineId: line.id, coiId: coi.id, plannedStart: line.plannedStart });
        summary.unassigned++;
      } else {
        await scope.updateOne({ id: line.id }, { $set: { coiLapsed: true, coiLapsedAt: new Date() } });
        await logEvent(project.id, SYSTEM, 'system', 'coi_lapsed_in_progress', { lineId: line.id, coiId: coi.id, status: line.status });
        summary.flagged++;
      }
    }
  }
  return summary;
}
