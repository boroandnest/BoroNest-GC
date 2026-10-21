// Ordered list of migrations. Append only; never edit an applied migration — add a new one.
import m001 from './001_scope_templates.js';

export const MIGRATIONS = [m001];
