# NCAA Fencing SPI Platform

The Vite frontend runs as a static site and uses the checked-in 2025-26 season snapshot by default. When Supabase variables are present, committee authentication, ballots, poll administration, and newly added programs use Supabase.

## Local development

```bash
npm install
npm run dev
```

## Supabase setup

1. Create or link a Supabase project.
2. Apply all migrations in `supabase/migrations`, then load `supabase/seed.sql`. Use `supabase db reset` locally, or `supabase link` and `supabase db push` before loading the seed in production.
3. Create committee users in Supabase Auth. A database trigger creates their `public.profiles` row automatically.
4. Assign `role = 'admin'` for platform administrators and `can_vote = true` only for committee members who receive ballots. Admin and voting permissions are independent.
5. Set these variables locally and in Vercel for Production, Preview, and Development:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

The migrations apply row-level security. Assigned voters can edit only their own ballots while a poll is open. Individual ballots become committee-visible only after close. Public users see only published aggregate poll results. Match results are publicly readable, but only administrators can add, edit, or delete match records.

## Verification

```bash
npm run lint
npm run build
```
