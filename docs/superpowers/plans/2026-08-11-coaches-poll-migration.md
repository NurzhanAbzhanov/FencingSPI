# Coaches Poll Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Vite application's prototype coaches poll with the supplied USFCA poll workflow while using existing Supabase programs, calculated SPI, matches, authentication, and static Vercel deployment.

**Architecture:** Keep the Vite application as the host and port the supplied poll's behavior into focused React pages and repositories. Supabase remains authoritative, creates an immutable calculated-SPI snapshot when a poll opens, validates ballots transactionally, and controls committee/public visibility with RLS.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Supabase JS 2, PostgreSQL/PLpgSQL, Vitest, Testing Library, pgTAP through Supabase CLI, existing CSS and Lucide icons.

## Global Constraints

- Do not change the SPI or power-rating formulas.
- Do not migrate the application to Next.js.
- Do not create a second poll application or parallel production data model.
- Do not add a manual SPI upload path.
- Historical match normalization and historical SPI calculation remain deferred.
- Preserve existing schools, programs, seasons, users, permissions, matches, SPI results, power-rating overrides, and unrelated working-tree files.
- Use the supplied categories, slot counts, editable-until-close behavior, Team Overall prerequisite, and locked Team Division III prefix.
- Show only published aggregate results anonymously; show individual ballots to authenticated committee members only after close.
- Keep hash routing and the existing static-compatible Vercel deployment.
- Use the supplied logo mappings with a stable initials fallback.

## File Structure

### Domain And Types

- Create `src/types/polls.ts`: poll category, period, ballot, snapshot, standings, coach, and participation types.
- Create `src/lib/pollDomain.ts`: category metadata, slug parsing, ballot validation, Division III lock derivation, and point standings.
- Create `src/lib/pollDomain.test.ts`: pure domain tests.

### Supabase

- Create `supabase/migrations/202608110001_coaches_poll_replacement.sql`: snapshots, category metadata, committee access grants, state functions, ballot-save function, publication, audit, and RLS.
- Create `supabase/tests/coaches_poll_replacement_test.sql`: pgTAP coverage for category initialization, snapshots, state transitions, ballot rules, results, and permissions.
- Create `supabase/config.toml` through `supabase init` if the repository does not already contain it.

### Repositories

- Create `src/lib/pollRepository.ts`: coach-facing dashboard, ballot, closed ballot, and public result reads plus ballot writes.
- Create `src/lib/pollRepository.test.ts`: repository mapping and RPC-contract tests.
- Create `src/lib/pollAdminRepository.ts`: poll state, participation, coach access, and schedule operations.
- Create `src/lib/pollAdminRepository.test.ts`: admin mapping and RPC-contract tests.
- Modify `src/lib/platformData.ts`: keep season/program/match/SPI loading; remove official poll dependence on local demo ballot storage.

### Shared UI

- Create `src/lib/schoolLogos.ts` and `src/lib/schoolLogos.test.ts`: canonical-name and alias logo resolution.
- Modify `src/components/SchoolLogo.tsx`: resolved image with `onError` initials fallback.
- Create `src/components/polls/PollShell.tsx`: shared poll heading, navigation, and status treatment.
- Create `src/components/polls/TeamSelectCombobox.tsx`: supplied searchable ranked-slot selector.
- Create `src/components/polls/PollResultsTable.tsx`: shared authenticated/public results table.
- Create `src/components/polls/PollSpiReference.tsx`: poll snapshot table and quick-rank actions.
- Create `src/pages/polls/Polls.css`: poll-specific responsive layout.

### Pages And Routes

- Create `src/pages/polls/PollDashboardPage.tsx`.
- Create `src/pages/polls/PollBallotPage.tsx`.
- Create `src/pages/polls/PollResultsPage.tsx`.
- Create `src/pages/polls/PublicPollResultsPage.tsx`.
- Create `src/pages/polls/PollManagementPage.tsx`.
- Create `src/pages/polls/CoachManagementPage.tsx`.
- Create `src/pages/polls/PollParticipationPage.tsx`.
- Modify `src/pages/AdminPage.tsx`: retain school-program creation and link to the three poll administration pages.
- Modify `src/pages/StandingsPage.tsx` and `src/pages/SchoolResultsPage.tsx`: use shared logos and preserve existing results links.
- Modify `src/App.tsx` and `src/components/Header.tsx`: replacement routes and access gates.
- Delete `src/pages/PollsPage.tsx`, `src/pages/BallotPage.tsx`, `src/pages/TransparencyPage.tsx`, and `src/lib/ballotRepository.ts` after replacement routes compile.
- Modify `src/App.css`: remove obsolete prototype poll rules after `Polls.css` is active.

---

