-- Patch 2026-10-28 for a hub project that was set up before this change. Safe to run more than once.
-- Why: (1) adding an entry at the top of a list (a new to-do also adds an activity entry) moves every other entry down by one,
-- and the save was refused (403) because the person may not edit other people's entries. A record that is identical and only
-- changed its place in the list now needs just the right to read it. (2) Creating a project was refused for everyone below
-- Admin: "insert ... on conflict do update" also checks the select policy on the new row, and that policy looked the project
-- up in its own table, where the row does not exist yet. The select policy of projects now reads the row's own values.
-- Changing a record is still checked by the policies.

-- move_rows: changes only pos, only of the records in ids (the ones the caller could read) and only when the record
-- sent is identical to the stored one. Runs as its owner so a list can be re-ordered around records the caller may not edit.
-- The app schema is not exposed through the API, so it can be reached only from apply_rows.
create or replace function app.move_rows(t text, rws json, ids text[]) returns integer language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  execute format(
    'update public.%I x set pos = coalesce((r->>''pos'')::integer, 0) from json_array_elements($1) r '
    'where x.id = r->>''id'' and x.id = any ($2) and x.doc::text = (r->''doc'')::text '
    'and x.pos is distinct from coalesce((r->>''pos'')::integer, 0)', t) using rws, ids;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function app.move_rows(text, json, text[]) from public, anon;
grant execute on function app.move_rows(text, json, text[]) to authenticated, service_role;

create or replace function app.apply_rows(p json) returns json language plpgsql set search_path = '' as $$
declare
  allowed text[] := array['people', 'tasks', 'offers', 'projects', 'milestones', 'blockers', 'decisions', 'meetings', 'unavailable', 'gbusy', 'resources', 'updates', 'changes', 'programs', 'routines', 'pins', 'acct_invites', 'acct_grants', 'acct_memberships', 'acct_actions', 'acct_handovers', 'acct_log', 'acct_hidden', 'perf_escalations', 'store_values'];
  t text;
  spec json;
  ids text[];
  left_over integer;
  res jsonb := '{}'::jsonb;
  up integer;
  del integer;
begin
  for t, spec in select key, value from json_each(p) loop
    if not (t = any (allowed)) then raise exception 'Unknown table %', t using errcode = '22023'; end if;
    up := 0; del := 0;
    if spec->'delete' is not null and json_typeof(spec->'delete') = 'array' then
      select coalesce(array_agg(x), '{}') into ids from json_array_elements_text(spec->'delete') x;
      execute format('delete from public.%I where id = any ($1)', t) using ids;
      get diagnostics del = row_count;
      -- Rows that are visible but were not deleted were refused by a policy: report it instead of silently keeping them.
      execute format('select count(*) from public.%I where id = any ($1)', t) into left_over using ids;
      if left_over > 0 then raise exception 'Not allowed to delete % row(s) of %', left_over, t using errcode = '42501'; end if;
    end if;
    if spec->'upsert' is not null and json_typeof(spec->'upsert') = 'array' then
      -- A record that is new or whose content changed goes through the table's policies.
      execute format(
        'insert into public.%I as x (id, pos, doc) select r->>''id'', coalesce((r->>''pos'')::integer, 0), r->''doc'' from json_array_elements($1) r '
        'on conflict (id) do update set pos = excluded.pos, doc = excluded.doc '
        'where x.doc::text is distinct from excluded.doc::text', t) using spec->'upsert';
      get diagnostics up = row_count;
      -- A record whose content is identical and only its place in the list moved (a new entry at the top of a feed pushes every
      -- other entry down by one) needs no right to change the record: whoever can read it may move it.
      execute format('select coalesce(array_agg(id), ''{}'') from public.%I where id in (select r->>''id'' from json_array_elements($1) r)', t)
        into ids using spec->'upsert';
      up := up + app.move_rows(t, spec->'upsert', ids);
    end if;
    res := res || jsonb_build_object(t, jsonb_build_object('upserted', up, 'deleted', del));
  end loop;
  return res::json;
end $$;

-- The same rule for a project row that is being checked as it is saved: the projects table's own select policy gets the row's
-- own values, because a policy that looked the row up in the table could not see a row its statement is still inserting
-- ("insert ... on conflict do update" checks the select policy on the new row, so creating a project was refused).
create or replace function app.can_see_project_row(pid text, p_org boolean, p_div text, p_lead text, p_pm text, p_doc json) returns boolean language plpgsql stable security definer set search_path = '' as $$
declare me text := app.me_id();
begin
  if not app.me_active() then return false; end if;
  return coalesce(p_org, false) or app.sees_div(p_div) or p_lead = me or p_pm = me
    or exists (select 1 from json_array_elements(coalesce(p_doc->'team', '[]'::json)) x
               where x->>'id' = me and coalesce(x->>'state', '') <> 'declined')
    or exists (select 1 from json_array_elements(coalesce(p_doc->'team', '[]'::json)) x
               join public.people pp on pp.id = x->>'id'
               where x->>'state' = 'joined' and pp.div is distinct from p_div and app.sees_div(pp.div))
    or exists (select 1 from public.tasks t where t.project = pid and t.owner = me and not coalesce(t.trashed, false));
end $$;

drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects for select to authenticated using (app.me_active() and (app.can_see_project_row(id, org, div, lead, pm, doc)));
