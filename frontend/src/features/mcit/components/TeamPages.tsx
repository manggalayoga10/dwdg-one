/* The three sub-team spaces inside Marketing, Communication & IT: Creative (design production), Communications (plan, accounts,
   results, watching that Creative delivers) and IT (requests, products, digital assets). Each is a view of records MCIT already
   keeps, filtered to the sub-team; nothing here is stored except the results Communications types in. A Co-director changes
   only records that name their sub-team (mcWrite), the Director changes all, and everybody in MCIT can read all. */
import { useState } from 'react';
import { Link } from 'react-router';
import type { Route } from '@/app/router/routes';
import { useDivisionWorkspace } from '@/app/router/use-division-workspace';
import { Chip, DivCrumb } from '@/components/shared/division-ui';
import { Button } from '@/components/ui/Button';
import { inputClass } from '@/components/ui/forms';
import { SectionHeading } from '@/components/ui/Headings';
import { NotAvailable, Page, PageHeader } from '@/components/ui/page';
import { t } from '@/lib/i18n';
import { addDays, dShort, today } from '@/lib/time';
import { useMe, useWorkspace } from '@/lib/workspace/hooks';
import { Who } from '@/features/fnl/components/fnl-parts';
import { LinkRow, Tbl, Td, Th } from '@/features/fnl/components/fnl-table';
import type { Person, Workspace } from '@/types/workspace';
import { recordMetrics } from '../services/content';
import {
  CST,
  IT,
  MC,
  TEAM_LABEL,
  chName,
  mcFull,
  mcWrite,
  mcitOf,
  teamOfPerson,
  type ChannelId,
  type Content,
  type McitTeam,
} from '../services/mcit-data';

const Unavailable = () => (
  <Page>
    <NotAvailable />
  </Page>
);

const mkCrumb = (page: string, label: string) =>
  function TeamCrumb(_: { route: Route }) {
    return <DivCrumb d={MC} parts={[[page, t(label)]]} />;
  };
export const CreativeCrumb = mkCrumb('creative', 'Creative');
export const CommsCrumb = mkCrumb('communications', 'Communications');
export const ItTeamCrumb = mkCrumb('it-team', 'IT');

const DONE = new Set(['published', 'archived', 'cancelled']);
const empty = (text: string) => <p className="my-3 text-mute">{t(text)}</p>;

/** Content that belongs to a sub-team: it names the team, or the person executing it is in the team. */
const ofTeam = (db: Workspace, c: Content, team: McitTeam) =>
  !!c.teams?.includes(team) || teamOfPerson(db.people.find((p) => p.id === c.executor)) === team;

const contentRow = (c: Content) => (
  <LinkRow key={c.id} to={`content/${c.id}`}>
    <Td>
      <b>{c.title}</b>
      <small className="text-mute">{c.kind}</small>
    </Td>
    <Td>
      <Who id={c.executor} />
    </Td>
    <Td>{c.channels.map((ch) => chName(ch.ch)).join(', ')}</Td>
    <Td className="type-num">{c.due ? dShort(c.due) : '-'}</Td>
    <Td>
      <Chip def={CST[c.stage]} pill="pill" />
    </Td>
  </LinkRow>
);
const contentHead = (
  <>
    <Th>{t('Content')}</Th>
    <Th>{t('Executor')}</Th>
    <Th>{t('Channels')}</Th>
    <Th>{t('Due')}</Th>
    <Th>{t('State')}</Th>
  </>
);

const byDue = (a: Content, b: Content) => (a.due ?? '9999').localeCompare(b.due ?? '9999');

function useTeamPage(): { db: Workspace; m: Person | undefined; ok: boolean } {
  const db = useWorkspace((w) => w);
  const m = useMe();
  useDivisionWorkspace(MC);
  return { db, m, ok: mcFull(m) };
}

// ---------- Creative ----------
const FORMATS: [string, string][] = [
  ['Instagram feed', '1080 × 1350 px (4:5)'],
  ['Instagram story and reels', '1080 × 1920 px (9:16)'],
  ['LinkedIn post image', '1200 × 627 px'],
  ['Website banner', '1600 × 900 px'],
];