### Task 1: Test Harness And Poll Domain

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `vite.config.ts`
- Create: `src/test/setup.ts`
- Create: `src/types/polls.ts`
- Create: `src/lib/pollDomain.ts`
- Test: `src/lib/pollDomain.test.ts`

**Interfaces:**
- Produces: `POLL_CATEGORY_SPECS`, `getPollCategorySpec`, `computePollStandings`, `deriveLockedD3TeamIds`, and `validateBallotTeamIds`.
- Produces: shared `PollCategorySlug`, `PollCategorySpec`, `PollStanding`, and `PollVote` types used by every later task.

- [ ] **Step 1: Install and configure the test tools**

Run:

```bash
npm install --save-dev vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event supabase
```

Add scripts:

```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "test:db": "supabase test db"
}
```

Configure `vite.config.ts` with `defineConfig` from `vitest/config`, `environment: "jsdom"`, `setupFiles: ["./src/test/setup.ts"]`, and `restoreMocks: true`. In `src/test/setup.ts`, import `@testing-library/jest-dom/vitest` and call Testing Library `cleanup()` in `afterEach`.

- [ ] **Step 2: Write failing category and standings tests**

Cover these exact expectations:

```ts
expect(POLL_CATEGORY_SPECS.filter((item) => !item.hidden)).toHaveLength(10);
expect(getPollCategorySpec("men_team_diii")).toMatchObject({ rankLimit: 8, scope: "DIII", weapon: "Team" });
expect(getPollCategorySpec("women_squad_sabre_diii")).toMatchObject({ rankLimit: 5, hidden: true });

expect(computePollStandings([
    { rankings: [1, 2, 3] },
    { rankings: [2, 1, 3] },
], new Map([[1, "Alpha"], [2, "Beta"], [3, "Gamma"]]), 3)).toEqual([
    { rank: 1, teamId: 1, teamName: "Alpha", points: 5, firstPlaceVotes: 1 },
    { rank: 1, teamId: 2, teamName: "Beta", points: 5, firstPlaceVotes: 1 },
    { rank: 3, teamId: 3, teamName: "Gamma", points: 2, firstPlaceVotes: 0 },
]);
```

Also test shared ranks for equal point totals, canonical-name deterministic display ordering, invalid slugs, unique/full ranking validation, eligibility validation, and `deriveLockedD3TeamIds([9, 3, 7, 5], new Set([3, 5]), 8) === [3, 5]`.

- [ ] **Step 3: Run the tests and verify the expected failure**

Run: `npm test -- src/lib/pollDomain.test.ts`

Expected: FAIL because the domain module and exported types do not exist.

- [ ] **Step 4: Implement the poll types and pure domain logic**

Define all 16 supplied categories explicitly. Use these public shapes:

```ts
export type PollCategorySpec = {
    slug: PollCategorySlug;
    label: string;
    gender: Gender;
    weapon: Weapon;
    scope: PollScope;
    rankLimit: number;
    hidden: boolean;
};

export type PollVote = { rankings: number[] };

export type PollStanding = {
    rank: number;
    teamId: number;
    teamName: string;
    points: number;
    firstPlaceVotes: number;
};
```

`computePollStandings` assigns `slotCount - index` points, then ranks by points descending. Equal point totals receive the same competition rank; canonical school name is used only for deterministic display order within a tie. `validateBallotTeamIds` returns a string error for wrong size, zero IDs, duplicates, ineligible IDs, or a locked prefix mismatch; otherwise it returns `null`.

- [ ] **Step 5: Run domain tests and the existing build**

Run: `npm test -- src/lib/pollDomain.test.ts`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 6: Commit the domain foundation**

```bash
git add package.json package-lock.json vite.config.ts src/test/setup.ts src/types/polls.ts src/lib/pollDomain.ts src/lib/pollDomain.test.ts
git commit -m "Build coaches poll domain foundation"
```

### Task 2: Supabase Poll State Machine And Security

**Files:**
- Create: `supabase/config.toml`
- Create: `supabase/migrations/202608110001_coaches_poll_replacement.sql`
- Test: `supabase/tests/coaches_poll_replacement_test.sql`

**Interfaces:**
- Consumes: the category definitions and rules fixed in Task 1.
- Produces RPCs: `initialize_poll_period(uuid)`, `schedule_poll_period(uuid, timestamptz, timestamptz)`, `open_poll_period(uuid)`, `close_poll_period(uuid)`, `save_poll_ballot(uuid, uuid[], boolean)`, `publish_poll_period(uuid)`, and `save_committee_access(text, text, app_role, boolean, boolean)`.
- Produces tables: `poll_spi_snapshots`, `committee_access_grants`, and `poll_admin_audit_log`.

- [ ] **Step 1: Initialize local Supabase configuration**

Run: `npx supabase init`

