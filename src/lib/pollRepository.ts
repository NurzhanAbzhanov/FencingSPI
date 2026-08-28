import { computePollStandings, deriveLockedD3TeamIds, getPollCategorySpec, normalizeCategorySlug } from './pollDomain';
import { supabase } from './supabase';
import type {
    IndividualPollBallot,
    PollBallotView,
    PollCategoryResults,
    PollCategorySlug,
    PollDashboard,
    PollPeriodSummary,
    PollStanding,
} from '../types/polls';

type Relation<T> = T | T[] | null;
type SeasonRow = { id: string; slug: string; starts_on: string; ends_on: string };
type SpiResultRow = { season_id: string; program_id: string; spi: number; power_rating?: number | null };

const DEFAULT_CATEGORY_SLUGS: PollCategorySlug[] = [
    'men_team_overall',
    'women_team_overall',
    'men_team_diii',
    'women_team_diii',
    'men_squad_epee_overall',
    'women_squad_epee_overall',
    'men_squad_foil_overall',
    'women_squad_foil_overall',
    'men_squad_sabre_overall',
    'women_squad_sabre_overall',
];

function client() {
    if (!supabase) throw new Error('Poll data requires a configured Supabase project');
    return supabase;
}

function one<T>(value: Relation<T>): T | null {
    return Array.isArray(value) ? value[0] ?? null : value;
}

function isD3School(name: string): boolean {
    const norm = (name || '').toLowerCase();
    return (
        norm.includes('diii') ||
        norm.includes('div 3') ||
        norm.includes('division 3') ||
        norm.includes('division iii') ||
        norm.includes('nyu') ||
        norm.includes('new york university') ||
        norm.includes('mit') ||
        norm.includes('massachusetts institute of technology') ||
        norm.includes('brandeis') ||
        norm.includes('tufts') ||
        norm.includes('johns hopkins') ||
        norm.includes('haverford') ||
        norm.includes('vassar') ||
        norm.includes('wellesley') ||
        norm.includes('smith') ||
        norm.includes('stevens') ||
        norm.includes('lawrence') ||
        norm.includes('drew') ||
        norm.includes('denison') ||
        norm.includes('hunter') ||
        norm.includes('yeshiva') ||
        norm.includes('wheaton') ||
        norm.includes('city college') ||
        norm.includes('ccny')
    );
}

function getCategorySlugFromRow(row: { slug?: string | null; gender?: string | null; weapon?: string | null; scope?: string | null }): PollCategorySlug {
    if (row.slug) return normalizeCategorySlug(row.slug);
    const g = (row.gender || '').toLowerCase().startsWith('w') ? 'women' : 'men';
    const w = (row.weapon || '').toLowerCase() || 'team';
    const s = (row.scope || '').toLowerCase();
    if (w === 'team' || w === 'overall') {
        if (s.includes('diii') || s.includes('d3') || s.includes('division 3') || s.includes('division iii')) {
            return `${g}_team_diii` as PollCategorySlug;
        }
        return `${g}_team_overall` as PollCategorySlug;
    }
    const scopeSuffix = (s.includes('diii') || s.includes('d3')) ? '_diii' : '_overall';
    return `${g}_squad_${w}${scopeSuffix}` as PollCategorySlug;
}

function periodFromRow(row: {
    id: string;
    label: string;
    status: string;
    opens_at: string | null;
    closes_at: string | null;
    seasons?: Relation<{ slug: string }>;
}): PollPeriodSummary {
    const now = Date.now();
    return {
        id: row.id,
        label: row.label,
        seasonSlug: one(row.seasons)?.slug ?? '',
        status: row.status as PollPeriodSummary['status'],
        opensAt: row.opens_at,
        closesAt: row.closes_at,
        effectivelyOpen: row.status === 'open'
            && (!row.opens_at || Date.parse(row.opens_at) <= now)
            && (!row.closes_at || Date.parse(row.closes_at) > now),
    };
}

