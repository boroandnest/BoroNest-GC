import { getCollection } from '@/lib/mongo';
import { route, json, requireStaff } from '@/lib/api';
import { buildConsole, buildTrend, buildCalendar } from '@/lib/admin/console';
import { today as todayIso } from '@/lib/dates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Staff console rollup (T30). Staff only — there is no wider audience for this
// shape, so it is not projected per role: non-staff never reach it.
//
// Loads once and hands everything to the pure rollup, so the arithmetic is
// unit-tested rather than spread across a page.
export const GET = route(async ({ user, url }) => {
  requireStaff(user);

  const col = async (n) => await getCollection(n);
  const [projects, changeOrders, cois, buildings, violations, milestones, retainerPeriods, pendingUsers, scopingCalls] = await Promise.all([
    (await col('projects')).find({}).limit(500).toArray(),
    (await col('change_orders')).find({}).limit(2000).toArray(),
    (await col('cois')).find({}).limit(2000).toArray(),
    (await col('buildings')).find({}).limit(500).toArray(),
    (await col('violations')).find({}).limit(5000).toArray(),
    (await col('milestones')).find({}).limit(2000).toArray(),
    (await col('retainer_periods')).find({}).limit(1000).toArray(),
    (await col('users')).find({ status: 'pending' }, { projection: { id: 1, name: 1, email: 1, role: 1, company: 1, createdAt: 1 } }).limit(200).toArray(),
    (await col('scoping_calls')).find({}).limit(200).toArray()
  ]);

  const today = todayIso();
  return json({
    ...buildConsole({
      projects, changeOrders, cois, buildings, violations, milestones,
      retainerPeriods, pendingUsers, scopingCalls, today
    }),
    trend: buildTrend({ violations, today }),
    calendar: buildCalendar({ cois, violations, milestones, retainerPeriods, projects, today, month: url.searchParams.get('month') || today.slice(0, 7) })
  });
});
