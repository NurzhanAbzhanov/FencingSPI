# Power Rating Recalculation Design

## Goal

Make Supabase the source of truth for calculated power ratings and allow administrators to replace a season's fencer-rating inputs and recalculate all squad and team ratings.

## Data Model

Store each uploaded fencer rating in `fencer_ratings`, linked to a season and program. Rows contain weapon, rating, source filename, uploader, and import timestamp. Manual values remain in `power_rating_overrides` and are never changed by recalculation.

## Calculation

An admin-only database function atomically validates and replaces one gender's uploaded rows, then recalculates Epee, Foil, Sabre, and Team ratings for that gender. Squad raw ratings are the sum of up to the top three entries divided by three, including when only one or two entries are present. A program with no entries for a weapon receives zero. Team raw rating is the average of the three squad raw ratings. Present squads with values below 10 adjust to 10; otherwise Men round down and Women round up to a multiple of 10.

The function updates only `spi_results.power_rating` and `calculated_at`. It requires existing `spi_results` rows, preventing uploads from silently creating incomplete SPI records.

## Admin Flow

The existing Admin Power Ratings section reads calculated ratings directly from `spi_results`. It accepts separate `.xlsx`, `.xls`, `.csv`, or `.tsv` files for Men and Women. Required columns are team name, weapon, and power rating, with common header aliases accepted. The page previews row counts and sends both genders only after local validation succeeds.

## Safety

Only admins can read/write stored fencer inputs or invoke recalculation. Recalculation is transactional. Existing overrides and SPI scores remain unchanged. Errors name unknown teams, malformed ratings, invalid weapons, or missing SPI result rows.