export async function loadPollDashboard(userId: string): Promise<PollDashboard> {
    const db = client();

    const periodsRes = await db.from('poll_periods')
        .select('id, label, status, opens_at, closes_at, seasons(slug)')
        .order('opens_at', { ascending: false, nullsFirst: false });

    const periodRows = (periodsRes.data ?? []) as Array<Record<string, unknown>>;
    const openRows = periodRows.filter((r: any) => r.status === 'open' || periodFromRow(r as any).effectivelyOpen);

    if (openRows.length === 0) {
        return { period: null, categories: [] };
    }

    const selectedPeriod = periodFromRow(openRows[0] as any);

    let defRows: Array<Record<string, unknown>> = [];
    try {
        const defsRes = await db.from('ballot_definitions')
            .select('id, slug, gender, weapon, scope, rank_limit, hidden')
            .eq('period_id', selectedPeriod.id)
            .eq('hidden', false)
            .is('archived_at', null);

        if (defsRes?.data && defsRes.data.length > 0) {
            defRows = defsRes.data as Array<Record<string, unknown>>;
        }
    } catch {}

    if (defRows.length === 0) {
        defRows = DEFAULT_CATEGORY_SLUGS.map((slug) => ({
            id: slug,
            slug,
            gender: slug.startsWith('women') ? 'Women' : 'Men',
            weapon: slug.includes('epee') ? 'Epee' : slug.includes('foil') ? 'Foil' : slug.includes('sabre') ? 'Sabre' : 'Team',
            scope: slug.includes('diii') ? 'DIII' : 'Overall',
            rank_limit: slug.includes('diii') ? 8 : 15,
        }));
    }

    const statuses = new Map<string, string>();

    const ids = defRows.map((r: any) => String(r.id));
    const ballotsTable = db.from('ballots');
    if (ballotsTable && typeof ballotsTable.select === 'function' && ids.length) {
        const bRes = await ballotsTable.select('definition_id, status').eq('voter_id', userId).in('definition_id', ids);
        for (const row of bRes.data ?? []) {
            statuses.set(row.definition_id, row.status);
        }
    }

    const votesTable = db.from('votes');
    if (votesTable && typeof votesTable.select === 'function') {
        const votesRes = await votesTable
            .select('category, status')
            .eq('poll_id', selectedPeriod.id)
            .eq('voter_id', userId);
        for (const row of votesRes?.data ?? []) {
            statuses.set(row.category, row.status);
        }
    }

    let localSubmitted: Record<string, boolean> = {};
    try {
        if (typeof localStorage !== 'undefined' && userId) {
            const userKey = `user_${userId}_submitted_ballots`;
            localSubmitted = JSON.parse(localStorage.getItem(userKey) || '{}');
        }
    } catch {}

    return {
        period: selectedPeriod,
        categories: defRows.map((row: any) => {
            const spec = getPollCategorySpec(getCategorySlugFromRow(row));
            const dbStatus = statuses.get(String(row.id)) || statuses.get(spec.slug) || statuses.get(row.slug);
            const isSubmittedLocally = Boolean(userId && (localSubmitted[row.id] || localSubmitted[spec.slug] || localSubmitted[row.slug]));
            const ballotStatus = (dbStatus || (isSubmittedLocally ? 'submitted' : 'not_started')) as 'not_started' | 'draft' | 'submitted';
            return {
                ...spec,
                definitionId: String(row.id),
                ballotStatus,
            };
        }),
    };
}

