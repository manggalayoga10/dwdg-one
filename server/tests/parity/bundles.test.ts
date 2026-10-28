/* The way the owner sets a project up: paste ONE file (a bundle) into a new, empty project, then run the smoke test that
   belongs to it. Both steps run here on a fresh PGlite database, exactly as that file would be run, so the instructions in the
   H0 checklist are known to work. The smoke tests end by raising an error if any check failed. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PGlite } from '@electric-sql/pglite';
import { afterEach, describe, expect, it } from 'vitest';
import { freshDb, read } from './pg.ts';

interface Bundles {
  BUNDLES: Record<string, string[]>;
  bundleText: (project: string) => string;
}
// @ts-expect-error a plain JavaScript module without type declarations
const bundles = (await import('../../../scripts/database/bundle-migrations.mjs')) as Bundles;

const open: PGlite[] = [];
afterEach(async () => {
  for (const db of open.splice(0)) await db.close();
});

/** A fresh database with the Supabase pieces the migrations lean on, and nothing else. */
async function empty(): Promise<PGlite> {
  const db = await freshDb([]);
  open.push(db);
  return db;
}

describe('a bundle is the project\'s migrations, in order, in one file', () => {
  it('lists the four hub migrations, and the base plus the division\'s own for each division', () => {
    expect(bundles.BUNDLES.hub?.map((f) => f.replace(/^.*\d{14}_/, ''))).toEqual(['hub_foundation.sql', 'hub_tables.sql', 'hub_load_and_save.sql', 'hub_registry.sql']);
    for (const slug of ['ee', 'mcit', 'hr', 'fnl', 'sng', 'cons']) {
      expect(bundles.BUNDLES[slug]?.map((f) => f.replace(/^.*\d{14}_/, ''))).toEqual(['spoke_base.sql', `${slug}_tables.sql`]);
    }
  });

  it('holds exactly the text of the migration files, none left out and none added', () => {
    const text = bundles.bundleText('hr');
    for (const f of bundles.BUNDLES.hr ?? []) expect(text).toContain(read(f).trimEnd());
    expect(text.split('\n').filter((l) => l.startsWith('-- spoke/')).length).toBe(2);
  });
});