export function CreativePage() {
  const { db, ok } = useTeamPage();
  if (!ok) return <Unavailable />;
  const items = mcitOf(db).content.filter((c) => ofTeam(db, c, 'creative'));
  const open = items.filter((c) => !DONE.has(c.stage)).sort(byDue);
  const assets = items.flatMap((c) => c.assets.map((a) => ({ c, ...a })));
  return (
    <Page wide>
      <PageHeader
        title={t('Creative')}
        sub={t('Design work for posts, video and feeds: what is waiting for you, the files, and the sizes to export.')}
      />
      <SectionHeading count={open.length}>{t('Production queue')}</SectionHeading>
      {open.length ? <Tbl head={contentHead}>{open.map(contentRow)}</Tbl> : empty('Nothing in production right now.')}

      <SectionHeading count={assets.length}>{t('Asset library')}</SectionHeading>
      {assets.length ? (
        <ul className="my-2 grid gap-1.5">
          {assets.map((a, i) => (
            <li key={`${a.c.id}-${String(i)}`}>
              <a href={a.url} target="_blank" rel="noreferrer">
                {a.label || a.url}
              </a>{' '}
              <small className="text-mute">
                · <Link to={`/content/${a.c.id}`}>{a.c.title}</Link>
              </small>
            </li>
          ))}
        </ul>
      ) : (
        empty('No files linked to your content yet. Add a link on a content item.')
      )}

      <SectionHeading>{t('Export sizes')}</SectionHeading>
      <Tbl
        head={
          <>
            <Th>{t('Where')}</Th>
            <Th>{t('Size')}</Th>
          </>
        }
      >
        {FORMATS.map(([where, size]) => (
          <tr key={where}>
            <Td>{t(where)}</Td>
            <Td className="type-num">{size}</Td>
          </tr>
        ))}
      </Tbl>
    </Page>
  );
}

// ---------- Communications ----------
function Metrics({ c, ch, can }: { c: Content; ch: ChannelId; can: boolean }) {
  const pub = c.channels.find((x) => x.ch === ch)?.pub;
  const [reach, setReach] = useState(String(pub?.metrics?.reach ?? ''));
  const [eng, setEng] = useState(String(pub?.metrics?.engagement ?? ''));
  if (!can)
    return (
      <span className="type-num">
        {pub?.metrics ? (
          `${String(pub.metrics.reach)} / ${String(pub.metrics.engagement)}`
        ) : (
          <span className="text-mute">-</span>
        )}
      </span>
    );
  return (
    <form
      className="flex flex-wrap items-center gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        void recordMetrics(c.id, ch, Number(reach), Number(eng));
      }}
    >
      <input
        className={`${inputClass} w-24`}
        type="number"
        min={0}
        inputMode="numeric"
        aria-label={t('Reach')}
        placeholder={t('Reach')}
        value={reach}
        onChange={(e) => {
          setReach(e.target.value);
        }}
      />
      <input
        className={`${inputClass} w-24`}
        type="number"
        min={0}
        inputMode="numeric"
        aria-label={t('Engagement')}
        placeholder={t('Engagement')}
        value={eng}
        onChange={(e) => {
          setEng(e.target.value);
        }}
      />
      <Button type="submit" disabled={reach === '' || eng === ''}>
        {t('Save')}
      </Button>
    </form>
  );
}

