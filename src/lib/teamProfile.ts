// Verified profile IDs from https://usfca.org/ncaa-teams-and-coaches/.
// USFCA uses one published profile for both programs at a school.
const profileGroups = [
    [37, 48], [50, 82], [2], [8, 51], [32, 52], [1], [83, 92],
    [43, 56], [6, 57], [11], [12, 55], [10, 54], [59, 80],
    [9, 60], [36, 61], [65, 86], [66, 87], [46], [18, 67],
    [5, 30], [4, 34], [3, 28], [44, 26], [22, 75], [27],
    [21, 76], [7, 20], [14, 89], [33, 47], [40], [90, 91], [41, 88],
];
const profiles = new Map(profileGroups.flatMap(([profile, ...others]) =>
    [profile, ...others].map((teamId) => [teamId, profile] as const)));

export function teamProfileUrl(teamId: number): string | undefined {
    const profile = profiles.get(teamId);
    return profile == null ? undefined : `https://usfca.org/college-team-profile/?InstitutionId=${profile}`;
}
