import { HttpError } from '../api.js';
import { toTemplateDoc } from './store.js';

// Template validation errors become 422s that name the offending params / tasks.
export function saveable(body) {
  try {
    return toTemplateDoc(body);
  } catch (e) {
    if (e.code) throw new HttpError(422, e.message, { code: e.code, ...(e.meta || {}) });
    throw e;
  }
}
