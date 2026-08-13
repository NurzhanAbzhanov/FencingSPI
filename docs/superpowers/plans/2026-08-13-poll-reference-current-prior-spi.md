# Poll Reference Current and Prior SPI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the compact coaches poll reference table and display both live current-season SPI and final prior-season SPI.

**Architecture:** Continue using `poll_spi_snapshots` as the ballot eligibility source. During ballot loading, resolve the current and immediately preceding seasons, join their `spi_results` by program and weapon, and expose explicit current/prior SPI candidate fields. Render those fields in a six-column native table whose Team cell contains an inner flex wrapper rather than changing the `td` display role.

**Tech Stack:** React 19, TypeScript 6, Supabase JS, Vitest, Testing Library, CSS.

## Global Constraints

- The current SPI must come from live current-season `spi_results` when available.
- The previous SPI must come from the final result for the immediately preceding season and matching gender/weapon program.
- A missing current live result falls back to the current poll snapshot SPI.
- A missing prior-season result renders as an em dash.
- No database migration or new table is required.
- The desktop reference table must not horizontally scroll; mobile rows must not overlap.
- Existing poll eligibility, ranking actions, and ballot behavior must remain unchanged.

---

## File Structure

- `src/types/polls.ts`: defines explicit `currentSpi` and nullable `previousSpi` candidate fields.
- `src/lib/pollRepository.ts`: resolves adjacent seasons, loads matching SPI results, maps and ranks candidates.
- `src/lib/pollRepository.test.ts`: verifies current/prior joins, fallback behavior, and live ordering.
- `src/components/polls/PollSpiReference.tsx`: renders the six-column reference table and native Team table cell.
- `src/components/polls/PollSpiReference.test.tsx`: verifies table content, missing history, and existing action behavior.
- `src/pages/polls/Polls.css`: fixes table layout, highlights current SPI, and defines responsive row geometry.

### Task 1: Load Current and Prior SPI Values

**Files:**
- Modify: `src/types/polls.ts`
- Modify: `src/lib/pollRepository.ts`
- Test: `src/lib/pollRepository.test.ts`

**Interfaces:**
- Consumes: ballot period season slug, snapshot program IDs, ballot category weapon.
- Produces: `PollCandidate` with `currentSpi: number`, `previousSpi: number | null`, and current-live `spiRank: number`.

- [ ] **Step 1: Write failing repository tests**

Extend the ballot fixture with two snapshot candidates and mock season/result reads:

```ts
expect(ballot.candidates).toMatchObject([
    { teamId: 50, currentSpi: 120, previousSpi: 98, spiRank: 1 },
    { teamId: 49, currentSpi: 110, previousSpi: null, spiRank: 2 },
]);
```

Add a fallback assertion where the current result is missing:

```ts
expect(ballot.candidates[0]).toMatchObject({
    currentSpi: 112.5,
    previousSpi: null,
});
```

Verify the seasons query orders by `ends_on` descending and that the results query is restricted to the selected program IDs and category weapon.

- [ ] **Step 2: Run the focused repository tests and confirm failure**

Run:

```bash
npm test -- src/lib/pollRepository.test.ts
```

Expected: failures because `PollCandidate` still exposes `spi`, and `loadPollBallot` does not query `seasons` or `spi_results`.

- [ ] **Step 3: Update the public candidate type**

Replace the ambiguous field in `PollCandidate`:

```ts
currentSpi: number;
previousSpi: number | null;
spiRank: number;
```

- [ ] **Step 4: Add current/prior result loading to `loadPollBallot`**

After snapshot eligibility is loaded, query seasons in descending end-date order, locate the ballot period's season by slug, select the following row as the prior season, then query matching results:

```ts
type SeasonRow = { id: string; slug: string; starts_on: string; ends_on: string };
type SpiResultRow = { season_id: string; program_id: string; spi: number };

const seasonsResult = await db.from('seasons')
    .select('id, slug, starts_on, ends_on')
    .order('ends_on', { ascending: false });

const seasons = (seasonsResult.data ?? []) as SeasonRow[];
const currentSeasonIndex = seasons.findIndex((season) => season.slug === period.seasonSlug);
const currentSeason = seasons[currentSeasonIndex];
const previousSeason = currentSeasonIndex >= 0 ? seasons[currentSeasonIndex + 1] : undefined;

const spiResult = await db.from('spi_results')
    .select('season_id, program_id, spi')
    .in('season_id', seasonIds)
    .in('program_id', snapshotProgramIds)
    .eq('weapon', category.weapon);
```

Throw a clear error if the ballot period's current season cannot be resolved. Build per-season maps, fall back to the snapshot SPI only for missing current data, sort descending by `currentSpi` with team name as the stable tie-breaker, and assign one-based `spiRank` values.

If only the current season exists, skip prior lookup naturally and map `previousSpi` to `null`.

- [ ] **Step 5: Run the focused repository tests**

Run:

```bash
npm test -- src/lib/pollRepository.test.ts
```

Expected: all repository tests pass, including selection of the currently open poll period and ballot persistence.

- [ ] **Step 6: Commit Task 1**

```bash
git add src/types/polls.ts src/lib/pollRepository.ts src/lib/pollRepository.test.ts
git commit -m "feat: load current and prior poll SPI"
```

