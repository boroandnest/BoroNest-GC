// Building requirements (P1 shape) + attaching a building/unit to a project.
import { v4 as uuid } from 'uuid';
import { getCollection } from '../mongo.js';
import { HttpError } from '../api.js';
import { round2 } from '../money.js';
import { toDecimal128 } from '../money-storage.js';
import { resolveAI, CoiError, AI_TOKENS } from './compliance.js';

const list = (v) => (Array.isArray(v) ? v : String(v || '').split('\n')).map(s => String(s).trim()).filter(Boolean).slice(0, 50);
const s = (v, n = 300) => String(v ?? '').trim().slice(0, n);

export function buildingFields(body) {
  const tokens = list(body.requiredAiTokens);
  for (const t of tokens) for (const [, k] of t.matchAll(/\{(\w+)\}/g)) {
    if (!AI_TOKENS.includes(k)) throw new HttpError(422, `Unknown token {${k}}. Allowed: ${AI_TOKENS.map(x => `{${x}}`).join(', ')}`);
  }
  const lead = body.coiLeadDays === undefined || body.coiLeadDays === '' ? 4 : Math.max(0, Math.trunc(+body.coiLeadDays));
  if (Number.isNaN(lead)) throw new HttpError(422, 'coiLeadDays must be a whole number');
  const out = {
    name: s(body.name, 200),
    address: s(body.address),
    managingAgent: s(body.managingAgent, 200),
    certHolderName: s(body.certHolderName, 200),
    certHolderCo: s(body.certHolderCo, 200),
    certHolderAddr: s(body.certHolderAddr),
    requiredAiStatic: list(body.requiredAiStatic),
    requiredAiTokens: tokens,
    coiLeadDays: lead,
    coiLeadIsBusinessDays: body.coiLeadIsBusinessDays !== false && body.coiLeadIsBusinessDays !== 'false',
    coiRecipients: list(body.coiRecipients),
    requiredGl: toDecimal128(round2(body.requiredGl || 0)),
    requiresWc: body.requiresWc === true || body.requiresWc === 'true',
    requiredAuto: toDecimal128(round2(body.requiredAuto || 0)),
    requiredEl: toDecimal128(round2(body.requiredEl || 0))
  };
  if (!out.name) throw new HttpError(422, 'Building needs a name');
  return out;
}

export async function createBuilding(body, user) {
  const doc = { id: uuid(), ...buildingFields(body), createdAt: new Date(), createdBy: user.id };
  await (await getCollection('buildings')).insertOne(doc);
  return doc;
}

// Resolves the per-unit additional insured NOW (project creation / building attach). A missing
// resident name is a 422, never a blank line on a certificate request.
export async function attachBuilding({ projectId, buildingId, unit = {} }) {
  const projects = await getCollection('projects');
  if (!buildingId) {
    await projects.updateOne({ id: projectId }, { $unset: { buildingId: '', unitContext: '', requiredAi: '' } });
    return { requiredAi: [] };
  }
  const building = await (await getCollection('buildings')).findOne({ id: String(buildingId) });
  if (!building) throw new HttpError(422, 'Building not found');
  const unitContext = {
    unit: s(unit.unit, 20), resident_name: s(unit.resident_name, 120), resident_phone: s(unit.resident_phone, 40)
  };
  let requiredAi;
  try {
    requiredAi = resolveAI(building, unitContext);
  } catch (e) {
    if (e instanceof CoiError) throw new HttpError(422, e.code === 'missing_token_value' ? `This building requires ${e.detail.replace('_', ' ')} on every certificate — enter it before saving.` : e.message, { code: e.code, token: e.detail });
    throw e;
  }
  await projects.updateOne({ id: projectId }, { $set: { buildingId: building.id, unitContext, requiredAi } });
  return { requiredAi, building };
}

// What a sub needs to order the right certificate. Shared with the sub, client and staff.
export function requirementsView(building, project) {
  if (!building) return null;
  return {
    buildingName: building.name,
    certificateHolder: { name: building.certHolderName, careOf: building.certHolderCo, address: building.certHolderAddr },
    additionalInsured: project.requiredAi || [],
    leadDays: building.coiLeadDays,
    leadIsBusinessDays: building.coiLeadIsBusinessDays !== false,
    sendTo: building.coiRecipients || [],
    requiredGl: building.requiredGl?.toString(),
    requiresWc: !!building.requiresWc,
    requiredAuto: building.requiredAuto?.toString(),
    requiredEl: building.requiredEl?.toString()
  };
}
