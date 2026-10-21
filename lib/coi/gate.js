// The assignment gate: the ONLY way a subcontractor gets assigned to a scope line.
// On a project whose building has requirements on file, the sub needs a COI that is compliant
// today and was submitted inside the building's lead time for the line's start date.
import { getCollection } from '../mongo.js';
import { HttpError } from '../api.js';
import { logEvent } from '../access.js';
import { iso } from '../dates.js';
import { coiCompliant, coiSubmittedInTime, REASON_TEXT } from './compliance.js';

export async function findCompliantCoi({ project, building, holderId, workDate, asOf = iso(new Date()) }) {
  const cois = await (await getCollection('cois')).find({ projectId: project.id, holderId }).sort({ submittedAt: -1 }).toArray();
  if (!cois.length) return { coi: null, reasons: ['no_coi'] };
  let best = null;
  for (const coi of cois) {
    const r = coiCompliant(coi, building, project.requiredAi || [], asOf);
    const reasons = [...r.reasons];
    if (!coiSubmittedInTime(coi.submittedAt, workDate, building)) reasons.push('submitted_too_late');
    if (!reasons.length) return { coi, reasons: [] };
    if (!best || reasons.length < best.reasons.length) best = { coi, reasons, missingAi: r.missingAi };
  }
  return { coi: null, reasons: best.reasons, missingAi: best.missingAi };
}

export async function assignSubToLine({ project, lineId, subUserId, user, role }) {
  const scope = await getCollection('scope_lines');
  const line = await scope.findOne({ id: lineId, projectId: project.id });
  if (!line) throw new HttpError(404, 'Scope line not found');

  if (!subUserId) {
    await scope.updateOne({ id: lineId }, { $set: { assignedSub: null }, $unset: { assignedCoiId: '' } });
    await logEvent(project.id, user, role, 'sub_unassigned', { lineId });
    return { ...line, assignedSub: null };
  }

  const sub = await (await getCollection('users')).findOne({ id: String(subUserId) });
  if (!sub || sub.role !== 'subcontractor') throw new HttpError(422, 'Not a subcontractor');
  const party = await (await getCollection('project_parties')).findOne({ projectId: project.id, userEmail: sub.email, status: 'accepted' });
  if (!party) throw new HttpError(422, 'That subcontractor is not on this project');

  let assignedCoiId = 'not_required';
  const building = project.buildingId ? await (await getCollection('buildings')).findOne({ id: project.buildingId }) : null;
  if (building) {
    const workDate = line.plannedStart || iso(new Date());
    const found = await findCompliantCoi({ project, building, holderId: sub.id, workDate });
    if (!found.coi) {
      throw new HttpError(409, `${sub.company || sub.name || sub.email} cannot be assigned: ${found.reasons.map(r => REASON_TEXT[r] || r).join('; ')}.`, {
        code: 'coi_required', reasons: found.reasons, missingAi: found.missingAi || []
      });
    }
    assignedCoiId = found.coi.id;
  }
  await scope.updateOne({ id: lineId }, { $set: { assignedSub: sub.id, assignedSubName: sub.company || sub.name || '', assignedCoiId, assignedAt: new Date() } });
  await logEvent(project.id, user, role, 'sub_assigned', { lineId, subId: sub.id, coiId: assignedCoiId });
  return { ...line, assignedSub: sub.id, assignedCoiId };
}