describe('pasting a bundle into a new project, then its smoke test', () => {
  it('sets up the hub, and the hub passes its access-rule checks', async () => {
    const db = await empty();
    await db.exec(bundles.bundleText('hub'));
    await db.exec(readFileSync(join(import.meta.dirname, '../../../database/tests/rls_smoke_hub.sql'), 'utf8').replace(/\r\n/g, '\n')); // raises if a check fails
    expect(Number((await db.query<{ n: string }>(`select count(*) as n from public.divisions where not is_active`)).rows[0]?.n)).toBe(6);
  }, 120_000);

  it.each(['ee', 'mcit', 'hr', 'fnl', 'sng', 'cons'])('sets up the %s project, and it passes the division checks', async (slug) => {
    const db = await empty();
    await db.exec(bundles.bundleText(slug));
    await db.exec(readFileSync(join(import.meta.dirname, '../../../database/tests/spoke_smoke.sql'), 'utf8').replace(/\r\n/g, '\n'));
    expect((await db.query<{ version: number }>('select version from public.schema_meta')).rows[0]?.version).toBe(2);
  }, 60_000);

  /** The statements the H0 checklist gives for the very first administrator of a new hub. */
  const FIRST_ADMIN = `
    insert into private.bootstrap_settings (key, value) values ('first_admin_email', 'owner@example.org');
    insert into public.people (id, pos, doc, email) values (
      'owner', 0,
      '{"id":"owner","name":"Owner Name","first":"Owner","div":null,"role":"president","admin":true,"board":false,"status":"active","title":"","photo":null,"hasSchedule":true,"gcal":false,"joined":"2026-10-17","linkedin":null,"phone":null,"hidePhone":false}',
      'owner@example.org');`;

  it('lets the first administrator in: the sign-in hook admits them, their account links to their person, and they are an administrator', async () => {
    const db = await empty();
    await db.exec(bundles.bundleText('hub'));
    await db.exec(FIRST_ADMIN);
    expect((await db.query<{ r: Record<string, unknown> }>(`select private.before_user_created('{"user":{"email":"Owner@Example.org"}}'::jsonb) as r`)).rows[0]?.r).toEqual({});
    const uid = '11111111-1111-1111-1111-111111111111';
    await db.query("insert into auth.users (id, email) values ($1, 'owner@example.org')", [uid]);
    await db.exec(`begin; select set_config('request.jwt.claim.sub', '${uid}', true); select set_config('request.jwt.claims', '{"sub":"${uid}","email":"owner@example.org"}', true); set local role authenticated;`);
    const linked = (await db.query<{ r: { person: string; created: boolean } }>('select public.link_current_user() as r')).rows[0]?.r;
    const admin = (await db.query<{ a: boolean; r: string }>('select app.me_admin() as a, app.me_role() as r')).rows[0];
    await db.exec('rollback');
    expect(linked).toEqual({ person: 'owner', created: false });
    expect(admin).toEqual({ a: true, r: 'president' });
  }, 60_000);

  it('turns away a stranger: nobody invited, nobody known', async () => {
    const db = await empty();
    await db.exec(bundles.bundleText('hub'));
    await db.exec(FIRST_ADMIN);
    expect((await db.query<{ r: { error?: { http_code: number } } }>(`select private.before_user_created('{"user":{"email":"stranger@example.org"}}'::jsonb) as r`)).rows[0]?.r.error?.http_code).toBe(403);
  });

  it('lets a person move a record they cannot edit down a list, and still refuses to change it', async () => {
    const db = await empty();
    await db.exec(bundles.bundleText('hub'));
    const person = (id: string, uid: string) =>
      `insert into auth.users (id, email) values ('${uid}', '${id}@example.org');
       insert into public.people (id, pos, doc, email, auth_user_id) values ('${id}', 1,
         '{"id":"${id}","name":"${id}","first":"${id}","div":"ee","role":"member","admin":false,"board":false,"status":"active","title":"","photo":null,"hasSchedule":true,"gcal":false,"joined":"2026-10-01","linkedin":null,"phone":null,"hidePhone":false}',
         '${id}@example.org', '${uid}');`;
    await db.exec(person('pa', '11111111-1111-1111-1111-111111111111') + person('pb', '22222222-2222-2222-2222-222222222222'));
    const entry = { id: 'c1', ws: 'ee', actor: 'pa', verb: 'created task', target: { type: 'task', id: 't1', name: 'T' }, at: '2026-10-01T09:00', from: null, to: null };
    await db.query(`insert into public.changes (id, pos, doc) values ('c1', 0, $1)`, [JSON.stringify(entry)]);
    const asB = async (sql: string) => {
      await db.exec(`begin; select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true); select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","email":"pb@example.org"}', true); set local role authenticated;`);
      try {
        return await db.query<{ r: unknown }>(sql);
      } finally {
        await db.exec('rollback');
      }
    };
    const save = (doc: unknown) => `select public.apply_changes('${JSON.stringify({ changes: { upsert: [{ id: 'c1', pos: 5, doc }] } }).replace(/'/g, "''")}') as r`;

    // the same record, a new place in the list: allowed, although the actor is somebody else
    await db.exec(`begin; select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true); select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","email":"pb@example.org"}', true); set local role authenticated;`);
    const moved = (await db.query<{ r: { changes: { upserted: number } } }>(save(entry))).rows[0]?.r;
    await db.exec('commit');
    expect(moved?.changes.upserted).toBe(1);
    expect((await db.query<{ pos: number }>(`select pos from public.changes where id = 'c1'`)).rows[0]?.pos).toBe(5);

    // a changed record is still the table's business: only its actor (or an admin) may edit it
    await expect(asB(save({ ...entry, verb: 'something else' }))).rejects.toThrow();
  }, 90_000);

  it('lets a director create a project in their own division (the save is an insert with "on conflict do update")', async () => {
    const db = await empty();
    await db.exec(bundles.bundleText('hub'));
    const uid = '33333333-3333-3333-3333-333333333333';
    await db.exec(`insert into auth.users (id, email) values ('${uid}', 'dir@example.org');
      insert into public.people (id, pos, doc, email, auth_user_id) values ('dir', 1,
        '{"id":"dir","name":"dir","first":"dir","div":"ee","role":"director","admin":false,"board":false,"status":"active","title":"","photo":null,"hasSchedule":true,"gcal":false,"joined":"2026-10-01","linkedin":null,"phone":null,"hidePhone":false}',
        'dir@example.org', '${uid}');`);
    const project = { id: 'p1', div: 'ee', stage: 'planned', reason: '', team: [], org: false, createdBy: 'dir', createdAt: '2026-10-28T10:00', name: 'New project', goal: '', scopeIn: [], scopeOut: [], lead: null, pm: null, start: null, due: null };
    await db.exec(`begin; select set_config('request.jwt.claim.sub', '${uid}', true); select set_config('request.jwt.claims', '{"sub":"${uid}","email":"dir@example.org"}', true); set local role authenticated;`);
    const saved = (await db.query<{ r: { projects: { upserted: number } } }>(`select public.apply_changes('${JSON.stringify({ projects: { upsert: [{ id: 'p1', pos: 0, doc: project }] } })}') as r`)).rows[0]?.r;
    await db.exec('commit');
    expect(saved?.projects.upserted).toBe(1);
  }, 90_000);

  it('cannot be pasted twice: the second time fails instead of half-applying', async () => {
    const db = await empty();
    await db.exec(bundles.bundleText('sng'));
    await expect(db.exec(bundles.bundleText('sng'))).rejects.toThrow();
  });
});