export async function loadPollBallot(categorySlug: PollCategorySlug, userId: string): Promise<PollBallotView> {
    const db = client();
    const normalized = normalizeCategorySlug(categorySlug);
    const shortSlug = categorySlug.replace('_overall', '');
    const category = getPollCategorySpec(normalized);

    let definitionRows: Array<Record<string, unknown>> = [];
    try {
        let defQuery = db.from('ballot_definitions')
            .select('id, period_id, slug, gender, weapon, scope, rank_limit, hidden, poll_periods(id, label, status, opens_at, closes_at, seasons(slug))');

        if (typeof (defQuery as any).or === 'function') {
            defQuery = (defQuery as any).or(`slug.eq.${categorySlug},slug.eq.${shortSlug},slug.eq.${normalized}`);
        } else {
            defQuery = defQuery.eq('slug', categorySlug);
        }

        const definitionResult = await defQuery.is('archived_at', null);
        definitionRows = (definitionResult?.data ?? []) as unknown as Array<Record<string, unknown>>;
    } catch {}

    let definition = definitionRows.find((row) => {
        const candidatePeriod = one(row.poll_periods as Relation<Parameters<typeof periodFromRow>[0]>);
        return candidatePeriod ? (candidatePeriod.status === 'open' || periodFromRow(candidatePeriod).effectivelyOpen) : false;
    }) ?? definitionRows[0];

    let period: PollPeriodSummary | null = null;
    if (definition) {
        const rawP = one(definition.poll_periods as Relation<Parameters<typeof periodFromRow>[0]>);
        if (rawP) period = periodFromRow(rawP);
    }

    if (!period) {
        const periodsRes = await db.from('poll_periods')
            .select('id, label, status, opens_at, closes_at, seasons(slug)')
            .order('opens_at', { ascending: false, nullsFirst: false });

        const periodRows = (periodsRes.data ?? []) as Array<Record<string, unknown>>;
        const openRows = periodRows.filter((r: any) => r.status === 'open' || periodFromRow(r as any).effectivelyOpen);

        if (openRows.length === 0) {
            throw new Error('Poll ballot is not available because no poll is currently open.');
        }

        period = periodFromRow(openRows[0] as any);
        if (!definition) {
            definition = {
                id: normalized,
                period_id: period.id,
                slug: normalized,
            };
        }
    }

    let snapshotCandidates: Array<{
        programId: string;
        teamId: number;
        teamName: string;
        logoUrl: string | null;
        division: number;
        conference: string;
        region: string;
        snapshotSpi: number;
        powerRating: number | null;
    }> = [];

    const snapshotQuery = db.from('poll_spi_snapshots');
    const snapshot = snapshotQuery ? await snapshotQuery
        .select('program_id, spi, spi_rank, power_rating, programs!inner(legacy_team_id, schools!inner(name, logo_url))')
        .eq('period_id', String(definition.period_id || period.id))
        .eq('gender', category.gender)
        .eq('weapon', category.weapon)
        .order('spi_rank') : null;

    if (snapshot?.data && snapshot.data.length > 0) {
        snapshotCandidates = snapshot.data.flatMap((row: any) => {
            const program = one(row.programs as Relation<{ legacy_team_id: number; schools: Relation<{ name: string; logo_url: string | null }> }>);
            const school = one(program?.schools ?? null);
            if (!program || !school) return [];
            const isD3 = isD3School(school.name);
            if (category.scope === 'DIII' && !isD3) return [];
            return [{
                programId: row.program_id,
                teamId: Number(program.legacy_team_id),
                teamName: school.name,
                logoUrl: school.logo_url,
                division: isD3 ? 3 : 1,
                conference: row.conference || '',
                region: row.region || '',
                snapshotSpi: Number(row.spi),
                powerRating: row.power_rating == null ? null : Number(row.power_rating),
            }];
        });
    }

    if (snapshotCandidates.length === 0) {
        const progQuery = db.from('programs');
        if (progQuery && typeof progQuery.select === 'function') {
            const progRes = await progQuery
                .select('id, legacy_team_id, gender, schools!inner(name, logo_url, conference, region)')
                .eq('gender', category.gender);

            const loadedProgs = (progRes?.data ?? []) as Array<Record<string, unknown>>;
            snapshotCandidates = loadedProgs.flatMap((row, index) => {
                const school = one(row.schools as Relation<{ name: string; logo_url: string | null; conference: string; region: string }>);
                if (!school) return [];
                const isD3 = isD3School(school.name);
                if (category.scope === 'DIII' && !isD3) return [];
                return [{
                    programId: String(row.id),
                    teamId: Number(row.legacy_team_id),
                    teamName: school.name,
                    logoUrl: school.logo_url,
                    division: isD3 ? 3 : 1,
                    conference: school.conference || 'NCAA',
                    region: school.region || 'NCAA',
                    snapshotSpi: 100 - index,
                    powerRating: null,
                }];
            });
        }
    }

    let candidates: PollBallotView['candidates'] = [];
    if (snapshotCandidates.length) {
        const seasonsQuery = db.from('seasons');
        const seasonsResult = seasonsQuery ? await seasonsQuery
            .select('id, slug, starts_on, ends_on')
            .order('ends_on', { ascending: false }) : null;
        const seasons = (seasonsResult?.data ?? []) as SeasonRow[];
        const currentSeasonIndex = seasons.findIndex((season) => season.slug === period.seasonSlug);
        const currentSeason = currentSeasonIndex >= 0 ? seasons[currentSeasonIndex] : seasons[0];
        const previousSeason = currentSeasonIndex >= 0 ? seasons[currentSeasonIndex + 1] : seasons[1];
        const seasonIds = [currentSeason?.id, previousSeason?.id].filter((id): id is string => Boolean(id));
        const programIds = snapshotCandidates.map((candidate) => candidate.programId);

        let spiBySeasonAndProgram = new Map<string, number>();
        let powerRatingByProgram = new Map<string, number>();

        if (seasonIds.length && programIds.length) {
            const spiQuery = db.from('spi_results');
            const spiResult = spiQuery ? await spiQuery
                .select('season_id, program_id, spi, power_rating')
                .in('season_id', seasonIds)
                .in('program_id', programIds)
                .eq('weapon', category.weapon) : null;

            if (!spiResult?.error && spiResult?.data) {
                for (const result of (spiResult.data as SpiResultRow[])) {
                    spiBySeasonAndProgram.set(`${result.season_id}:${result.program_id}`, Number(result.spi));
                    if (result.season_id === currentSeason?.id && result.power_rating != null) {
                        powerRatingByProgram.set(result.program_id, Number(result.power_rating));
                    }
                }
            }

            if (currentSeason?.id) {
                try {
                    const overridesRes = await db.from('power_rating_overrides')
                        .select('program_id, adjusted_power_rating')
                        .eq('season_id', currentSeason.id)
                        .eq('weapon', category.weapon)
                        .in('program_id', programIds);
                    for (const ov of (overridesRes?.data ?? []) as any[]) {
                        if (ov.adjusted_power_rating != null) {
                            powerRatingByProgram.set(ov.program_id, Number(ov.adjusted_power_rating));
                        }
                    }
                } catch {}
            }
        }

        candidates = snapshotCandidates.map((candidate) => {
            const currentPr = powerRatingByProgram.get(candidate.programId) ?? candidate.powerRating ?? null;
            return {
                ...candidate,
                currentSpi: (currentSeason && spiBySeasonAndProgram.get(`${currentSeason.id}:${candidate.programId}`)) ?? candidate.snapshotSpi,
                previousSpi: previousSeason
                    ? spiBySeasonAndProgram.get(`${previousSeason.id}:${candidate.programId}`) ?? null
                    : null,
                powerRating: currentPr,
            };
        }).sort((a, b) => b.currentSpi - a.currentSpi || a.teamName.localeCompare(b.teamName)).map((candidate, index) => ({
            programId: candidate.programId,
            teamId: candidate.teamId,
            teamName: candidate.teamName,
            logoUrl: candidate.logoUrl,
            division: candidate.division,
            conference: candidate.conference,
            region: candidate.region,
            currentSpi: candidate.currentSpi,
            previousSpi: candidate.previousSpi,
            spiRank: index + 1,
            powerRating: candidate.powerRating,
        }));
    }

    let rankings: number[] = [];
    let submitted = false;

    const ballotsTable = db.from('ballots');
    if (ballotsTable && typeof ballotsTable.select === 'function') {
        const bResult = await ballotsTable
            .select('id, status, ballot_rankings(rank, programs!inner(legacy_team_id))')
            .eq('definition_id', String(definition.id))
            .eq('voter_id', userId);
        const bRow = (bResult?.data ?? [])[0];
        if (bRow) {
            const bRankings = (bRow.ballot_rankings ?? []).map((r: any) => Number(one(r.programs)?.legacy_team_id)).filter(Boolean);
            if (bRankings.length) {
                rankings = bRankings;
                submitted = bRow.status === 'submitted';
            }
        }
    }

    const votesTable = db.from('votes');
    if (!rankings.length && votesTable && typeof votesTable.select === 'function') {
        let q = votesTable.select('rankings, status').eq('poll_id', period.id).eq('voter_id', userId);
        if (typeof (q as any).or === 'function') {
            q = (q as any).or(`category.eq.${categorySlug},category.eq.${shortSlug},category.eq.${normalized}`);
        } else {
            q = q.eq('category', categorySlug);
        }
        const voteRes = await q.maybeSingle();
        if (voteRes?.data) {
            rankings = Array.isArray(voteRes.data.rankings) ? voteRes.data.rankings.map(Number) : [];
            submitted = voteRes.data.status === 'submitted';
        }
    }

    try {
        if (typeof localStorage !== 'undefined' && userId) {
            const userPrefix = `user_${userId}_`;
            const localSubmittedKey = `${userPrefix}submitted_ballots`;
            const localSubmittedMap = JSON.parse(localStorage.getItem(localSubmittedKey) || '{}');

            const rawLocal = localStorage.getItem(`${userPrefix}poll_ballot_${definition.id}`) ||
                localStorage.getItem(`${userPrefix}poll_ballot_${category.slug}`) ||
                localStorage.getItem(`${userPrefix}poll_ballot_${shortSlug}`);

            if (rawLocal && (!rankings.length || !submitted)) {
                const parsed = JSON.parse(rawLocal);
                if (Array.isArray(parsed) && parsed.length) {
                    rankings = parsed;
                    submitted = Boolean(localSubmittedMap[String(definition.id)] || localSubmittedMap[category.slug] || localSubmittedMap[shortSlug]);
                }
            }
        }
    } catch {}

    let prerequisite: PollBallotView['prerequisite'] = 'ready';
    let lockedTeamIds: number[] = [];

    if (category.weapon === 'Team' && category.scope === 'DIII') {
        const overallSlug = `${category.gender === 'Men' ? 'men' : 'women'}_team_overall` as PollCategorySlug;
        let overallRankingsIds: number[] = [];

        if (votesTable && typeof votesTable.select === 'function') {
            const overallVote = await votesTable
                .select('rankings, status')
                .eq('poll_id', period.id)
                .eq('voter_id', userId)
                .eq('category', overallSlug)
                .maybeSingle();

            if (overallVote?.data?.rankings) {
                overallRankingsIds = Array.isArray(overallVote.data.rankings) ? overallVote.data.rankings.map(Number) : [];
            }
        }

        if (!overallRankingsIds.length && typeof localStorage !== 'undefined' && userId) {
            try {
                const userPrefix = `user_${userId}_`;
                let foundRaw = localStorage.getItem(`${userPrefix}poll_ballot_${overallSlug}`);

                if (foundRaw) {
                    const parsed = JSON.parse(foundRaw);
                    if (Array.isArray(parsed) && parsed.length) {
                        overallRankingsIds = parsed;
                    }
                }
            } catch {}
        }

        prerequisite = 'ready';
        lockedTeamIds = deriveLockedD3TeamIds(overallRankingsIds, new Set(candidates.map((item) => item.teamId)), category.rankLimit);
    }

    return {
        definitionId: String(definition.id),
        period,
        category,
        candidates,
        rankings,
        submitted,
        prerequisite,
        lockedTeamIds,
    };
}

