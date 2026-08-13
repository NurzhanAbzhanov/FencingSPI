# Poll Reference Current and Prior SPI Design

## Goal

Restore the coaches poll SPI reference table to a compact, fully visible layout and show both the live current-season SPI and the final SPI from the immediately preceding season.

## Root Cause

The Team table cell currently uses `display: flex`. This removes it from normal table-cell layout and allows it to consume the available row width, pushing the remaining columns outside the visible table. The Team cell must remain a table cell; logo/name alignment belongs in a child wrapper.

## Table Layout

The reference table will contain six columns:

1. SPI Rank
2. Team
3. Current SPI
4. Last Season SPI
5. Division
6. Action

The current SPI column will use a restrained pale-blue background and stronger blue text so voters can distinguish live information at a glance. Last-season SPI will retain neutral table styling. Missing historical values will display an em dash.

The Team cell will contain an inner flex wrapper for the logo and school name while the outer `td` remains a native table cell. Fixed widths will be assigned to all compact data/action columns, leaving the Team column to absorb the remaining width. The desktop table must fit its ballot panel without horizontal scrolling.

On narrow mobile viewports, each program will use a compact two-line grid row. The team and action remain prominent on the first line; rank, current SPI, prior SPI, and division occupy the supporting line without overlap.

## Data Flow

The poll snapshot remains the source of eligible programs for a ballot. At ballot load time, the repository will additionally:

1. Resolve the ballot period's current season.
2. Resolve the immediately preceding season by season dates.
3. Load matching `spi_results` for the ballot's gender/weapon programs in both seasons.
4. Attach live current-season SPI and nullable prior-season SPI to each poll candidate.
5. Sort candidates by live current SPI and derive the displayed SPI rank from that ordering.

The poll scope affects eligibility, not the SPI value: Overall and Division III ballots use the same gender/weapon SPI result for a given program. No new database table or migration is required.

If a current live SPI record is unexpectedly unavailable for an eligible snapshot program, the existing snapshot SPI will be used as a defensive fallback so the ballot remains usable. If prior-season SPI is unavailable, the UI displays an em dash.

## Type Changes

`PollCandidate` will expose explicit values rather than one ambiguous SPI field:

- `currentSpi: number`
- `previousSpi: number | null`
- `spiRank: number`

The existing snapshot SPI is an internal repository fallback and does not need to remain part of the public candidate type.

## Testing

Repository tests will verify:

- current and prior results are joined to the correct program and weapon;
- the previous season is selected chronologically;
- current snapshot SPI is used only when current live data is absent;
- missing prior data becomes `null`;
- candidates are sorted and ranked by current live SPI.

Component tests will verify:

- all six headers and values render;
- current SPI receives its distinct visual class;
- missing prior SPI renders an em dash;
- the Team cell retains a child identity wrapper;
- Rank, Voted, and full-ballot actions continue to work;
- removed conference, region, power-rating, and results columns do not return.

Browser verification will check desktop and mobile geometry for horizontal overflow and overlapping content, followed by the complete test, lint, and production-build suites.
