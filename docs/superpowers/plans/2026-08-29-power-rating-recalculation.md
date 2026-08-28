# Power Rating Recalculation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Read authoritative ratings from Supabase and recalculate seasonal ratings from admin-uploaded fencer files.

**Architecture:** Persist source rows in Supabase and perform replacement plus recalculation in one admin-only PostgreSQL function. Parse spreadsheet files in the browser, call the function through a focused repository API, and refresh the existing Admin table.

**Tech Stack:** React, TypeScript, Vitest, SheetJS, Supabase/PostgreSQL, pgTAP

**Spec:** `docs/superpowers/specs/2026-08-29-power-rating-recalculation-design.md`

## Global Constraints

- Do not modify existing SPI scores or manual overrides.
- Preserve the existing top-three and gender-rounding formulas.
- Divide partial squads by three, assign zero to missing squads/programs, and reject unknown programs.
- Keep recalculation admin-only and transactional.

---

### Task 1: Database Storage And Recalculation

**Files:**
- Create: `supabase/migrations/202608290001_fencer_rating_recalculation.sql`
- Create: `supabase/tests/fencer_rating_recalculation_test.sql`

**Interfaces:**
- Produces: `public.replace_fencer_ratings_and_recalculate(text, public.gender, jsonb, text)`

- [x] Write pgTAP coverage for permissions, source-row replacement, top-three selection, partial and missing squads, gender rounding, team averaging, missing programs, and override preservation.
- [x] Run `npm run test:db` and confirm the new behavior fails against the previous function.
- [x] Add the table, RLS policies, and transactional recalculation function.
- [x] Run `npm run test:db` and confirm all database tests pass.

### Task 2: Repository And File Parsing

**Files:**
- Modify: `src/lib/powerRatingOverrides.ts`
- Create: `src/lib/powerRatingOverrides.test.ts`

**Interfaces:**
- Produces: `parseFencerRatingFile(file): Promise<FencerRatingUploadRow[]>`
- Produces: `recalculatePowerRatings(season, gender, rows, sourceFile): Promise<void>`
- Changes: `loadPowerRatingRecords(season)` reads `spi_results.power_rating`.

- [x] Write failing tests for direct Supabase mapping and spreadsheet header/row normalization.
- [x] Run the focused test and confirm expected failures.
- [x] Implement direct database loading, spreadsheet parsing, and RPC invocation.
- [x] Run the focused test and confirm it passes.

### Task 3: Admin Recalculation UI

**Files:**
- Modify: `src/pages/PowerRatingsPage.tsx`
- Modify: `src/pages/PowerRatingsPage.css`
- Create: `src/pages/PowerRatingsPage.test.tsx`

**Interfaces:**
- Consumes: repository functions from Task 2.

- [x] Write a failing component test for selecting both gender files and invoking recalculation.
- [x] Run the focused test and confirm expected failure.
- [x] Add compact file controls, validation status, confirmation, recalculation, and table refresh.
- [x] Run the focused test and confirm it passes.

### Task 4: Verification

**Files:** No production files.

- [x] Run `npm test`.
- [x] Run `npm run build`.
- [x] Review `git diff --check` and `git status --short`.
