/* Marketing, Communication & IT. database/schema/schema-spec.mjs, section "Marketing Communication & IT". Unlike the other
   divisions the Board may READ here (the prototype's mcFull); it still cannot write (nobody who cannot write can). */
import type { Principal } from '../auth/principal.ts';
import { isMe, seesDiv, unitLead } from '../auth/rules.ts';
import { text, type Doc } from './doc.ts';
import { jsonbHas } from './helpers.ts';
import type { TablePolicy } from './types.ts';

/** `sees('mcit') or app.is_board()` */
const mcFull = (p: Principal): boolean => seesDiv(p, 'mcit') || p.board;
const sees = (p: Principal): boolean => seesDiv(p, 'mcit');

/* schema-spec.mjs `mcWrite`: `sees('mcit') and (rank() >= 3 or me_role() is distinct from 'codirector' or has('teams', me_team()))`.
   A Co-director changes only the records their sub-team is named on; the Director, President, VP and Admin change all; a
   Member keeps the division's rights. */
const mcWrite = (p: Principal, doc: Doc): boolean =>
  sees(p) && (p.rank >= 3 || p.role !== 'codirector' || jsonbHas(doc.teams, p.team));

/** The people a request names: whoever asked, whoever made it, and the lead of the unit it is for. */
const involved = (p: Principal, doc: Doc): boolean =>
  isMe(p, text(doc, 'requester')) || isMe(p, text(doc, 'createdBy')) || unitLead(p, text(doc, 'unit'));

export const mcit_campaigns: TablePolicy = { read: (p) => mcFull(p), write: (p, r) => mcWrite(p, r.doc) };
export const mcit_content: TablePolicy = { read: (p) => mcFull(p), write: (p, r) => mcWrite(p, r.doc) };
export const mcit_briefs: TablePolicy = {
  read: (p, r) => mcFull(p) || involved(p, r.doc),
  write: (p, r) => mcWrite(p, r.doc) || involved(p, r.doc),
};
export const mcit_it: TablePolicy = {
  read: (p, r) => mcFull(p) || involved(p, r.doc),
  write: (p, r) => mcWrite(p, r.doc) || involved(p, r.doc),
};
export const mcit_accounts: TablePolicy = { read: (p) => mcFull(p), write: (p, r) => mcWrite(p, r.doc) };
