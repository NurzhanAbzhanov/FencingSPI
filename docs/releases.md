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

## WordPress 1.5.3

- Publish October 2026-27 from submitted votes through the existing public publication store, with frozen points, tie-aware ranks, and first-place counts.
- Repair the admin Publish action to use the deployed votes schema rather than retired ballot tables.
- Make 2026-27 active and the default website season.
- Show current-season schools and their latest published poll ranks before SPI is calculated. Uncalculated SPI and unranked schools stay blank in exports.
- Do not create or carry forward any current-season SPI or PR records.

## WordPress 1.5.4

- Published ranking cutoffs: Team Overall 15, Squad Overall 12, and Division III Team/Squad 8.
- Apply cutoffs consistently to poll results, CSV exports, and published poll ranks on the SPI standings page.
- Preserve all teams tied at the cutoff rank. Preserve original ballots, point calculations, and complete stored snapshots.
- Ballot sizes, individual ballot inspection, and unpublished live results are unchanged.

## WordPress 1.5.5

- Add Publish results to closed polls in Manage Polls, with confirmation, progress, and server error feedback.
- Use the existing administrator-only publication function and refresh the displayed status after success.
- Distinguish Draft, Open, Closed, and Published rather than collapsing all inactive polls to Closed.
- Add a Public results link for published polls and prevent accidental reopen, rescheduling, or deletion through this page.
- Exclude published polls from automatic opening.

## WordPress 1.5.6

- Display top 15 Team Overall and Squad Overall ranks, and top 10 DIII Team ranks, preserving cutoff ties.
- Require ten schools on future DIII Team ballots in the UI and server validation; award ten through one points when publishing them.
- Preserve October's existing eight-school DIII ballots and published points. Individual ballot tables use their original lengths.
- Order results and exports: Team Overall Men/Women, Team DIII Men/Women, Epee Men/Women, Foil Men/Women, Sabre Men/Women.
- Existing hidden DIII squad ballot rules and their publication cutoffs are unchanged.

## WordPress 1.5.1

- Resolve the current poll to its real ID before loading both aggregate and individual ballots.
- Display individual-ballot loading errors instead of silently hiding the feature.
- Include the existing participation, password management, signup, feedback, and ballot security updates in the versioned source snapshot.
- Keep database privacy rules intact: administrators can inspect ballots; committee access to other members' ballots opens after the poll closes.