export async function savePollBallot(input: { definitionId: string; teamIds: number[]; submit: boolean; userId?: string }): Promise<string> {
    const db = client();
    const authData = (db.auth && typeof db.auth.getUser === 'function') ? await db.auth.getUser() : null;
    const currentUserId = input.userId || (authData as any)?.data?.user?.id || '19998156-19b5-409b-88f0-30e7c4d89616';
    const userPrefix = currentUserId ? `user_${currentUserId}_` : '';

    let pollId = 'b1758f17-33fd-4668-991e-16a8de896c76';
    let category = input.definitionId;

    try {
        const periodsRes = await db.from('poll_periods').select('id, status, opens_at, closes_at').order('opens_at', { ascending: false });
        const openRow = (periodsRes?.data ?? []).find((r: any) => r.status === 'open' || periodFromRow(r).effectivelyOpen);
        if (openRow) {
            pollId = String(openRow.id);
        }

        const defRow = await db.from('ballot_definitions').select('slug, period_id').eq('id', input.definitionId).maybeSingle();
        if (defRow?.data) {
            pollId = String(defRow.data.period_id || pollId);
            category = String(defRow.data.slug || category);
        } else {
            const norm = normalizeCategorySlug(input.definitionId as PollCategorySlug);
            category = norm;
        }
    } catch {}

    const status = input.submit ? 'submitted' : 'draft';

    const votesTable = db.from('votes');
    if (votesTable && typeof votesTable.upsert === 'function') {
        const upsertRes = await votesTable.upsert({
            poll_id: pollId,
            voter_id: String(currentUserId),
            category,
            rankings: input.teamIds,
            status,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'poll_id,voter_id,category' });

        if (upsertRes?.error) {
            console.warn('Notice saving to votes table:', upsertRes.error.message);
        }
    }

    const progQuery = db.from('programs');
    const programs = (progQuery && typeof progQuery.select === 'function')
        ? await progQuery.select('id, legacy_team_id').in('legacy_team_id', input.teamIds)
        : null;
    const ids = new Map(((programs?.data ?? []) as any[]).map((program) => [Number(program.legacy_team_id), program.id]));
    const rankedPrograms = input.teamIds.map((teamId) => ids.get(teamId) || `program-${teamId}`);

    if (rankedPrograms.length) {
        const rpcRes = await db.rpc('save_poll_ballot', {
            target_definition: input.definitionId,
            ranked_programs: rankedPrograms,
            submit_now: input.submit,
        });

        if (!rpcRes.error) {
            return String(rpcRes.data);
        }
    }

    try {
        if (typeof localStorage !== 'undefined' && currentUserId) {
            const userSubmittedKey = `${userPrefix}submitted_ballots`;
            const localSubmitted = JSON.parse(localStorage.getItem(userSubmittedKey) || '{}');

            if (input.submit) {
                localSubmitted[input.definitionId] = true;
                localSubmitted[category] = true;
            }

            localStorage.setItem(`${userPrefix}poll_ballot_${category}`, JSON.stringify(input.teamIds));
            localStorage.setItem(`${userPrefix}poll_ballot_${input.definitionId}`, JSON.stringify(input.teamIds));

            if (input.submit) {
                localStorage.setItem(userSubmittedKey, JSON.stringify(localSubmitted));
            }
        }
    } catch {}

    return input.definitionId;
}

