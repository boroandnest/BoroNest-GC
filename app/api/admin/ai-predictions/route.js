import { v4 as uuid } from 'uuid';
import { getCollection } from '@/lib/mongo';
import { route, json, readJson, requireStaff, HttpError } from '@/lib/api';
import { toDecimal128Exact } from '@/lib/money-storage';
import { toMoney } from '@/lib/money';
import { brierScore } from '@/lib/ai/calibration';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Staff only. GET ?agent= lists predictions + Brier score; POST records one (for Phase 3 agents).
export const GET = route(async ({ user, url }) => {
  requireStaff(user);
  const q = url.searchParams.get('agent') ? { agent: url.searchParams.get('agent') } : {};
  const list = await (await getCollection('ai_predictions')).find(q).sort({ createdAt: -1 }).limit(500).toArray();
  return json({ predictions: list, brierScore: brierScore(list)?.toString() ?? null });
});

export const POST = route(async ({ request, user }) => {
  requireStaff(user);
  const b = await readJson(request);
  let confidence;
  try { confidence = toMoney(b.confidence); } catch { throw new HttpError(422, 'confidence must be a number'); }
  if (confidence.lessThan(0) || confidence.greaterThan(1)) throw new HttpError(422, 'confidence must be between 0 and 1');
  const doc = {
    id: uuid(), agent: String(b.agent || ''), taskType: String(b.taskType || ''), projectId: b.projectId || null,
    confidence: toDecimal128Exact(confidence.toDecimalPlaces(3)), prediction: b.prediction, envelope: b.envelope,
    outcome: null, resolvedAt: null, resolvedBy: null, createdAt: new Date()
  };
  try {
    await (await getCollection('ai_predictions')).insertOne(doc);
  } catch (e) {
    if (e.code === 121) throw new HttpError(422, 'Prediction rejected: agent, taskType, prediction and envelope.rationale are required');
    throw e;
  }
  return json({ prediction: doc }, 201);
});