Keep the generated local ports and set `auth.site_url = "http://localhost:5173"`. Do not alter existing migration files.

- [ ] **Step 2: Write failing pgTAP tests**

Create fixtures for one administrator, one voter, Men and Women programs, Division I and Division III programs, four `spi_results` rows per program, and one draft poll period. Assert:

```sql
select is(
    (select count(*)::integer from public.ballot_definitions where period_id = test_period),
    16,
    'initialization creates all supplied categories'
);

select is(
    (select count(*)::integer from public.ballot_definitions where period_id = test_period and hidden = false),
    10,
    'only ten supplied categories are visible'
);

select throws_ok(
    format('select public.open_poll_period(%L)', incomplete_period),
    'Calculated SPI snapshot is incomplete',
    'opening rejects incomplete calculated SPI'
);
```

Also assert one-open-period enforcement, immutable snapshot values after source SPI changes, scheduled-close rejection, editable submitted ballots while open, full/unique/eligible rankings, Team Overall prerequisite, locked Team Division III prefix, close immutability, publish-only-after-close, reverse points, first-place votes, and anonymous/coach/admin RLS boundaries.

- [ ] **Step 3: Run database tests and verify failure**

Run: `npm run test:db`

Expected: FAIL because replacement tables, columns, and RPCs do not exist.

- [ ] **Step 4: Add schema and category migration**

The migration must:

```sql
alter table public.ballot_definitions
    add column if not exists slug text,
    add column if not exists hidden boolean not null default false,
    add column if not exists archived_at timestamptz;

create unique index if not exists ballot_definitions_period_slug_key
    on public.ballot_definitions(period_id, slug)
    where slug is not null;

create table public.poll_spi_snapshots (
    period_id uuid not null references public.poll_periods(id) on delete cascade,
    program_id uuid not null references public.programs(id) on delete cascade,
    gender public.fencing_gender not null,
    weapon public.fencing_weapon not null,
    spi numeric not null,
    spi_rank integer not null check (spi_rank > 0),
    power_rating numeric,
    division smallint not null check (division in (1, 2, 3)),
    conference text not null,
    region text not null,
    captured_at timestamptz not null default now(),
    primary key (period_id, program_id, weapon)
);
```

Add `committee_access_grants(email text primary key, display_name text, role app_role, can_vote boolean, active boolean, created_at, updated_at)` and `poll_admin_audit_log(id, period_id, actor_id, action, detail, created_at)`. Seed one grant for every existing profile by joining `profiles.id` to `auth.users.id`, preserving `display_name`, `role`, `can_vote`, and `active`. Replace the hardcoded-email profile trigger so it reads a lowercased access grant and creates an inactive non-voter profile when no grant exists.

- [ ] **Step 5: Implement poll-state and ballot RPCs**

`initialize_poll_period` upserts the exact 16 slugs and fixed slot counts from Task 1, marks six Division III weapon categories hidden, and archives unsupported prototype definitions.

`open_poll_period` must run as an administrator-only transaction that closes expired open periods, rejects another effective open period, initializes categories, rebuilds the snapshot from `spi_results` joined to `program_seasons`, verifies every active program has Team/Epee/Foil/Sabre values, sets `spi_rank` with `row_number()` by gender and weapon, marks the period open, and audits the action.

`save_poll_ballot` must:

```sql
create or replace function public.save_poll_ballot(
    target_definition uuid,
    ranked_programs uuid[],
    submit_now boolean
) returns uuid
language plpgsql
security definer
set search_path = public;
```

It verifies the caller can vote, the period is effectively open, array length equals `rank_limit`, IDs are unique, all candidates match season/gender/scope, and Team Division III begins with the current submitted Team Overall Division III subset. It upserts the caller's ballot, replaces rankings in array order, sets `submitted` when `submit_now` is true, permits later replacement while open, and writes a ballot audit row. Saving a changed submitted Team Overall ballot marks an existing matching Team Division III ballot `draft` so the coach must review and resubmit its regenerated locked prefix.

`schedule_poll_period` rejects non-admins, requires `opens_at < closes_at` when both values exist, updates the two timestamps only while the period is draft, and audits. `close_poll_period` rejects non-admins, verifies every submitted Team Division III ballot matches its current Overall prefix, marks the period closed, and audits. `publish_poll_period` requires closed status, computes reverse points and first-place votes, assigns shared competition ranks with `rank()` based only on points, stores results, marks published, and audits.

`save_committee_access` lowercases and validates the email, upserts the grant, synchronizes an already-linked profile, prevents deactivating or demoting the final active administrator, and audits the change without exposing `auth.users` to the browser.

- [ ] **Step 6: Replace RLS policies with approved visibility**

Enable RLS on new tables. Grant:

