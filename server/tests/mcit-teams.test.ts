/* Marketing, Communication & IT: a Co-director changes only the records their sub-team is named on (doc.teams). */
import { describe, expect, it } from 'vitest';
import { mayRead, mayUpsert, policyFor } from '../src/lib/policy/index.ts';
import { principalOf } from './parity/pg.ts';

const lookup = () => undefined;
const doc = (teams?: string[]) => ({ id: 'ct1', ...(teams ? { teams } : {}) });
const found = policyFor('mcit_content');
if (!found) throw new Error('mcit_content has no rule');
const policy = found;

async function canWrite(person: string, teams?: string[]): Promise<boolean> {
  const p = await principalOf(person);
  return mayUpsert(policy, p, { id: 'ct1', doc: doc(teams) }, { id: 'ct1', doc: doc(teams) }, lookup);
}

describe('mcit_content by sub-team', () => {
  it('lets each Co-director change records that name their sub-team, and no others', async () => {
    expect(await canWrite('cod_cre', ['creative'])).toBe(true);
    expect(await canWrite('cod_cre', ['creative', 'comms'])).toBe(true);
    expect(await canWrite('cod_cre', ['comms'])).toBe(false);
    expect(await canWrite('cod_com', ['comms'])).toBe(true);
    expect(await canWrite('cod_com', ['it'])).toBe(false);
    expect(await canWrite('cod_it', ['it'])).toBe(true);
    expect(await canWrite('cod_it', ['creative'])).toBe(false);
  });

  it('keeps a Co-director out of records no sub-team is named on, and one with no sub-team out of everything', async () => {
    expect(await canWrite('cod_cre')).toBe(false);
    expect(await canWrite('cod_cre', [])).toBe(false);
    expect(await canWrite('cod_mcit', ['creative'])).toBe(false);
  });

  it('lets the Director, the President, the VP and the Admin change every record, and the Member keeps the division rights', async () => {
    for (const who of ['dir_mcit', 'pres', 'vpx', 'adm', 'mem_mcit']) {
      expect(await canWrite(who, ['it']), who).toBe(true);
      expect(await canWrite(who), who).toBe(true);
    }
  });

  it('lets a Co-director read everything in the division, so Communications can follow Creative', async () => {
    const p = await principalOf('cod_com');
    expect(mayRead(policy, p, { id: 'ct1', doc: doc(['creative']) }, lookup)).toBe(true);
  });
});