export function CommsPage() {
  const { db, m, ok } = useTeamPage();
  if (!ok) return <Unavailable />;
  const s = mcitOf(db);
  const now = today();
  const horizon = addDays(now, 14);
  const plan = s.content
    .filter((c) => c.stage !== 'cancelled')
    .flatMap((c) =>
      c.channels
        .filter((x) => !x.pub && x.planned.slice(0, 10) >= now && x.planned.slice(0, 10) <= horizon)
        .map((x) => ({ c, x })),
    )
    .sort((a, b) => a.x.planned.localeCompare(b.x.planned));
  // Late: a planned publication whose date passed without a recorded post, or an internal due date passed with work not done.
  const late = s.content
    .filter((c) => !DONE.has(c.stage) && c.stage !== 'approved' && c.stage !== 'scheduled')
    .filter((c) => (c.due !== null && c.due < now) || c.channels.some((x) => !x.pub && x.planned.slice(0, 10) < now))
    .sort(byDue);
  const briefs = s.briefs.filter((b) => b.state === 'submitted');
  const published = s.content.flatMap((c) => c.channels.filter((x) => x.pub).map((x) => ({ c, ch: x.ch, pub: x.pub })));
  const perChannel = (['instagram', 'linkedin', 'website'] as const).map((ch) => {
    const rows = published.filter((p) => p.ch === ch && p.pub?.metrics);
    return {
      ch,
      posts: rows.length,
      reach: rows.reduce((n, p) => n + (p.pub?.metrics?.reach ?? 0), 0),
      engagement: rows.reduce((n, p) => n + (p.pub?.metrics?.engagement ?? 0), 0),
    };
  });
  return (
    <Page wide>
      <PageHeader
        title={t('Communications')}
        sub={t('The content plan, the social accounts, how posts did, and what Creative has not delivered yet.')}
      />
      <SectionHeading count={plan.length}>{t('Next 14 days')}</SectionHeading>
      {plan.length ? (
        <Tbl
          head={
            <>
              <Th>{t('When')}</Th>
              <Th>{t('Channel')}</Th>
              <Th>{t('Content')}</Th>
              <Th>{t('Executor')}</Th>
              <Th>{t('State')}</Th>
            </>
          }
        >
          {plan.map(({ c, x }) => (
            <LinkRow key={`${c.id}-${x.ch}`} to={`content/${c.id}`}>
              <Td className="type-num">
                {dShort(x.planned.slice(0, 10))} {x.planned.slice(11, 16)}
              </Td>
              <Td>{chName(x.ch)}</Td>
              <Td>
                <b>{c.title}</b>
              </Td>
              <Td>
                <Who id={c.executor} />
              </Td>
              <Td>
                <Chip def={CST[c.stage]} pill="pill" />
              </Td>
            </LinkRow>
          ))}
        </Tbl>
      ) : (
        empty('Nothing is planned for the next two weeks.')
      )}

      <SectionHeading count={late.length}>{t('Not delivered yet')}</SectionHeading>
      {late.length ? (
        <Tbl head={contentHead}>{late.map(contentRow)}</Tbl>
      ) : (
        empty('Everything planned so far has been delivered.')
      )}

      <SectionHeading count={briefs.length}>{t('Briefs waiting for an answer')}</SectionHeading>
      {briefs.length ? (
        <ul className="my-2 grid gap-1.5">
          {briefs.map((b) => (
            <li key={b.id}>
              <Link to={`/it-requests/${b.id}`}>{b.title}</Link> <Who id={b.requester} />
            </li>
          ))}
        </ul>
      ) : (
        empty('No brief is waiting.')
      )}

      <SectionHeading count={s.accounts.filter((a) => !a.hidden).length}>
        {t('Social and shared accounts')}
      </SectionHeading>
      <Tbl
        head={
          <>
            <Th>{t('Account')}</Th>
            <Th>{t('Looked after by')}</Th>
            <Th>{t('Backup')}</Th>
          </>
        }
      >
        {s.accounts
          .filter((a) => !a.hidden)
          .map((a) => (
            <LinkRow key={a.id} to="accounts-register">
              <Td>
                <b>{a.service}</b>
                <small className="text-mute">{a.purpose}</small>
              </Td>
              <Td>
                <Who id={a.custodian} />
              </Td>
              <Td>
                <Who id={a.backup} />
              </Td>
            </LinkRow>
          ))}
      </Tbl>

      <SectionHeading count={published.length}>{t('How posts did')}</SectionHeading>
      <Tbl
        head={
          <>
            <Th>{t('Channel')}</Th>
            <Th>{t('Posts with results')}</Th>
            <Th>{t('Reach')}</Th>
            <Th>{t('Engagement')}</Th>
          </>
        }
      >
        {perChannel.map((r) => (
          <tr key={r.ch}>
            <Td>{chName(r.ch)}</Td>
            <Td className="type-num">{r.posts}</Td>
            <Td className="type-num">{r.reach}</Td>
            <Td className="type-num">{r.engagement}</Td>
          </tr>
        ))}
      </Tbl>
      {published.length ? (
        <Tbl
          head={
            <>
              <Th>{t('Post')}</Th>
              <Th>{t('Channel')}</Th>
              <Th>{t('Published')}</Th>
              <Th>{t('Reach / engagement')}</Th>
            </>
          }
        >
          {published.map(({ c, ch, pub }) => (
            <tr key={`${c.id}-${ch}`}>
              <Td>
                <Link to={`/content/${c.id}`}>{c.title}</Link>
              </Td>
              <Td>{chName(ch)}</Td>
              <Td className="type-num">{pub ? dShort(pub.at.slice(0, 10)) : ''}</Td>
              <Td>
                <Metrics c={c} ch={ch} can={mcWrite(m, c)} />
              </Td>
            </tr>
          ))}
        </Tbl>
      ) : (
        empty('Nothing has been published yet.')
      )}
    </Page>
  );
}

