# NCAA Fencing WordPress installation

1. In WordPress, open Plugins > Add New > Upload Plugin.
2. Upload ncaa-fencing.zip, install, then activate NCAA Fencing.
3. Create a page named Fencing Review. Set Visibility to **Private** before saving.
4. Add a Shortcode block containing `[ncaa_fencing]` and save the private page.
5. Open View Page while signed in to WordPress. Use the app's Login button to sign in with your existing Supabase account.
6. Give reviewers WordPress access that can read private pages. WordPress login does not grant app administrator or voting privileges.

The app loads only on a page containing the shortcode. Do not add the page to public menus during review. Use one shortcode per page. A full-width page template usually provides the best space for standings and ballots.

## Existing backend

This package uses the existing production Supabase project. Match edits, ratings, and votes affect real data. Private visibility is not a separate test database. Viewing standings is read-only. Test writes only with deliberately chosen test data and season.

The plugin does not import the WordPress database, create pages, change navigation, or create WordPress users. It contains browser-public Supabase configuration, not a service-role key or database password. Database permissions continue to enforce administrator and voter access.

## Invitations and password recovery

Existing password login works without changing Supabase's Site URL. Until the new pages are approved, keep the current Vercel authentication links in place.

To test email links on WordPress later, add the exact review page URL with `?ncaa_fencing_app=1` to Supabase Authentication > URL Configuration > Redirect URLs, for example:

`https://usfca.org/fencing-review/?ncaa_fencing_app=1`

Use that same URL as redirectTo when generating the invitation or recovery link. Reviewers must already be logged into WordPress to access the private destination. Do not change the production Site URL until the new public destination is approved.

## Review checklist

- Logged-out visitors cannot open the private page or its frame endpoint.
- SPI season/gender/weapon filtering, school logos, results, and CSV downloads work.
- App login, permitted admin pages, and voting pages work with the appropriate Supabase account.
- Check both phone and desktop widths, including the coaches ballot.
- Exclude the review page and its query-string endpoint from any hosting/CDN page cache. The frame sends no-cache headers, but an upstream cache must respect them.

## Approval and removal

After approval, change the page visibility to Public and add its link to navigation. App admin and voting actions still require Supabase login. Deactivating the plugin removes the embed functionality without deleting any Supabase data.

## Updating

Version 1.5.0 adds public SID Signup with required name, school and email and a private SID registrations list in Admin. Apply `202610030001_sid_signup.sql` before installing. Registration records contact details and does not create a login or send email. Version 1.4.0 added Give Feedback and a private admin inbox (`202609160001_site_feedback.sql`). Version 1.3.0 added verified USFCA school-profile links and preserved standings filters and sorting when switching seasons. Schools absent from the directory remain plain text; season results are available through the separate View action. Version 1.2.0 added the Innovation Hub footer, historical published polls, and the upcoming 2026-27 season with four poll columns. Apply the September 15 archive migrations before running this build against another database.

Version 1.1.0 adds a compact WordPress-only navigation and standings layout. The standalone app is unchanged.

In Elementor, use the Elementor Full Width page layout (not Canvas, which removes the site header). Set the shortcode's parent container to full width, with width 100%, no large top margin, and about 16px side padding. Keep the page private. The plugin cannot override the enclosing Elementor container's width from inside its isolated frame.

On narrow screens the standings table scrolls horizontally to preserve readable data; on desktop all columns fit when the frame is at least 952px wide.

Upload a new ZIP with the same plugin name and select Replace current with uploaded. Configuration and data are held in Supabase. Build from the repository with `node scripts/package-wordpress.mjs` (after installing dependencies and configuring the public Vite Supabase environment variables).
