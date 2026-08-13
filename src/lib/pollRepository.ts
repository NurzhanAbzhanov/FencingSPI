import { computePollStandings, deriveLockedD3TeamIds, getPollCategorySpec } from './pollDomain';
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
type SpiResultRow = { season_id: string; program_id: string; spi: number };

function client() {
    if (!supabase) throw new Error('Poll data requires a configured Supabase project');
    return supabase;
}

function one<T>(value: Relation<T>): T | null {
    return Array.isArray(value) ? value[0] ?? null : value;
}

function periodFromRow(row: {
    id: string;
    label: string;
    status: string;
    opens_at: string | null;
    closes_at: string | null;
    seasons: Relation<{ slug: string }>;
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
    const definitions = await db.from('ballot_definitions')
        .select('id, slug, gender, weapon, scope, rank_limit, hidden, period_id, poll_periods!inner(id, label, status, opens_at, closes_at, seasons!inner(slug))')
        .eq('hidden', false)
        .is('archived_at', null);
    if (definitions.error) throw definitions.error;

    const rows = (definitions.data ?? []) as unknown as Array<Record<string, unknown>>;
    if (!rows.length) return { period: null, categories: [] };
    const periods = new Map<string, PollPeriodSummary>();
    for (const row of rows) {
        const period = one(row.poll_periods as Relation<Parameters<typeof periodFromRow>[0]>);
        if (period) periods.set(period.id, periodFromRow(period));
    }
    const selected = [...periods.values()].sort((a, b) => {
        const priority = (period: PollPeriodSummary) => period.effectivelyOpen ? 3 : period.status === 'closed' ? 2 : period.status === 'published' ? 1 : 0;
        return priority(b) - priority(a) || (b.opensAt ?? '').localeCompare(a.opensAt ?? '');
    })[0] ?? null;
    if (!selected) return { period: null, categories: [] };
    const selectedRows = rows.filter((row) => row.period_id === selected.id);
    const ids = selectedRows.map((row) => String(row.id));
    const ballots = ids.length
        ? await db.from('ballots').select('definition_id, status').eq('voter_id', userId).in('definition_id', ids)
        : { data: [], error: null };
    if (ballots.error) throw ballots.error;
    const statuses = new Map((ballots.data ?? []).map((row) => [row.definition_id, row.status]));

    return {
        period: selected,
        categories: selectedRows.map((row) => ({
            ...getPollCategorySpec(String(row.slug)),
            definitionId: String(row.id),
            ballotStatus: (statuses.get(row.id) ?? 'not_started') as 'not_started' | 'draft' | 'submitted',
        })),
    };
}

export async function loadPollBallot(categorySlug: PollCategorySlug, userId: string): Promise<PollBallotView> {
    const db = client();
    const definitionResult = await db.from('ballot_definitions')
        .select('id, period_id, slug, gender, weapon, scope, rank_limit, hidden, poll_periods!inner(id, label, status, opens_at, closes_at, seasons!inner(slug))')
        .eq('slug', categorySlug)
        .is('archived_at', null);
    if (definitionResult.error) throw definitionResult.error;
    const definitionRows = (definitionResult.data ?? []) as unknown as Array<Record<string, unknown>>;
    const definition = definitionRows.find((row) => {
        const candidatePeriod = one(row.poll_periods as Relation<Parameters<typeof periodFromRow>[0]>);
        return candidatePeriod ? periodFromRow(candidatePeriod).effectivelyOpen : false;
    }) ?? definitionRows[0];
    if (!definition) throw new Error('Poll ballot is not available.');
    const rawPeriod = one(definition.poll_periods as Relation<Parameters<typeof periodFromRow>[0]>);
    if (!rawPeriod) throw new Error('Poll period is not available.');
    const period = periodFromRow(rawPeriod);
    const category = getPollCategorySpec(categorySlug);

    const snapshot = await db.from('poll_spi_snapshots')
        .select('program_id, spi, spi_rank, power_rating, division, conference, region, programs!inner(legacy_team_id, schools!inner(name, logo_url))')
        .eq('period_id', String(definition.period_id))
        .eq('gender', category.gender)
        .eq('weapon', category.weapon)
        .order('spi_rank');
    if (snapshot.error) throw snapshot.error;
    const snapshotCandidates = (snapshot.data ?? []).flatMap((row) => {
        const program = one(row.programs as Relation<{ legacy_team_id: number; schools: Relation<{ name: string; logo_url: string | null }> }>);
        const school = one(program?.schools ?? null);
        if (!program || !school || (category.scope === 'DIII' && Number(row.division) !== 3)) return [];
        return [{
            programId: row.program_id,
            teamId: Number(program.legacy_team_id),
            teamName: school.name,
            logoUrl: school.logo_url,
            division: Number(row.division),
            conference: row.conference,
            region: row.region,
            snapshotSpi: Number(row.spi),
            powerRating: row.power_rating == null ? null : Number(row.power_rating),
        }];
    });

    let candidates: PollBallotView['candidates'] = [];
    if (snapshotCandidates.length) {
        const seasonsResult = await db.from('seasons')
            .select('id, slug, starts_on, ends_on')
            .order('ends_on', { ascending: false });
        if (seasonsResult.error) throw seasonsResult.error;
        const seasons = (seasonsResult.data ?? []) as SeasonRow[];
        const currentSeasonIndex = seasons.findIndex((season) => season.slug === period.seasonSlug);
        if (currentSeasonIndex < 0) throw new Error(`Could not resolve poll season ${period.seasonSlug}.`);
        const currentSeason = seasons[currentSeasonIndex];
        const previousSeason = seasons[currentSeasonIndex + 1];
        const seasonIds = [currentSeason.id, previousSeason?.id].filter((id): id is string => Boolean(id));
        const programIds = snapshotCandidates.map((candidate) => candidate.programId);
        const spiResult = await db.from('spi_results')
            .select('season_id, program_id, spi')
            .in('season_id', seasonIds)
            .in('program_id', programIds)
            .eq('weapon', category.weapon);
        if (spiResult.error) throw spiResult.error;
        const spiBySeasonAndProgram = new Map(
            ((spiResult.data ?? []) as SpiResultRow[]).map((result) => [
                `${result.season_id}:${result.program_id}`,
                Number(result.spi),
            ]),
        );

        candidates = snapshotCandidates.map((candidate) => ({
            ...candidate,
            currentSpi: spiBySeasonAndProgram.get(`${currentSeason.id}:${candidate.programId}`) ?? candidate.snapshotSpi,
            previousSpi: previousSeason
                ? spiBySeasonAndProgram.get(`${previousSeason.id}:${candidate.programId}`) ?? null
                : null,
        })).sort((a, b) => b.currentSpi - a.currentSpi || a.teamName.localeCompare(b.teamName)).map((candidate, index) => {
            const { snapshotSpi: _snapshotSpi, ...publicCandidate } = candidate;
            return { ...publicCandidate, spiRank: index + 1 };
        });
    }

    const ballotResult = await db.from('ballots')
        .select('id, status, ballot_rankings(rank, programs!inner(legacy_team_id))')
        .eq('definition_id', String(definition.id))
        .eq('voter_id', userId);
    if (ballotResult.error) throw ballotResult.error;
    const ballot = (ballotResult.data ?? [])[0];
    const rankings = (ballot?.ballot_rankings ?? []).map((ranking) => {
        const program = one(ranking.programs as Relation<{ legacy_team_id: number }>);
        return { rank: Number(ranking.rank), teamId: Number(program?.legacy_team_id) };
    }).filter((ranking) => ranking.teamId).sort((a, b) => a.rank - b.rank).map((ranking) => ranking.teamId);

    let prerequisite: PollBallotView['prerequisite'] = 'ready';
    let lockedTeamIds: number[] = [];
    if (category.weapon === 'Team' && category.scope === 'DIII') {
        const overallSlug = `${category.gender === 'Men' ? 'men' : 'women'}_team_overall` as PollCategorySlug;
        const overall = await db.from('ballot_definitions')
            .select('id, ballots!inner(status, voter_id, ballot_rankings(rank, programs!inner(legacy_team_id)))')
            .eq('period_id', String(definition.period_id))
            .eq('slug', overallSlug);
        if (overall.error) throw overall.error;
        const overallBallots = ((overall.data ?? [])[0]?.ballots ?? []) as Array<{ status: string; voter_id: string; ballot_rankings: Array<{ rank: number; programs: Relation<{ legacy_team_id: number }> }> }>;
        const submitted = overallBallots.find((item) => item.voter_id === userId && item.status === 'submitted');
        if (!submitted) prerequisite = 'overall-required';
        else {
            const overallIds = submitted.ballot_rankings
                .map((item) => ({ rank: item.rank, teamId: Number(one(item.programs)?.legacy_team_id) }))
                .sort((a, b) => a.rank - b.rank)
                .map((item) => item.teamId);
            lockedTeamIds = deriveLockedD3TeamIds(overallIds, new Set(candidates.map((item) => item.teamId)), category.rankLimit);
        }
    }

    return {
        definitionId: String(definition.id),
        period,
        category,
        candidates,
        rankings,
        submitted: ballot?.status === 'submitted',
        prerequisite,
        lockedTeamIds,
    };
}

export async function savePollBallot(input: { definitionId: string; teamIds: number[]; submit: boolean }): Promise<string> {
    const db = client();
    const programs = await db.from('programs').select('id, legacy_team_id').in('legacy_team_id', input.teamIds);
    if (programs.error) throw programs.error;
    const ids = new Map((programs.data ?? []).map((program) => [Number(program.legacy_team_id), program.id]));
    const rankedPrograms = input.teamIds.map((teamId) => {
        const id = ids.get(teamId);
        if (!id) throw new Error(`Program ${teamId} is not loaded in Supabase.`);
        return id;
    });
    const result = await db.rpc('save_poll_ballot', {
        target_definition: input.definitionId,
        ranked_programs: rankedPrograms,
        submit_now: input.submit,
    });
    if (result.error) throw result.error;
    return String(result.data);
}

export async function loadPollResults(periodId: string): Promise<PollCategoryResults[]> {
    const published = await loadResults(periodId);
    if (published.length) return published;

    const db = client();
    const definitions = await db.from('ballot_definitions')
        .select('id, slug, rank_limit')
        .eq('period_id', periodId)
        .eq('hidden', false)
        .is('archived_at', null);
    if (definitions.error) throw definitions.error;
    const definitionRows = definitions.data ?? [];
    if (!definitionRows.length) return [];
    const ballots = await db.from('ballots')
        .select('definition_id, ballot_rankings(rank, programs!inner(legacy_team_id, schools!inner(name)))')
        .in('definition_id', definitionRows.map((definition) => definition.id))
        .eq('status', 'submitted');
    if (ballots.error) throw ballots.error;

    return definitionRows.flatMap((definition) => {
        const names = new Map<number, string>();
        const votes = (ballots.data ?? []).filter((ballot) => ballot.definition_id === definition.id).map((ballot) => ({
            rankings: (ballot.ballot_rankings ?? []).flatMap((ranking) => {
                const program = one(ranking.programs as Relation<{ legacy_team_id: number; schools: Relation<{ name: string }> }>);
                const school = one(program?.schools ?? null);
                if (!program || !school) return [];
                const teamId = Number(program.legacy_team_id);
                names.set(teamId, school.name);
                return [{ rank: Number(ranking.rank), teamId }];
            }).sort((a, b) => a.rank - b.rank).map((ranking) => ranking.teamId),
        }));
        return votes.length ? [{
            definitionId: definition.id,
            category: getPollCategorySpec(definition.slug),
            standings: computePollStandings(votes, names, Number(definition.rank_limit)),
        }] : [];
    });
}

export async function loadPublicPollResults(periodId: string): Promise<PollCategoryResults[]> {
    return loadResults(periodId);
}

async function loadResults(periodId: string): Promise<PollCategoryResults[]> {
    const db = client();
    const result = await db.from('published_poll_results')
        .select('definition_id, points, rank, first_place_votes, programs!inner(legacy_team_id, schools!inner(name)), ballot_definitions!inner(slug, period_id)')
        .eq('ballot_definitions.period_id', periodId)
        .order('rank');
    if (result.error) throw result.error;
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

export async function loadIndividualBallots(definitionId: string): Promise<IndividualPollBallot[]> {
    const db = client();
    const result = await db.from('ballots')
        .select('id, profiles!ballots_voter_id_fkey(display_name), ballot_rankings(rank, programs!inner(legacy_team_id, schools!inner(name)))')
        .eq('definition_id', definitionId)
        .eq('status', 'submitted');
    if (result.error) throw result.error;
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
