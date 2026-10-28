import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../app.ts';
import { DIVISION_IDS } from '../generated/partition.ts';
import { HttpError } from '../lib/errors.ts';
import type { HubGateway } from '../lib/hub/gateway.ts';

const query = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  division: z.enum(DIVISION_IDS).optional(),
});

/* GET /api/audit?limit=50&division=hr: the newest lines of the audit log. Read by the Admin only, the same one who reads
   the app's own account journal (`acct_log`). The President does not. The log is written by the server alone. */
export function auditRoute(hub: HubGateway) {
  return new Hono<AppEnv>().get('/', async (c) => {
    const p = c.get('principal');
    if (!p.admin) throw new HttpError(403, 'forbidden');
    const q = query.safeParse(c.req.query());
    if (!q.success) throw new HttpError(400, 'invalid_input');
    return c.json({ rows: await hub.readAudit({ limit: q.data.limit, ...(q.data.division ? { division: q.data.division } : {}) }) });
  });
}
