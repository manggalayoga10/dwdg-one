/* Sign-in (security_auth, D2): e-mail and password for now (Google stays below, switched off in the sign-in screen), invite-only.
   Accounts are created by an Admin (scripts/database/seed-core-accounts.mjs); the Supabase "before user created" hook
   refuses any other sign-up. link_current_user() then connects the account to its person (or creates the waiting person
   from the invitation). Demo mode replaces all of this with the persona picker (decision M9). */
import { z } from 'zod';
import { supabase } from '@/lib/supabase/client';

const linked = z.object({ person: z.string(), created: z.boolean() });

export async function signInWithPassword(email: string, password: string) {
  const { error } = await supabase().auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (error) throw error;
  window.location.reload(); // the workspace loads once, for the person who is signed in; start that load again
}

export async function signInWithGoogle() {
  const { error } = await supabase().auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });
  if (error) throw error;
}

export async function signOutEverywhere() {
  await supabase().auth.signOut();
}

/** The person id linked to the signed-in account, or null when there is no session. */
export async function linkedPerson(): Promise<string | null> {
  const { data } = await supabase().auth.getSession();
  if (!data.session) return null;
  const res: { data: unknown; error: { message: string } | null } = await supabase().rpc('link_current_user');
  if (res.error) throw new Error(res.error.message);
  return linked.parse(res.data).person;
}
