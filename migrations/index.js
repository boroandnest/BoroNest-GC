// Ordered list of migrations. Append only; never edit an applied migration — add a new one.
import m001 from './001_scope_templates.js';
import m002 from './002_change_orders.js';
import m003 from './003_coi.js';
import m004 from './004_coi_notices.js';
import m005 from './005_payments.js';
import m006 from './006_milestone_release.js';
import m007 from './007_ai_predictions.js';
import m008 from './008_violations.js';
import m009 from './009_retainers.js';

export const MIGRATIONS = [m001, m002, m003, m004, m005, m006, m007, m008, m009];