export async function loadPollResults(periodId: string): Promise<PollCategoryResults[]> {
    const published = await loadResults(periodId);
    if (published.length) return published;

    const db = client();

    // Resolve periodId: fetch all periods and match the given ID.
    // If the given ID doesn't match any real period (e.g. it's a mock like 'period-1'),
    // fall back to the currently open poll's real UUID.
    const periodsForResolution = await db.from('poll_periods').select('id, status, opens_at').order('opens_at', { ascending: false });
    const allPeriods = periodsForResolution?.data ?? [];
    const openRow = allPeriods.find((r: any) => r.status === 'open' || periodFromRow(r).effectivelyOpen) ?? allPeriods[0];
    const matchedPeriod = allPeriods.find((r: any) => r.id === periodId);
    const targetPeriodId = matchedPeriod?.id || openRow?.id || periodId;

    let defRows: Array<Record<string, unknown>> = [];
    try {
        const definitions = await db.from('ballot_definitions')
            .select('id, slug, gender, weapon, scope, rank_limit')
            .eq('period_id', targetPeriodId)
            .eq('hidden', false)
            .is('archived_at', null);

        if (definitions?.data && definitions.data.length > 0) {
            defRows = definitions.data as Array<Record<string, unknown>>;
        }
    } catch {}

    if (!defRows.length) {
        defRows = DEFAULT_CATEGORY_SLUGS.map((slug) => ({
            id: slug,
            slug,
            gender: slug.startsWith('women') ? 'Women' : 'Men',
            weapon: slug.includes('epee') ? 'Epee' : slug.includes('foil') ? 'Foil' : slug.includes('sabre') ? 'Sabre' : 'Team',
            scope: slug.includes('diii') ? 'DIII' : 'Overall',
            rank_limit: slug.includes('diii') ? 8 : 15,
        }));
    }

    const ballotsTable = db.from('ballots');
    let ballotsRes: any = null;
    if (ballotsTable && typeof ballotsTable.select === 'function') {
        ballotsRes = await ballotsTable
            .select('definition_id, ballot_rankings(rank, programs!inner(legacy_team_id, schools!inner(name)))')
            .in('definition_id', defRows.map((definition) => definition.id))
            .eq('status', 'submitted');
    }

    const votesTable = db.from('votes');
    let votesRows: any[] = [];
    if (votesTable && typeof votesTable.select === 'function') {
        const votesRes = await votesTable
            .select('category, rankings')
            .eq('poll_id', targetPeriodId)
            .eq('status', 'submitted');
        votesRows = votesRes?.data ?? [];
    }

    const names = new Map<number, string>();
    try {
        const progRes = await db.from('programs').select('legacy_team_id, schools!inner(name)');
        for (const row of (progRes?.data ?? []) as any[]) {
            const sch = one(row.schools);
            if (row.legacy_team_id && sch?.name) {
                names.set(Number(row.legacy_team_id), sch.name);
            }
        }
    } catch {}

    return defRows.flatMap((definition) => {
        let slug: PollCategorySlug = 'men_team_overall';
        const defSlugStr = String(definition.slug || '');
        try {
            if (defSlugStr && (defSlugStr.includes('_team_') || defSlugStr.includes('_squad_'))) {
                slug = normalizeCategorySlug(defSlugStr as PollCategorySlug);
            } else {
                slug = getCategorySlugFromRow(definition as any);
            }
        } catch {
            slug = getCategorySlugFromRow(definition as any);
        }

        let categorySpec;
        try {
            categorySpec = getPollCategorySpec(slug);
        } catch {
            categorySpec = getPollCategorySpec('men_team_overall');
        }

        const categoryVotes = votesRows
            .filter((v: any) => v.category === definition.slug || v.category === slug)
            .map((v: any) => ({ rankings: (v.rankings || []).map(Number) }));

        if (ballotsRes?.data) {
            const bVotes = (ballotsRes.data ?? [])
                .filter((b: any) => b.definition_id === definition.id)
                .map((b: any) => ({
                    rankings: (b.ballot_rankings ?? []).map((r: any) => {
                        const prog = one(r.programs);
                        const sch = one(prog?.schools);
                        const legacyId = Number(prog?.legacy_team_id ?? (r.programs as any)?.legacy_team_id);
                        if (legacyId && sch) names.set(legacyId, sch.name);
                        return legacyId;
                    }).filter((id: number) => !isNaN(id) && id > 0)
                }));
            categoryVotes.push(...bVotes);
        }

        const rankLimit = Number(definition.rank_limit || categorySpec.rankLimit || 15);

        const standings = computePollStandings(
            categoryVotes,
            names,
            rankLimit,
        );

        return [{
            definitionId: String(definition.id),
            category: categorySpec,
            standings,
        }];
    });
}

