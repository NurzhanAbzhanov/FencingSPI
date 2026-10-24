# Release Workflow

For every completed update:

1. Run the test suite and production build.
2. Commit and push the source changes to GitHub, incorporating remote changes without overwriting them.
3. Deploy the same commit to the production Vercel project and verify it.
4. For WordPress updates, rebuild `artifacts/ncaa-fencing.zip` and increment the plugin version.
5. Report the commit, deployment status, and whether the WordPress ZIP still needs installing.

Do not report a deployment as complete when authentication or deployment verification is blocked.

## 2026-10-21 Committee Ballot Visibility

- Active committee voters can view other members' submitted ballots while voting is open as well as after closing.
- Other voters' drafts remain private; anonymous and noncommittee accounts cannot read individual ballots.
- Submitted ballot locking and admin-only reset/delete rules are unchanged.
- Database-only change: existing WordPress installations need no replacement ZIP.

## WordPress 1.5.2

- Fix local DIII logos in coaches poll views when embedded in WordPress.
- Allow a changed school/logo URL to load after a previous image failure.
- Export the selected results tab with poll/download metadata and separate category tables, repeated column headers, and blank separators.
- Add UTF-8 BOM to CSV downloads for Excel compatibility.

## WordPress 1.5.1

- Resolve the current poll to its real ID before loading both aggregate and individual ballots.
- Display individual-ballot loading errors instead of silently hiding the feature.
- Include the existing participation, password management, signup, feedback, and ballot security updates in the versioned source snapshot.
- Keep database privacy rules intact: administrators can inspect ballots; committee access to other members' ballots opens after the poll closes.