### Task 2: Restore the Compact Six-Column Reference Table

**Files:**
- Modify: `src/components/polls/PollSpiReference.tsx`
- Modify: `src/components/polls/PollSpiReference.test.tsx`
- Modify: `src/pages/polls/Polls.css`

**Interfaces:**
- Consumes: Task 1's `PollCandidate.currentSpi`, `PollCandidate.previousSpi`, and `PollCandidate.spiRank`.
- Produces: a compact accessible reference table with Rank, Team, Current SPI, Last Season SPI, Division, and Action columns.

- [ ] **Step 1: Write failing component tests**

Update fixtures to use explicit SPI fields:

```ts
currentSpi: 12.3456,
previousSpi: 11.1111,
```

Assert the six headers, highlighted current cell, historical value, and missing-history fallback:

```ts
expect(screen.getByRole('columnheader', { name: 'Current SPI' })).toBeInTheDocument();
expect(screen.getByRole('columnheader', { name: 'Last Season SPI' })).toBeInTheDocument();
expect(screen.getByRole('cell', { name: '12.3456' })).toHaveClass('current-spi-cell');
expect(screen.getByRole('cell', { name: '11.1111' })).toBeInTheDocument();
expect(screen.getByRole('cell', { name: 'No prior-season SPI' })).toHaveTextContent('—');
expect(screen.getByRole('cell', { name: 'Alpha' }).querySelector('.poll-team-identity')).toBeInTheDocument();
```

Keep the existing Rank, Voted, full-ballot, and removed-column assertions.

- [ ] **Step 2: Run the focused component tests and confirm failure**

Run:

```bash
npm test -- src/components/polls/PollSpiReference.test.tsx
```

Expected: failures because the component still renders one SPI column and has no team identity wrapper.

- [ ] **Step 3: Render the six-column table**

Keep `td.poll-team-cell` as a native cell and add the inner flex wrapper:

```tsx
<td className="poll-team-cell">
    <div className="poll-team-identity">
        <SchoolLogo program={program} size="small" />
        <span>{candidate.teamName}</span>
    </div>
</td>
<td className="numeric current-spi-cell">{candidate.currentSpi.toFixed(4)}</td>
<td className="numeric previous-spi-cell" aria-label={candidate.previousSpi == null ? 'No prior-season SPI' : undefined}>
    {candidate.previousSpi == null ? '—' : candidate.previousSpi.toFixed(4)}
</td>
```

Rename the headers to `Current SPI` and `Last Season SPI`. Remove the unused `seasonSlug` component prop and its call-site/test arguments.

- [ ] **Step 4: Correct desktop and mobile CSS geometry**

Use a six-column fixed layout with the Team column flexible:

```css
.poll-reference-table th:nth-child(1) { width: 54px; }
.poll-reference-table th:nth-child(2) { width: auto; }
.poll-reference-table th:nth-child(3),
.poll-reference-table th:nth-child(4) { width: 82px; }
.poll-reference-table th:nth-child(5) { width: 44px; }
.poll-reference-table th:nth-child(6) { width: 96px; }
.poll-team-cell { min-width: 0; }
.poll-team-identity { display: flex; align-items: center; gap: 8px; min-width: 0; }
.current-spi-cell { color: #176aa6 !important; background: #eef6fc; font-weight: 800; }
```

Update the under-480px grid positions for six cells so current and prior SPI remain distinct and no content overlaps.

- [ ] **Step 5: Run focused component and ballot tests**

Run:

```bash
npm test -- src/components/polls/PollSpiReference.test.tsx src/pages/polls/PollBallotPage.test.tsx
```

Expected: all focused tests pass.

- [ ] **Step 6: Commit Task 2**

```bash
git add src/components/polls/PollSpiReference.tsx src/components/polls/PollSpiReference.test.tsx src/pages/polls/Polls.css src/pages/polls/PollBallotPage.tsx
git commit -m "fix: restore compact poll SPI reference"
```

### Task 3: Full Verification and Deployment

**Files:**
- Verify only; modify Task 1 or Task 2 files only if verification exposes a covered defect.

**Interfaces:**
- Consumes: completed repository and table behavior.
- Produces: passing quality gates and deployed responsive UI.

- [ ] **Step 1: Run all automated checks**

```bash
npm test
npm run lint
npm run build
git diff --check
```

Expected: all tests pass, lint exits zero, production build succeeds, and no whitespace errors are reported.

- [ ] **Step 2: Verify desktop geometry in the browser**

Open an authenticated ballot at a viewport at least 1280 pixels wide. Confirm all six headers and every action are visible without horizontal scrolling. Measure the reference wrapper and table `clientWidth`/`scrollWidth`; they must be equal.

- [ ] **Step 3: Verify mobile geometry in the browser**

At 390 by 844 pixels, confirm the two-line program rows show team, action, rank, both SPI values, and division without overlap. Confirm `document.documentElement.scrollWidth === document.documentElement.clientWidth`.

- [ ] **Step 4: Push and confirm Vercel deployment**

```bash
git push origin main
```

Wait for the production asset hash to update, open `https://fencing-spi.vercel.app/#/polls`, and confirm the deployed route loads without console errors.
