# Legacy coaches poll import

Source index: https://usfca.org/team-statistics/ (reviewed September 15, 2026).
The 15 publication URLs and transcribed [legacy team ID, published rank, points] rows are in `data/legacy-polls.json`.
344 rows are stored separately from live ballots in `archived_poll_results`.
No SPI calculations, live votes, or existing published poll results are changed.

## Coverage

- 2025-26: Preseason and Midseason, Men/Women, Overall/DIII. 91 imported rows; one unresolved row.
- 2024-25: Preseason, Men/Women, Overall/DIII. 47 rows.
- 2023-24: Preseason, Midseason, End-season, Men/Women, Overall/DIII. 124 rows.
- 2022-23: Midseason and End-season, Men/Women, Overall/DIII. 82 rows.
- 2021-22: No poll publication located on the legacy archive. Nothing invented or imported.
- No weapon-specific publications were located in this archive; team ranks are not copied to squads.

## Source issues and preservation

- 2025-26 men's DIII Midseason lists Tufts at rank 6. There is no men's Tufts program in our database. The source row is recorded in `unresolved` and excluded from import. Ranks 7 and 8 remain unchanged.
- 2024-25 women's DIII Preseason gives Brandeis and Johns Hopkins 57 points but ranks them 3 and 4. Preserve the published places; do not recalculate a tie.
- Published tied ranks are retained, including 2024-25 men's Overall rank 15 and 2025-26 women's DIII Preseason rank 4.
- 2025-26 publications omit point totals: stored as NULL, not zero. Fractional totals from older publications are retained.
- Archive upload dates are not assumed to be poll release dates. Original Preseason/Midseason/End-season labels are retained.
- Missing End-season 2025-26, Midseason/End-season 2024-25, and Preseason 2022-23 publications were not on the inspected legacy archive. This is a coverage gap, not evidence those polls never happened.

## New season

2026-27 is selectable. Participation/conference metadata is carried forward provisionally from 2025-26. No match, SPI, rating, override, vote or snapshot is copied. Four draft periods (October, November, December, January) are added without opening voting. The existing 2025-26 default is unchanged. With no SPI records, the new season shows "Season not started" and all four poll headers.

## Reproduction

Production verification: all 344 imported rows were read back through the public API and compared field-for-field with the reviewed source JSON. They matched exactly. The remote database already had 2026-27 draft poll periods; existing labels and schedules were preserved.

An existing deployment mismatch was also observed: `ballot_definitions` is absent from the production API, while `published_poll_results` is empty. The standings loader now checks for live results before attempting the legacy join. This import does not repair or migrate the live voting schema; that compatibility issue still needs attention before live publication through this branch.

`node scripts/build-poll-archive-migration.mjs` validates unique program/period keys and generates the data migration from the reviewed JSON. Database foreign keys and a gender preflight validate program identity. Source ranks are never computed from point totals.
