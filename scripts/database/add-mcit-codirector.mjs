// Adds a Co-director of Marketing, Communication & IT to the hub, or updates one that is already there (set the sub-team or
// the e-mail later). With an e-mail the person also gets a sign-in (confirmed, random password written to
// scripts/.env.core-passwords.local, git-ignored); without one they exist as a person and cannot sign in yet.
// Dry run unless --apply.
//
//   node --env-file=scripts/.env.local scripts/database/add-mcit-codirector.mjs --name "Nama Lengkap" --team creative|comms|it [--email a@b.c] [--apply]
//   node --env-file=scripts/.env.local scripts/database/add-mcit-codirector.mjs --id cd-nama-lengkap --email a@b.c --apply
import { randomInt } from 'node:crypto'
import { appendFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const args = process.argv.slice(2)
const opt = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined)
const apply = args.includes('--apply')
const TEAMS = ['creative', 'comms', 'it']

const name = opt('--name')
const team = opt('--team')
const email = opt('--email')?.trim().toLowerCase()
const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const id = opt('--id') ?? (name ? `cd-${slug(name)}` : undefined)
if (!id) throw new Error('Give --name (new person) or --id (existing person).')
if (team !== undefined && !TEAMS.includes(team)) throw new Error(`--team is one of ${TEAMS.join(', ')}.`)

const url = process.env.SUPABASE_URL_HUB
const key = process.env.SUPABASE_SERVICE_KEY_HUB
if (!url || !key) throw new Error('Set SUPABASE_URL_HUB and SUPABASE_SERVICE_KEY_HUB (scripts/.env.local).')
const hub = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

const ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const password = () => Array.from({ length: 20 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')

const { data: existing, error: readError } = await hub.from('people').select('id, pos, doc, email, auth_user_id').eq('id', id).maybeSingle()
if (readError) throw readError
if (!existing && !name) throw new Error(`No person ${id}. Give --name to create one.`)
if (existing && existing.doc.div !== 'mcit') throw new Error(`${id} is not in MCIT (division ${existing.doc.div}). Nothing changed.`)

const doc = existing
  ? { ...existing.doc, ...(team ? { team } : {}) }
  : {
      id, name, first: name.split(' ')[0], div: 'mcit', role: 'codirector', admin: false, board: false, status: 'active',
      title: '', photo: null, hasSchedule: true, gcal: false, joined: new Date().toISOString().slice(0, 10), linkedin: null, phone: null,
      hidePhone: false, ...(team ? { team } : {}),
    }
console.log(`${existing ? 'update' : 'create'}  ${id}  ${doc.name}  codirector / mcit / team=${doc.team ?? '(none yet)'}  email=${email ?? existing?.email ?? '(none yet)'}`)
if (!apply) { console.log('\nDry run. Add --apply to write.'); process.exit(0) }

let userId = existing?.auth_user_id ?? null
if (email && !userId) {
  const pw = password()
  const { data, error } = await hub.auth.admin.createUser({ email, password: pw, email_confirm: true })
  if (error) throw error
  userId = data.user.id
  appendFileSync(new URL('../.env.core-passwords.local', import.meta.url), `${email}\t${pw}\n`, { mode: 0o600 })
  console.log('sign-in created; the password is in scripts/.env.core-passwords.local')
}

if (existing) {
  const { error } = await hub.from('people').update({ doc, ...(email ? { email } : {}), ...(userId ? { auth_user_id: userId } : {}) }).eq('id', id)
  if (error) throw error
} else {
  const { count } = await hub.from('people').select('id', { count: 'exact', head: true })
  const { error } = await hub.from('people').insert({ id, pos: (count ?? 0) + 1, doc, ...(email ? { email } : {}), ...(userId ? { auth_user_id: userId } : {}) })
  if (error) throw error
}
console.log('done')