- public read of published aggregate results and approved match scores only
- authenticated read of open snapshots and poll metadata
- voter read of only their ballot while effectively open and mutation only through `save_poll_ballot`
- authenticated committee read of individual ballots only after close
- administrator management of periods, grants, snapshots, and audit rows

Remove the `202608060001_ballot_locking.sql` behavior that blocks submitted-ballot edits; the new function and policies allow edits until effective close.

- [ ] **Step 7: Run database tests**

Run: `npm run test:db`

Expected: all pgTAP assertions PASS.

- [ ] **Step 8: Commit the database contract**

```bash
git add supabase/config.toml supabase/migrations/202608110001_coaches_poll_replacement.sql supabase/tests/coaches_poll_replacement_test.sql
git commit -m "Add coaches poll database state machine"
```

### Task 3: Typed Poll Repositories

**Files:**
- Modify: `src/types/polls.ts`
- Create: `src/lib/pollRepository.ts`
- Test: `src/lib/pollRepository.test.ts`
- Create: `src/lib/pollAdminRepository.ts`
- Test: `src/lib/pollAdminRepository.test.ts`
- Modify: `src/lib/platformData.ts`

**Interfaces:**
- Consumes: Task 2 tables and RPCs.
- Produces coach operations: `loadPollDashboard`, `loadPollBallot`, `savePollBallot`, `loadPollResults`, `loadPublicPollResults`, `loadIndividualBallots`.
- Produces admin operations: `loadPollPeriods`, `schedulePoll`, `openPoll`, `closePoll`, `publishPoll`, `loadParticipation`, `loadCommitteeAccess`, `saveCommitteeAccess`.

- [ ] **Step 1: Write failing repository mapping tests**

Mock `src/lib/supabase.ts` and assert that:

```ts
await loadPollBallot("men_team_overall", "user-1");
expect(mockFrom).toHaveBeenCalledWith("poll_spi_snapshots");

await savePollBallot({
    definitionId: "definition-1",
    teamIds: [49, 50, 51],
    submit: true,
});
expect(mockRpc).toHaveBeenCalledWith("save_poll_ballot", {
    target_definition: "definition-1",
    ranked_programs: ["program-49", "program-50", "program-51"],
    submit_now: true,
});
```

Test row mapping for snapshot candidates, effective close state, dashboard completion, individual ballots, published standings, participation counts, and committee grants.

- [ ] **Step 2: Run repository tests and verify failure**

Run: `npm test -- src/lib/pollRepository.test.ts src/lib/pollAdminRepository.test.ts`

Expected: FAIL because repository modules do not exist.

- [ ] **Step 3: Implement coach repository and types**

Use these public signatures:

```ts
export async function loadPollDashboard(userId: string): Promise<PollDashboard>;
export async function loadPollBallot(categorySlug: PollCategorySlug, userId: string): Promise<PollBallotView>;
export async function savePollBallot(input: { definitionId: string; teamIds: number[]; submit: boolean }): Promise<string>;
export async function loadPollResults(periodId: string): Promise<PollCategoryResults[]>;
export async function loadPublicPollResults(periodId: string): Promise<PollCategoryResults[]>;
export async function loadIndividualBallots(definitionId: string): Promise<IndividualPollBallot[]>;
```

`loadPollBallot` maps program UUIDs to legacy numeric IDs internally, returns the immutable snapshot, and derives the current Team Division III locked prefix. It returns a typed prerequisite state rather than throwing when Overall is missing. A missing Supabase configuration throws `Poll data requires a configured Supabase project`; there is no local official ballot fallback.

- [ ] **Step 4: Implement admin repository**

Use these signatures:

```ts
export async function loadPollPeriods(seasonSlug: string): Promise<PollPeriodAdmin[]>;
export async function schedulePoll(input: { periodId: string; opensAt: string | null; closesAt: string | null }): Promise<void>;
export async function openPoll(periodId: string): Promise<void>;
export async function closePoll(periodId: string): Promise<void>;
export async function publishPoll(periodId: string): Promise<void>;
export async function loadParticipation(periodId: string): Promise<PollParticipationRow[]>;
export async function loadCommitteeAccess(): Promise<CommitteeAccess[]>;
export async function saveCommitteeAccess(input: CommitteeAccessInput): Promise<void>;
```

All mutations call Task 2 RPCs. Keep Supabase joins and snake-case mapping inside repositories.

- [ ] **Step 5: Remove official local poll storage dependencies**

Delete poll-definition generation, local ballot rankings, and local ballot-status helpers from `platformData.ts` only after no new repository imports them. Keep season, program, match, standings, published poll, and temporary demo-auth helpers until Task 9.

- [ ] **Step 6: Run repository and domain tests**