// ---------- IT ----------
export function ItTeamPage() {
  const { db, ok } = useTeamPage();
  if (!ok) return <Unavailable />;
  const s = mcitOf(db);
  const open = s.it.filter((x) => !['resolved', 'closed', 'cancelled'].includes(x.stage));
  const access = open.filter((x) => x.type === 'access');
  const teamOf = (id: string | null | undefined) => teamOfPerson(db.people.find((p) => p.id === id));
  const projects = db.projects.filter((p) => p.div === MC && (teamOf(p.lead) === 'it' || teamOf(p.pm) === 'it'));
  return (
    <Page wide>
      <PageHeader
        title={t('IT')}
        sub={t('Requests to MCIT, the IT products being planned and built, and the digital assets we look after.')}
      />
      <SectionHeading count={open.length}>{t('Open requests')}</SectionHeading>
      {open.length ? (
        <Tbl
          head={
            <>
              <Th>{t('Request')}</Th>
              <Th>{t('Requested by')}</Th>
              <Th>{t('Owner')}</Th>
              <Th>{t('State')}</Th>
            </>
          }
        >
          {open.map((x) => (
            <LinkRow key={x.id} to={`it-requests/${x.id}`}>
              <Td>
                <b>{x.title}</b>
                <small className="text-mute">{x.type}</small>
              </Td>
              <Td>
                <Who id={x.requester} />
              </Td>
              <Td>
                <Who id={x.owner} />
              </Td>
              <Td>
                <Chip def={IT[x.stage]} pill="pill" />
              </Td>
            </LinkRow>
          ))}
        </Tbl>
      ) : (
        empty('No open requests.')
      )}

      <SectionHeading count={access.length}>{t('Access requests')}</SectionHeading>
      {access.length ? (
        <ul className="my-2 grid gap-1.5">
          {access.map((x) => (
            <li key={x.id}>
              <Link to={`/it-requests/${x.id}`}>{x.title}</Link> <Who id={x.requester} />
            </li>
          ))}
        </ul>
      ) : (
        empty('No one is waiting for access.')
      )}

      <SectionHeading count={projects.length}>{t('IT projects')}</SectionHeading>
      {projects.length ? (
        <Tbl
          head={
            <>
              <Th>{t('Project')}</Th>
              <Th>{t('Lead')}</Th>
              <Th>{t('Target')}</Th>
            </>
          }
        >
          {projects.map((p) => (
            <LinkRow key={p.id} to={`projects/${p.id}`}>
              <Td>
                <b>{p.name}</b>
              </Td>
              <Td>
                <Who id={p.lead} />
              </Td>
              <Td className="type-num">{p.due ? dShort(p.due) : '-'}</Td>
            </LinkRow>
          ))}
        </Tbl>
      ) : (
        empty('No project led by the IT team yet. Start one from New, then set its lead.')
      )}

      <SectionHeading count={s.accounts.filter((a) => !a.hidden).length}>
        {t('Digital assets and accounts')}
      </SectionHeading>
      <Tbl
        head={
          <>
            <Th>{t('Asset')}</Th>
            <Th>{t('Looked after by')}</Th>
            <Th>{t('Renews')}</Th>
          </>
        }
      >
        {s.accounts
          .filter((a) => !a.hidden)
          .map((a) => (
            <LinkRow key={a.id} to="accounts-register">
              <Td>
                <b>{a.service}</b>
                <small className="text-mute">{a.purpose}</small>
              </Td>
              <Td>
                <Who id={a.custodian} />
              </Td>
              <Td className="type-num">{a.renewal ? dShort(a.renewal) : '-'}</Td>
            </LinkRow>
          ))}
      </Tbl>
    </Page>
  );
}

export { TEAM_LABEL };
