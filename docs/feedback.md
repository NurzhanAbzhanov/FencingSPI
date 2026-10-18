# Built-in feedback

The gold Give Feedback button opens a native modal dialog without navigating away.
Public visitors can submit a category, message, optional email and screenshot. The
form attaches a sanitized page URL, season and active standings filters. It never
copies URL query parameters, authentication fragments, user identity or form data.
Screenshots are explicitly selected, resized to 1400 pixels and re-encoded as JPEG
without original metadata. Each attachment is capped at approximately 512 KB.

The private `site_feedback` table stores messages and attachments. Only active
profile administrators can read records or update their New/In Progress/Resolved
status. Admin > Feedback inbox loads the latest 50 records, with Load more for
older records. Screenshots load only when requested. There are no email notifications.

Public submissions use `submit_site_feedback`, not table INSERT access. Server
validation, a honeypot, idempotent request IDs and transaction-serialized quotas
limit submissions: 3 per browser client ID per 10 minutes, 30 globally per hour,
150 globally per day. Browser IDs can be reset, so they are not an identity or
strong bot protection. The global cap limits stored spam, but targeted abuse can
temporarily exhaust capacity. Add a server-verified CAPTCHA if that occurs.

Apply `202609160001_site_feedback.sql` before installing plugin 1.4.0. The frontend
reports failure and preserves the draft if the backend is not available; it never
pretends that local-only storage is a successful submission. The WordPress plugin
must be replaced with the rebuilt ZIP for the visible UI update.
