# Compact Poll Reference Table Design

## Goal

Make the coaches-poll SPI reference table fully visible beside the ballot on desktop without horizontal scrolling, following the supplied USFCA poll layout.

## Table Structure

The ballot reference table will contain five columns:

1. `SPI Rank`
2. `Team`, combining the school logo and school name
3. `SPI Score`
4. `Div`
5. `Action`

Conference, region, power rating, and the separate results link will not appear in this table. Those data remain available elsewhere in the platform and are not removed from the poll snapshot or database.

## Interaction

- An unranked school shows a pale-green `+ Rank N` button, where `N` is the next open ballot position.
- Clicking the button places the school into that position using the existing quick-rank behavior.
- A school already present anywhere on the ballot shows a green check and `Voted` instead of a disabled icon button.
- The existing searchable ballot slots remain the authoritative editing controls.

## Visual Treatment

- Use the supplied reference's white table, light gray header, subtle row separators, muted gray rank and division text, and green action states.
- Merge the logo into the team cell and use a compact row height and padding.
- Display ranks as `#1`, `#2`, and so on.
- Display divisions as `D1` and `D3` in this poll reference table to match the supplied coaches-poll design.
- Keep school names legible and allow them to wrap rather than forcing table overflow.
- Remove the global table minimum width for this table only.

## Responsive Behavior

- At desktop widths, the entire five-column table fits within the right side of the two-column ballot layout with no horizontal scrollbar.
- Below the existing ballot breakpoint, the ranking form and reference table stack vertically.
- On narrow mobile screens, compact spacing and wrapping remain active; horizontal scrolling is only a last-resort fallback for unusually narrow viewports.

## Verification

- Component tests will verify `#` rank labels, combined team cells, `Voted`, and the correct next-slot `Rank N` label.
- Tests will verify conference, region, PR, and Results are absent from this table.
- Browser checks will confirm no horizontal overflow at common desktop widths and that the stacked mobile layout remains usable.