Run: `npm test -- src/lib/pollDomain.test.ts src/lib/pollRepository.test.ts src/lib/pollAdminRepository.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit the repository boundary**

```bash
git add src/types/polls.ts src/lib/pollRepository.ts src/lib/pollRepository.test.ts src/lib/pollAdminRepository.ts src/lib/pollAdminRepository.test.ts src/lib/platformData.ts
git commit -m "Connect poll workflow to Supabase data"
```

### Task 4: Shared School Logos

**Files:**
- Create: `src/lib/schoolLogos.ts`
- Test: `src/lib/schoolLogos.test.ts`
- Modify: `src/components/SchoolLogo.tsx`
- Test: `src/components/SchoolLogo.test.tsx`
- Modify: `src/pages/StandingsPage.tsx`
- Modify: `src/pages/SchoolResultsPage.tsx`

**Interfaces:**
- Produces: `getSchoolLogoUrl(name: string, databaseUrl?: string | null): string | null`.
- Produces: `SchoolLogo({ program, size })` with stable dimensions and image-error fallback.

- [ ] **Step 1: Write failing resolver and component tests**

Assert database URLs win, canonical long names resolve through aliases, and missing/image-error cases show initials:

```ts
expect(getSchoolLogoUrl("University of Notre Dame")).toBe("https://a.espncdn.com/i/teamlogos/ncaa/500/87.png");
expect(getSchoolLogoUrl("Columbia University-Barnard College")).toContain("/171.png");
expect(getSchoolLogoUrl("Fairleigh Dickinson University, Metropolitan Campus")).toContain("/2198.png");
expect(getSchoolLogoUrl("Unknown Fencing College")).toBeNull();
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- src/lib/schoolLogos.test.ts src/components/SchoolLogo.test.tsx`

Expected: FAIL because the resolver does not exist and image errors do not fall back.

- [ ] **Step 3: Port and normalize the supplied mappings**

Move all ESPN IDs and direct URLs from the supplied `components/TeamLogo.tsx` into `schoolLogos.ts`. Normalize punctuation and case, then map current canonical names and aliases such as Notre Dame, Penn, Penn State, Ohio State, St. John's, Air Force, MIT, NYU, UNC, UCSD, Northwestern, FDU, LIU, UIW, CCNY, and Detroit Mercy without substring collisions.

Update `SchoolLogo` to reset its error state when the resolved URL changes, use `onError`, preserve the existing small/normal CSS classes, and generate up to two initials.

- [ ] **Step 4: Add logos to standings and school results**

Keep the standings logo column stable. Add the same `SchoolLogo` beside the school name heading on `SchoolResultsPage`; do not add decorative cards or change result-table behavior.

- [ ] **Step 5: Run tests and build**

Run: `npm test -- src/lib/schoolLogos.test.ts src/components/SchoolLogo.test.tsx`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 6: Commit shared logo support**

```bash
git add src/lib/schoolLogos.ts src/lib/schoolLogos.test.ts src/components/SchoolLogo.tsx src/components/SchoolLogo.test.tsx src/pages/StandingsPage.tsx src/pages/SchoolResultsPage.tsx
git commit -m "Share school logos across SPI and polls"
```

### Task 5: Supplied Poll Dashboard

**Files:**
- Create: `src/components/polls/PollShell.tsx`
- Create: `src/pages/polls/PollDashboardPage.tsx`
- Test: `src/pages/polls/PollDashboardPage.test.tsx`
- Create: `src/pages/polls/Polls.css`

**Interfaces:**
- Consumes: `loadPollDashboard(userId)` and visible category metadata.
- Produces: dashboard links to `#/polls/vote/<categorySlug>` and `#/polls/results/<periodId>`.

- [ ] **Step 1: Write failing dashboard tests**

Mock a dashboard with one open poll and assert the page shows its label and close time, exactly ten visible categories, completion/edit labels, no hidden Division III weapon category, and no voting link for `canVote: false`.

- [ ] **Step 2: Run the dashboard test and verify failure**

Run: `npm test -- src/pages/polls/PollDashboardPage.test.tsx`

Expected: FAIL because the page does not exist.

- [ ] **Step 3: Implement the dashboard from the supplied flow**

Use the supplied dashboard's quiet operational layout. Group categories into Team and Squad sections, show status and completion, and expose Results only for closed or published periods. Show administrator links to poll management, coach management, and participation. Render explicit loading, no-open-poll, permission, and repository-error states.

- [ ] **Step 4: Implement responsive poll CSS**

Use a constrained content width, 8px-or-less radii, responsive tables, fixed icon/button dimensions, visible focus states, and no nested cards. At mobile widths, stack dashboard metadata and keep category actions reachable without horizontal page overflow.

- [ ] **Step 5: Run the dashboard test**

