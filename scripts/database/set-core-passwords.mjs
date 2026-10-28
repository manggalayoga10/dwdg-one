// Gives every person that has an e-mail in the hub a fresh random password, so they can sign in with e-mail + password.
// Creates the Auth user (and links it) when the person has none yet, which is the case for the Admin. The passwords are
// written to scripts/.env.core-passwords.local (git-ignored), never to the console. Hand each one over privately and ask
// the holder to change it. Dry run unless --apply.
//
//   node --env-file=scripts/.env.local scripts/database/set-core-passwords.mjs [--apply] [email ...]
// With e-mails given, only those people get a new password and their lines are added to the file (the others keep theirs).
import { randomInt } from 'node:crypto'
import { appendFileSync, writeFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const apply = process.argv.includes('--apply')
const only = process.argv.slice(2).filter((a) => !a.startsWith('--')).map((a) => a.toLowerCase())
const OUT = new URL('../.env.core-passwords.local', import.meta.url)

const url = process.env.SUPABASE_URL_HUB
const key = process.env.SUPABASE_SERVICE_KEY_HUB
if (!url || !key) throw new Error('Set SUPABASE_URL_HUB and SUPABASE_SERVICE_KEY_HUB (scripts/.env.local).')
const hub = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

// No look-alike characters (0/O, 1/l/I) so a password can be read out loud or typed from a screenshot.
const ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const generate = () => Array.from({ length: 20 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')

const { data, error } = await hub.from('people').select('id, email, auth_user_id').not('email', 'is', null).order('pos')
if (error) throw error
const people = only.length ? data.filter((p) => only.includes(p.email)) : data

const lines = []
for (const p of people) {
  if (!apply) { console.log(`would  ${p.email}`); continue }
  const password = generate()
  let userId = p.auth_user_id
  if (userId) {
    const { error: e } = await hub.auth.admin.updateUserById(userId, { password, email_confirm: true })
    if (e) { console.log(`FAIL   ${p.email}: ${e.message}`); continue }
  } else {
    const { data: created, error: e } = await hub.auth.admin.createUser({ email: p.email, password, email_confirm: true })
    if (e) { console.log(`FAIL   ${p.email}: ${e.message}`); continue }
    userId = created.user.id
    const { error: linkError } = await hub.from('people').update({ auth_user_id: userId }).eq('id', p.id)
    if (linkError) { console.log(`FAIL   ${p.email}: created but not linked (${linkError.message})`); continue }
  }
  lines.push(`${p.email}\t${password}`)
  console.log(`ok     ${p.email}`)
}

if (!apply) console.log('\nDry run. Add --apply to write.')
else if (lines.length) {
  const text = lines.join('\n') + '\n'
  if (only.length) appendFileSync(OUT, text, { mode: 0o600 })
  else writeFileSync(OUT, text, { mode: 0o600 })
  console.log(`\nPasswords are in scripts/.env.core-passwords.local (git-ignored).`)
}
