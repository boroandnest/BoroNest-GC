import { NextResponse } from 'next/server';
import { serialize } from './serialize.js';

export const j = (data, status = 200) => NextResponse.json(serialize(data), { status });
export const err = (message, status = 400) => NextResponse.json({ error: message }, { status });

export const ROLES = ['client', 'management', 'building-rep', 'expediter', 'subcontractor'];
export const ROLE_LABELS = {
  'client': 'Client',
  'management': 'Management Company',
  'building-rep': 'Building Rep',
  'expediter': 'Expediter',
  'subcontractor': 'Subcontractor',
  'bn_staff': 'Boro & Nest Staff'
};