Run: `npm test -- src/pages/polls/PollDashboardPage.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit the dashboard**

```bash
git add src/components/polls/PollShell.tsx src/pages/polls/PollDashboardPage.tsx src/pages/polls/PollDashboardPage.test.tsx src/pages/polls/Polls.css
git commit -m "Port coaches poll dashboard"
```

### Task 6: Supplied Numbered-Slot Ballot

**Files:**
- Create: `src/components/polls/TeamSelectCombobox.tsx`
- Test: `src/components/polls/TeamSelectCombobox.test.tsx`
- Create: `src/components/polls/PollSpiReference.tsx`
- Create: `src/pages/polls/PollBallotPage.tsx`
- Test: `src/pages/polls/PollBallotPage.test.tsx`
- Modify: `src/pages/polls/Polls.css`

**Interfaces:**
- Consumes: `loadPollBallot` and `savePollBallot`.
- Produces: one category ballot with numbered slots, Team Division III prerequisite/locks, calculated SPI reference, review, submit, and edit-in-place behavior.

- [ ] **Step 1: Write failing combobox and ballot tests**

Cover search, disabled already-selected options, keyboard selection, every-slot validation, quick-rank filling the first empty slot, clear-editable preserving locked slots, review confirmation, fresh submission, editing a submitted ballot while open, close-time rejection, and Team Division III prerequisite.

Use an approved DIII fixture:

```ts
expect(screen.getByText("Complete overall ballot first")).toBeInTheDocument();
expect(screen.getByRole("link", { name: /go to men's team overall/i })).toHaveAttribute("href", "#/polls/vote/men_team_overall");
```

For a loaded DIII ballot, assert locked teams occupy the first slots and cannot open a combobox.

- [ ] **Step 2: Run ballot tests and verify failure**

Run: `npm test -- src/components/polls/TeamSelectCombobox.test.tsx src/pages/polls/PollBallotPage.test.tsx`

Expected: FAIL because replacement components do not exist.

- [ ] **Step 3: Port the supplied selector and ballot layout**

Adapt the supplied `TeamSelectCombobox` without Next.js imports. Each rank has a fixed number label and one searchable selector. Selected schools are unavailable in other slots. Locked Team Division III slots show the lock icon and school name.

`PollBallotPage` loads by category slug, pads saved rankings to `rankLimit`, auto-fills the derived locked prefix, and uses `validateBallotTeamIds` before opening a native review dialog. `Confirm & submit` calls `savePollBallot({ submit: true })`. A submitted ballot reloads as editable and displays the supplied editing banner until close.

- [ ] **Step 4: Connect calculated SPI and match research**

`PollSpiReference` displays immutable snapshot rank, logo, school, division, conference, region, SPI, and power rating. Its action fills the first editable empty rank. Each row links to `#/schools/<legacyTeamId>/results?season=<seasonSlug>`. Use the label `Calculated SPI snapshot`; never show `Uploaded SPI`.

- [ ] **Step 5: Run ballot tests and build**

Run: `npm test -- src/components/polls/TeamSelectCombobox.test.tsx src/pages/polls/PollBallotPage.test.tsx`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

- [ ] **Step 6: Commit the ballot replacement**

```bash
git add src/components/polls/TeamSelectCombobox.tsx src/components/polls/TeamSelectCombobox.test.tsx src/components/polls/PollSpiReference.tsx src/pages/polls/PollBallotPage.tsx src/pages/polls/PollBallotPage.test.tsx src/pages/polls/Polls.css
git commit -m "Port supplied coaches poll ballot"
```

### Task 7: Poll Results, Transparency, And CSV

**Files:**
- Create: `src/lib/pollCsv.ts`
- Test: `src/lib/pollCsv.test.ts`
- Create: `src/components/polls/PollResultsTable.tsx`
- Create: `src/pages/polls/PollResultsPage.tsx`
- Test: `src/pages/polls/PollResultsPage.test.tsx`
- Create: `src/pages/polls/PublicPollResultsPage.tsx`
- Test: `src/pages/polls/PublicPollResultsPage.test.tsx`
- Modify: `src/pages/polls/Polls.css`

**Interfaces:**
- Consumes: `loadPollResults`, `loadIndividualBallots`, and published result policies.
- Produces: authenticated closed/published results, committee ballot disclosure, public aggregate results, and exact-filter CSV downloads.

- [ ] **Step 1: Write failing standings and export tests**

Assert category switching, rank/points/first-place-vote columns, shared exact-tie ranks from repository results, individual ballot visibility only after close, public omission of individual voters, and RFC-compatible CSV quoting.

```ts
expect(createPollResultsCsv(rows)).toContain('1,"Columbia University-Barnard College",120,4');
expect(screen.queryByText("Coach One")).not.toBeInTheDocument();
```

- [ ] **Step 2: Run result tests and verify failure**

Run: `npm test -- src/lib/pollCsv.test.ts src/pages/polls/PollResultsPage.test.tsx src/pages/polls/PublicPollResultsPage.test.tsx`

Expected: FAIL because result modules do not exist.

- [ ] **Step 3: Implement shared results and authenticated disclosure**

Build one `PollResultsTable` used by both pages. The authenticated page shows all supported categories and reveals individual ballots only when the period is closed or published. Display voter names and exact ordered selections in expandable rows, matching the supplied transparency behavior.

- [ ] **Step 4: Implement public results and CSV**

The public route reads only `published_poll_results`. It shows poll label, category selector, rank, logo, school, points, and first-place votes. CSV exports only the currently selected category and includes `Rank,School,Points,First-place votes`.

- [ ] **Step 5: Run tests**

Run: `npm test -- src/lib/pollCsv.test.ts src/pages/polls/PollResultsPage.test.tsx src/pages/polls/PublicPollResultsPage.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit poll results**

```bash
git add src/lib/pollCsv.ts src/lib/pollCsv.test.ts src/components/polls/PollResultsTable.tsx src/pages/polls/PollResultsPage.tsx src/pages/polls/PollResultsPage.test.tsx src/pages/polls/PublicPollResultsPage.tsx src/pages/polls/PublicPollResultsPage.test.tsx src/pages/polls/Polls.css
git commit -m "Add coaches poll results and exports"
```

### Task 8: Poll Administration, Coaches, And Participation

**Files:**
- Create: `src/pages/polls/PollManagementPage.tsx`
- Test: `src/pages/polls/PollManagementPage.test.tsx`
- Create: `src/pages/polls/CoachManagementPage.tsx`
- Test: `src/pages/polls/CoachManagementPage.test.tsx`
- Create: `src/pages/polls/PollParticipationPage.tsx`
- Test: `src/pages/polls/PollParticipationPage.test.tsx`
- Modify: `src/pages/AdminPage.tsx`
- Modify: `src/pages/polls/Polls.css`

**Interfaces:**
- Consumes: all Task 3 admin operations.
- Produces: supplied poll scheduling/state controls, committee access management, and per-category participation status.

- [ ] **Step 1: Write failing admin-page tests**

Assert non-admin rejection, opening confirmation, incomplete-snapshot error display, close and publish state-specific actions, ten-voter summary, add/update/deactivate committee access, last-admin protection from the RPC, and coach/category participation counts.

- [ ] **Step 2: Run admin tests and verify failure**

Run: `npm test -- src/pages/polls/PollManagementPage.test.tsx src/pages/polls/CoachManagementPage.test.tsx src/pages/polls/PollParticipationPage.test.tsx`

Expected: FAIL because pages do not exist.

- [ ] **Step 3: Port poll management**

Show each period's label, scheduled opening/closing values, effective status, snapshot timestamp, and valid actions. Require confirmation before open, close, or publish. Surface repository error messages verbatim enough to identify missing SPI or invalid ballots. Do not include the supplied manual SPI upload page.

- [ ] **Step 4: Port coach management using access grants**

List lowercased email, display name, role, voting permission, active status, and linked-profile state. Add and edit grants through `saveCommitteeAccess`. Explain in concise admin-only help text that a Supabase Auth invitation is still required for a new email to sign in. Prevent the UI from attempting service-role Auth operations in the browser.

- [ ] **Step 5: Port participation tracking**

Display one row per active voter and one status column per visible category. Distinguish not started, draft, and submitted. Include submitted totals and allow CSV export of the exact participation table.

- [ ] **Step 6: Refocus the existing admin index**

Keep school-program creation in `AdminPage`. Replace its prototype poll schedule and ballot-reopen sections with icon links to Poll management, Coaches, and Participation. Submitted ballots no longer require administrator reopening.

- [ ] **Step 7: Run admin tests**

Run: `npm test -- src/pages/polls/PollManagementPage.test.tsx src/pages/polls/CoachManagementPage.test.tsx src/pages/polls/PollParticipationPage.test.tsx`

Expected: PASS.

- [ ] **Step 8: Commit administration**

```bash
git add src/pages/polls/PollManagementPage.tsx src/pages/polls/PollManagementPage.test.tsx src/pages/polls/CoachManagementPage.tsx src/pages/polls/CoachManagementPage.test.tsx src/pages/polls/PollParticipationPage.tsx src/pages/polls/PollParticipationPage.test.tsx src/pages/AdminPage.tsx src/pages/polls/Polls.css
git commit -m "Port coaches poll administration"
```

### Task 9: Route Replacement And Legacy Removal

**Files:**
- Modify: `src/App.tsx`
- Test: `src/App.test.tsx`
- Modify: `src/components/Header.tsx`
- Modify: `src/App.css`
- Modify: `src/lib/platformData.ts`
- Modify: `README.md`
- Modify: `package.json`
- Modify: `package-lock.json`
- Delete: `src/pages/PollsPage.tsx`
- Delete: `src/pages/BallotPage.tsx`
- Delete: `src/pages/TransparencyPage.tsx`
- Delete: `src/lib/ballotRepository.ts`

**Interfaces:**
- Consumes: all replacement pages.
- Produces final hash routes and removes official prototype/local ballot behavior.

- [ ] **Step 1: Write failing routing and access tests**

Cover these routes:

```text
#/polls
#/polls/vote/men_team_overall
#/polls/results/<periodId>
#/polls/public/<periodId>
#/admin/polls
#/admin/coaches
#/admin/participation/<periodId>
```

Assert public results do not require login, voting requires `canVote`, committee results require authentication, and admin pages require `role === "admin"`.

- [ ] **Step 2: Run app tests and verify failure**

Run: `npm test -- src/App.test.tsx`

Expected: FAIL because replacement routes are not wired.

- [ ] **Step 3: Replace routes and navigation**

Extend the `Route` union with the exact routes above and parse invalid category slugs as an explicit invalid-ballot state. Replace old poll page imports. Mark the Coaches Poll nav item active for dashboard, ballot, results, and public results. Mark Admin active for all three poll-admin routes.

- [ ] **Step 4: Remove prototype implementation and dependency**

Delete the four obsolete files only after no import references remain. Remove `@dnd-kit/core` with:

```bash
npm uninstall @dnd-kit/core
```

Remove obsolete drag-and-drop, paired-ballot, locked-submission, and transparency CSS from `App.css`. Keep generic dialog, table, button, and admin styles used outside the poll.

- [ ] **Step 5: Update documentation**

Document Supabase environment variables, migration order, automatic poll SPI snapshots, hash routes, access-grant plus Auth-invitation workflow, database test command, and the absence of manual poll SPI uploads.

- [ ] **Step 6: Run complete local checks**

Run: `npm test`

Expected: PASS.

Run: `npm run lint`

Expected: PASS.

Run: `npm run build`

Expected: PASS.

Run: `rg -n "readBallot|saveBallotDraft|reopenSubmittedBallot|@dnd-kit|Uploaded SPI" src package.json`

Expected: no matches.

- [ ] **Step 7: Commit the route cutover**

```bash
git add src/App.tsx src/App.test.tsx src/components/Header.tsx src/App.css src/lib/platformData.ts README.md package.json package-lock.json src/pages/PollsPage.tsx src/pages/BallotPage.tsx src/pages/TransparencyPage.tsx src/lib/ballotRepository.ts
git commit -m "Replace prototype coaches poll routes"
```

### Task 10: Visual Verification And Release

**Files:**
- Modify only files implicated by a verified defect.

**Interfaces:**
- Consumes: the complete replacement.
- Produces: verified database migration and deployable static frontend.

- [ ] **Step 1: Run every automated check from a clean state**

Run:

```bash
npm test
npm run test:db
npm run lint
npm run build
```

Expected: every command exits zero.

- [ ] **Step 2: Start the application on an available port**

Run: `npm run dev -- --host 127.0.0.1`

Record the Vite URL and keep the process running until browser verification completes.

- [ ] **Step 3: Verify desktop and mobile poll workflows**

At 1440x900 and 390x844, inspect and exercise:

- poll dashboard
- Team Overall ballot
- Team Division III prerequisite and locked prefix
- Epee Overall ballot
- review, submit, reopen-by-edit, and resubmit while open
- closed authenticated results and individual ballots
- published public results
- poll management, coach access, and participation
- Team SPI and Squad SPI logo rendering
- school result links

Confirm no overlap, clipping, incoherent horizontal overflow, missing focus treatment, layout shift from logos, or text escaping controls. Confirm network/image failures use explicit states and initials.

- [ ] **Step 4: Apply and verify the migration against the linked Supabase project**

Run: `npx supabase db push`

Then use one administrator and one voting account to smoke-test open, vote, edit, close, committee disclosure, publish, and anonymous public result access. Confirm match entry remains administrator-only.

- [ ] **Step 5: Re-run release checks after visual fixes**

Run: `npm test`

Run: `npm run lint`

Run: `npm run build`

Expected: every command exits zero.

- [ ] **Step 6: Commit only verified visual or integration fixes**

```bash
git add src supabase README.md package.json package-lock.json
git commit -m "Verify coaches poll migration"
```

- [ ] **Step 7: Push the implementation branch and deploy**

Push the `codex/coaches-poll-migration-spec` branch, create a reviewable pull request, merge after checks, and deploy the Vercel production project only after the Supabase migration succeeds. Smoke-test the production URLs for Team SPI, Squad SPI, poll dashboard, public results, and authentication redirects.
