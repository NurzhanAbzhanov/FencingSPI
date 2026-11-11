# Partial Ratings and SPI

## Rules
- Missing fencer ratings remain null, not zero. Uploads replace the selected gender's full roster; omitted programs are unavailable.
- A squad needs at least three roster entries and a rating for every entry. Use the existing top-three average and gender rounding only when complete.
- Calculate Team PR from three complete squads' raw averages. Explicit admin overrides remain usable as authoritative PRs.
- Keep every match. For each weapon/Team result, require available own and opponent PRs; exclude unavailable pairings symmetrically.
- Partial seasons show null SPI when no eligible results exist, and publish included/excluded result counts. Leave the established category/scoring formula unchanged.
- Completed seasons retain legacy empty-season behavior. New seasons and the active season support partial ratings; do not recalculate historical seasons during migration.

## Implementation
1. Add nullable rating/SPI storage, season calculation mode and result coverage fields in one migration.
2. Replace PR upload calculation and SPI recalculation functions; preserve season locking, admin authorization, overrides and imported-history protection. Recalculate when overrides change.
3. Accept blank rating cells but reject missing headers/invalid values. Render unknown PR/SPI as dashes and show provisional coverage in standings and exports; never coerce null SPI to zero in poll reference data.
4. Test incomplete squads, Team readiness, symmetric match exclusion, late rating updates, real zero, no eligible results, manual overrides, imported seasons and legacy numeric equivalence using rollback-only SQL fixtures.
5. Run frontend tests/build and database audits, then push GitHub, verify Vercel and package the versioned WordPress plugin. Do not import the supplied rosters without a separate request.
