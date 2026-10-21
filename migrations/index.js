// Ordered list of migrations. Append only; never edit an applied migration — add a new one.
import m001 from './001_scope_templates.js';
import m002 from './002_change_orders.js';

export const MIGRATIONS = [m001, m002];
