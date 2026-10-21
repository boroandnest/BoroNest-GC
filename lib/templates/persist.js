// Writes instantiated lines to scope_lines (Decimal128 money), preserving identity on re-instantiation.
import { getCollection } from '../mongo.js';
import { toDecimal128, toDecimal128Exact } from '../money-storage.js';
import { instantiate } from './instantiate.js';
import { fromTemplateDoc } from './store.js';
import { logEvent } from '../access.js';
import { STAFF_ROLE } from '../auth.js';

const MONEY = ['unitCost', 'baseCost', 'tariffExposure', 'lineTotal'];
const EXACT = ['quantity', 'tariffPct'];

export function lineToDoc(line) {
  const doc = { ...line };
  for (const f of MONEY) doc[f] = toDecimal128(line[f]);
  for (const f of EXACT) doc[f] = toDecimal128Exact(line[f]);
  return doc;
}

export async function instantiateIntoProject({ project, templateDoc, inputs, startDate, user }) {
  const scope = await getCollection('scope_lines');
  const existing = await scope.find({ projectId: project.id, templateTaskKey: { $exists: true } }).toArray();
  const template = fromTemplateDoc(templateDoc);
  const { lines, removed, values } = instantiate({ template, inputs, projectId: project.id, startDate, existing });

  let inserted = 0, updated = 0;
  for (const line of lines) {
    const doc = lineToDoc(line);
    const prior = existing.find(e => e.id === line.id);
    if (prior) {
      const { id, status, createdAt, ...set } = doc; // never touch identity, status or creation time
      await scope.updateOne({ id, projectId: project.id }, { $set: set, $unset: { orphaned: '' } });
      updated++;
    } else {
      await scope.insertOne(doc);
      inserted++;
    }
  }
  // Tasks no longer in the template: delete only untouched lines; flag anything started or blocked.
  let deleted = 0, orphaned = 0;
  for (const r of removed) {
    const res = await scope.deleteOne({ id: r.id, status: 'not_started', $or: [{ openBlocks: { $exists: false } }, { openBlocks: { $size: 0 } }] });
    if (res.deletedCount) deleted++;
    else { await scope.updateOne({ id: r.id }, { $set: { orphaned: true } }); orphaned++; }
  }

  const estimate = {
    templateId: templateDoc.id,
    templateName: templateDoc.name,
    inputs: Object.fromEntries([...values].filter(([k]) => templateDoc.params.find(p => p.name === k && p.kind === 'input')).map(([k, v]) => [k, v.toString()])),
    startDate,
    instantiatedAt: new Date(),
    instantiatedBy: user.id
  };
  await (await getCollection('projects')).updateOne({ id: project.id }, { $set: { estimate } });
  await logEvent(project.id, user, STAFF_ROLE, 'scope_updated', { action: 'instantiate', templateId: templateDoc.id, inserted, updated, deleted, orphaned });
  return { inserted, updated, deleted, orphaned, estimate };
}
