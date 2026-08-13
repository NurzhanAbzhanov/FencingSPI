# Compact Poll Reference Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the overflowing coaches-poll SPI reference table with the approved compact five-column layout and placement actions.

**Architecture:** Keep `PollSpiReference` as the presentation boundary and reuse its existing `onRank` callback. Derive the next open ballot position from `rankedTeamIds`, render ranked candidates as `Voted`, and apply table-specific CSS so shared platform tables remain unchanged.

**Tech Stack:** React 19, TypeScript 6, Lucide React, CSS, Vitest, Testing Library, Vite.

## Global Constraints

- Do not change poll eligibility, ballot validation, SPI values, snapshots, or Supabase data.
- Remove conference, region, power rating, and Results only from the ballot reference table.
- Keep the searchable ballot slots as the authoritative editing controls.
- Match the supplied white, light-gray, and green coaches-poll visual treatment.
- Preserve the existing stacked ballot layout below `900px`.

---

### Task 1: Compact Reference Table Behavior

**Files:**
- Create: `src/components/polls/PollSpiReference.test.tsx`
- Modify: `src/components/polls/PollSpiReference.tsx`

**Interfaces:**
- Consumes: `PollCandidate[]`, `rankedTeamIds: number[]`, and `onRank(teamId: number): void`.
- Produces: a five-column table and placement labels derived from the first zero in `rankedTeamIds`.

- [ ] **Step 1: Write the failing component tests**

Create two candidates and render with `rankedTeamIds={[1, 0, 0]}`. Assert:

```tsx
expect(screen.getByText('#1')).toBeInTheDocument();
expect(screen.getByText('Voted')).toBeInTheDocument();
expect(screen.getByRole('button', { name: 'Rank Beta at position 2' })).toHaveTextContent('+ Rank 2');
expect(screen.queryByText('Conference')).not.toBeInTheDocument();
expect(screen.queryByText('Region')).not.toBeInTheDocument();
expect(screen.queryByText('PR')).not.toBeInTheDocument();
expect(screen.queryByText('Results')).not.toBeInTheDocument();
```

Click the `Rank Beta at position 2` button and assert `onRank` receives team ID `2`.

- [ ] **Step 2: Run the component test to verify failure**

Run:

```bash
npm test -- PollSpiReference.test.tsx --run
```

Expected: FAIL because the existing table has ten columns, numeric ranks without `#`, and icon-only placement actions.

- [ ] **Step 3: Implement the five-column table**

Update `PollSpiReference` to:

```tsx
const nextRank = rankedTeamIds.findIndex((teamId) => teamId === 0) + 1;
const ranked = rankedTeamIds.includes(candidate.teamId);

<th>SPI<br />Rank</th>
<th>Team</th>
<th>SPI<br />Score</th>
<th>Div</th>
<th>Action</th>
```

Render the school logo and name in one `poll-team-cell`, format ranks as `#${candidate.spiRank}`, display divisions as `D${candidate.division}`, show `Check` plus `Voted` for ranked schools, and show a `Plus` plus `Rank ${nextRank}` button for available schools. Disable placement when there is no open slot.

- [ ] **Step 4: Run the component test**

Run:

```bash
npm test -- PollSpiReference.test.tsx --run
```

Expected: PASS.

### Task 2: Responsive Presentation And Release

**Files:**
- Modify: `src/pages/polls/Polls.css`
- Test: `src/components/polls/PollSpiReference.test.tsx`

**Interfaces:**
- Consumes: `.poll-reference-table`, `.poll-team-cell`, `.poll-rank-action`, and `.poll-voted-state` from Task 1.
- Produces: a compact desktop table without horizontal overflow and a usable stacked mobile layout.

- [ ] **Step 1: Add table-specific compact styling**

Add poll-scoped rules that override the shared `1120px` table minimum:

```css
.poll-reference-table {
    min-width: 0;
    table-layout: fixed;
    font-size: 12px;
}

.poll-reference-table th,
.poll-reference-table td {
    padding: 10px 8px;
}

.poll-reference-table th:nth-child(1) { width: 62px; }
.poll-reference-table th:nth-child(2) { width: auto; }
.poll-reference-table th:nth-child(3) { width: 84px; }
.poll-reference-table th:nth-child(4) { width: 54px; }
.poll-reference-table th:nth-child(5) { width: 104px; }
```

Use a light gray uppercase header, subtle row borders, muted rank/division text, wrapping team names, and pale green bordered action buttons. Keep `Voted` green and unboxed.

- [ ] **Step 2: Run all automated gates**

Run:

```bash
npm test
npm run lint
npm run build
git diff --check
```

Expected: all commands exit `0`.

- [ ] **Step 3: Verify desktop and mobile rendering**

Start the Vite server and inspect an authenticated ballot at a common desktop viewport. Assert in the page:

```js
document.querySelector('.poll-reference .platform-table-wrap').scrollWidth
    <= document.querySelector('.poll-reference .platform-table-wrap').clientWidth
```

Also inspect below `900px` to confirm the ballot and table stack, team names remain readable, and action labels do not overlap.

- [ ] **Step 4: Commit and deploy**

```bash
git add src/components/polls/PollSpiReference.tsx src/components/polls/PollSpiReference.test.tsx src/pages/polls/Polls.css docs/superpowers/plans/2026-08-13-compact-poll-reference-table.md
git commit -m "Compact coaches poll reference table"
git push origin codex/coaches-poll-migration-spec:main
```

Verify the live Vercel page loads the new table without browser console errors.
