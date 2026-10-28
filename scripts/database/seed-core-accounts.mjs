// Registers the division core-team Google accounts in the hub without anyone signing in.
// Creates each Supabase Auth user (confirmed, no password) and a people row linked to it, so the first
// Google sign-in lands on the right person, division and role. Dry run unless --apply.
//
//   node --env-file=scripts/.env.local scripts/database/seed-core-accounts.mjs [--apply]
//
// Needs SUPABASE_URL_HUB and SUPABASE_SERVICE_KEY_HUB (operator machine only). Safe to re-run: existing e-mails are skipped.
import { createClient } from '@supabase/supabase-js'

const apply = process.argv.includes('--apply')

// id, name, division (null = executive), role. Roles are a guess for shared accounts: change before --apply.
const ACCOUNTS = [
  { id: 'acct-ee',   name: 'External Engagement', div: 'ee',   role: 'director', email: 'dwdguiiexternalengagement@gmail.com' },
  { id: 'acct-mcit',  name: 'Marketing Communication & IT', div: 'mcit', role: 'director', email: 'dwdgmarcomit@gmail.com' },
  { id: 'acct-hr',  name: 'Human Resources',     div: 'hr',   role: 'director', email: 'hrddwdguii@gmail.com' },
  { id: 'acct-cons', name: 'Consulting',          div: 'cons', role: 'director', email: 'dwdguii.consulting@gmail.com' },
  { id: 'acct-sng',  name: 'Strategy & Growth',   div: 'sng',  role: 'director', email: 'sngdwdguii@gmail.com' },
  { id: 'acct-fnl',  name: 'Finance & Legal',     div: 'fnl',  role: 'director', email: 'legalandfinancedwdg@gmail.com' },
  { id: 'acct-exec', name: 'Executive',           div: null,   role: 'president', email: 'executivedwdguii@gmail.com' },
]

const url = process.env.SUPABASE_URL_HUB
const key = process.env.SUPABASE_SERVICE_KEY_HUB
if (!url || !key) throw new Error('Set SUPABASE_URL_HUB and SUPABASE_SERVICE_KEY_HUB (scripts/.env.local).')

const hub = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

const { data: existing, error: listError } = await hub.from('people').select('id, email')
if (listError) throw listError
const taken = new Set(existing.map((p) => p.email))
let pos = existing.length

for (const a of ACCOUNTS) {
  if (taken.has(a.email)) { console.log(`skip   ${a.email} (already a person)`); continue }
  if (!apply) { console.log(`would  ${a.email} -> ${a.div ?? 'executive'} / ${a.role}`); continue }

  const { data: created, error: userError } = await hub.auth.admin.createUser({ email: a.email, email_confirm: true })
  let userId = created?.user?.id
  if (userError) {
    const { data: page } = await hub.auth.admin.listUsers({ perPage: 1000 })
    userId = page?.users.find((u) => u.email === a.email)?.id
    if (!userId) { console.log(`FAIL   ${a.email}: ${userError.message}`); continue }
  }

  const doc = {
    id: a.id, name: a.name, first: a.name.split(' ')[0], div: a.div, role: a.role, admin: false, board: false,
    status: 'active', title: '', photo: null, hasSchedule: true, gcal: false,
    joined: new Date().toISOString().slice(0, 10), linkedin: null, phone: null, hidePhone: false,
  }
  const { error } = await hub.from('people').insert({ id: a.id, pos: ++pos, doc, email: a.email, auth_user_id: userId })
  console.log(error ? `FAIL   ${a.email}: ${error.message}` : `ok     ${a.email} -> ${userId}`)
}
if (!apply) console.log('\nDry run. Add --apply to write.')