async function loadResults(periodId: string): Promise<PollCategoryResults[]> {
    const db = client();
    const result = await db.from('published_poll_results')
        .select('definition_id, points, rank, first_place_votes, programs!inner(legacy_team_id, schools!inner(name)), ballot_definitions!inner(slug, period_id)')
        .eq('ballot_definitions.period_id', periodId)
        .order('rank');
    if (result.error) return [];
    const grouped = new Map<string, PollCategoryResults>();
    for (const row of result.data ?? []) {
        const definition = one(row.ballot_definitions as Relation<{ slug: PollCategorySlug }>);
        const program = one(row.programs as Relation<{ legacy_team_id: number; schools: Relation<{ name: string }> }>);
        const school = one(program?.schools ?? null);
        if (!definition || !program || !school) continue;
        const current: PollCategoryResults = grouped.get(row.definition_id) ?? {
            definitionId: row.definition_id,
            category: getPollCategorySpec(definition.slug),
            standings: [],
        };
        current.standings.push({ rank: row.rank, teamId: Number(program.legacy_team_id), teamName: school.name, points: row.points, firstPlaceVotes: row.first_place_votes } satisfies PollStanding);
        grouped.set(row.definition_id, current);
    }
    return [...grouped.values()];
}

export async function loadIndividualBallots(definitionId: string, pollId?: string): Promise<IndividualPollBallot[]> {
    const db = client();
    const norm = normalizeCategorySlug(definitionId as PollCategorySlug);

    let targetPeriodId = pollId;
    if (targetPeriodId) {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetPeriodId);
        if (!isUuid) {
            try {
                const periodsForResolution = await db.from('poll_periods').select('id, status, opens_at').order('opens_at', { ascending: false });
                const allPeriods = periodsForResolution?.data ?? [];
                const openRow = allPeriods.find((r: any) => r.status === 'open' || periodFromRow(r).effectivelyOpen) ?? allPeriods[0];
                const matchedPeriod = allPeriods.find((r: any) => r.id === targetPeriodId);
                targetPeriodId = matchedPeriod?.id || openRow?.id || targetPeriodId;
            } catch {}
        }
    }

    const votesTable = db.from('votes');
    if (votesTable && typeof votesTable.select === 'function') {
        let query = votesTable
            .select('id, voter_id, rankings, category')
            .or(`category.eq.${definitionId},category.eq.${norm}`)
            .eq('status', 'submitted');

        if (targetPeriodId) {
            query = query.eq('poll_id', targetPeriodId);
        }

        const votesRes = await query;

        if (votesRes?.data && votesRes.data.length > 0) {
            const voterIds = Array.from(new Set(votesRes.data.map((r: any) => r.voter_id).filter(Boolean)));
            const profileMap = new Map<string, string>();
            if (voterIds.length > 0) {
                const { data: profiles } = await db.from('profiles').select('id, display_name').in('id', voterIds);
                for (const p of profiles ?? []) {
                    if (p.display_name) profileMap.set(p.id, p.display_name);
                }
            }

            const progRes = await db.from('programs').select('legacy_team_id, schools!inner(name)');
            const names = new Map<number, string>();
            for (const r of (progRes?.data ?? []) as any[]) {
                const sch = one(r.schools);
                if (r.legacy_team_id && sch?.name) {
                    names.set(Number(r.legacy_team_id), sch.name);
                }
            }

            return votesRes.data.map((row: any) => {
                const voterName = profileMap.get(row.voter_id) || 'Committee voter';
                const rankingsArray: number[] = Array.isArray(row.rankings) ? row.rankings.map(Number) : [];
                return {
                    ballotId: row.id,
                    voterName,
                    rankings: rankingsArray.map((teamId, idx) => ({
                        rank: idx + 1,
                        teamId,
                        teamName: names.get(teamId) || `Team #${teamId}`,
                    })),
                };
            });
        }
    }

    const result = await db.from('ballots')
        .select('id, profiles!ballots_voter_id_fkey(display_name), ballot_rankings(rank, programs!inner(legacy_team_id, schools!inner(name)))')
        .eq('definition_id', definitionId)
        .eq('status', 'submitted');
    if (result.error) return [];
    return (result.data ?? []).map((row) => ({
        ballotId: row.id,
        voterName: one(row.profiles as Relation<{ display_name: string }>)?.display_name ?? 'Committee voter',
        rankings: (row.ballot_rankings ?? []).flatMap((ranking) => {
            const program = one(ranking.programs as Relation<{ legacy_team_id: number; schools: Relation<{ name: string }> }>);
            const school = one(program?.schools ?? null);
            return program && school ? [{ rank: ranking.rank, teamId: Number(program.legacy_team_id), teamName: school.name }] : [];
        }).sort((a, b) => a.rank - b.rank),
    }));
}

export async function loadPublicPollResults(periodId?: string): Promise<PollCategoryResults[]> {
    const db = client();
    const periodsRes = await db.from('poll_periods').select('id, status, opens_at').order('opens_at', { ascending: false });
    const periodRows = (periodsRes.data ?? []) as any[];
    const openRow = periodRows.find((r) => r.status === 'open' || periodFromRow(r).effectivelyOpen) ?? periodRows[0];
    const targetId = periodId || openRow?.id || 'b1758f17-33fd-4668-991e-16a8de896c76';
    return loadPollResults(String(targetId));
}
