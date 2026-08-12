# NCAA Fencing SPI Platform

The Vite frontend runs as a static site and uses the checked-in 2025-26 season snapshot by default. When Supabase variables are present, committee authentication, ballots, poll administration, and newly added programs use Supabase.

## Local development

```bash
npm install
npm run dev
```

## Supabase setup

1. Create or link a Supabase project.
2. Apply all migrations in filename order from `supabase/migrations`, then load `supabase/seed.sql`. Use `supabase db reset` locally, or `supabase link` and `supabase db push` for the linked project.
3. Add an email in Admin > Coaches and administrators, then send that address a Supabase Auth invitation. The access grant controls the profile created when the invitation is accepted.
4. Assign `role = 'admin'` for platform administrators and `can_vote = true` only for committee members who receive ballots. These permissions are independent.
5. Set these variables locally and in Vercel for Production, Preview, and Development:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

The migrations apply row-level security. Assigned voters can edit only their own ballots while a poll is open. Individual ballots become committee-visible only after close. Public users see only published aggregate poll results. Match results are publicly readable, but only administrators can add, edit, or delete match records.

Opening a poll automatically captures an immutable snapshot of the calculated Team, Epee, Foil, and Sabre SPI rows for every active program. Ballots always use this calculated snapshot; there is no manual poll SPI upload path.

## Poll routes

```text
#/polls                              Committee dashboard
#/polls/vote/<category>              Numbered-slot ballot
#/polls/results/<period-id>           Committee results and closed ballots
#/polls/public/<period-id>            Anonymous published results
#/admin/polls                         Poll scheduling and state
#/admin/coaches                       Committee access grants
#/admin/participation/<period-id>     Participation tracking
```

## Verification

```bash
npm test
npm run test:db
npm run lint
npm run build
```
