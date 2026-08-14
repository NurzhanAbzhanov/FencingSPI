import { supabase } from './supabase';
import type {
    CommitteeAccess,
    CommitteeAccessInput,
    PollParticipationRow,
    PollParticipationStatus,
    PollPeriodAdmin,
    PollPeriodStatus,
} from '../types/polls';

type ParticipationRpcRow = {
    voter_id: string;
    voter_name: string;
    email: string;
    definition_slug: string;
    ballot_status: PollParticipationStatus;
};

type CommitteeAccessRpcRow = {
    email: string;
    display_name: string;
    role: CommitteeAccess['role'];
    can_vote: boolean;
    active: boolean;
    linked: boolean;
};

function client() {
    if (!supabase) throw new Error('Poll data requires a configured Supabase project');
    return supabase;
}

function one<T>(value: T | T[] | null): T | null {
    return Array.isArray(value) ? value[0] ?? null : value;
}

export async function loadPollPeriods(seasonSlug: string): Promise<PollPeriodAdmin[]> {
    const result = await client().from('poll_periods')
        .select('id, label, status, opens_at, closes_at, seasons!inner(slug), poll_spi_snapshots(captured_at)')
        .eq('seasons.slug', seasonSlug)
        .order('month');
    if (result.error) throw result.error;
    const now = Date.now();
    return (result.data ?? []).map((row) => ({
        id: row.id,
        label: row.label,
        seasonSlug: one(row.seasons)?.slug ?? seasonSlug,
        status: row.status as PollPeriodStatus,
        opensAt: row.opens_at,
        closesAt: row.closes_at,
        effectivelyOpen: row.status === 'open'
            && (!row.opens_at || Date.parse(row.opens_at) <= now)
            && (!row.closes_at || Date.parse(row.closes_at) > now),
        snapshotCapturedAt: (row.poll_spi_snapshots ?? [])[0]?.captured_at ?? null,
    }));
}

export async function createPollPeriod(input: {
    seasonSlug: string;
    label: string;
    month?: number;
    opensAt?: string | null;
    closesAt?: string | null;
}): Promise<string> {
    const db = client();
    const seasonRes = await db.from('seasons').select('id').eq('slug', input.seasonSlug).maybeSingle();
    let seasonId = seasonRes.data?.id;

    if (!seasonId) {
        const years = input.seasonSlug.split('-').map(Number);
        const startY = years[0] ? (years[0] < 100 ? 2000 + years[0] : years[0]) : new Date().getFullYear();
        const endY = years[1] ? (years[1] < 100 ? 2000 + years[1] : years[1]) : startY + 1;
        const insertSeason = await db.from('seasons').insert({
            slug: input.seasonSlug,
            name: `${startY}-${endY}`,
            starts_on: `${startY}-08-01`,
            ends_on: `${endY}-07-31`,
            is_active: false,
        }).select('id').single();
        if (insertSeason.error) throw insertSeason.error;
        seasonId = insertSeason.data.id;
    }

    const month = input.month || (new Date().getMonth() + 1);
    const insertPeriod = await db.from('poll_periods').insert({
        season_id: seasonId,
        label: input.label.trim(),
        month,
        status: 'draft',
        opens_at: input.opensAt || null,
        closes_at: input.closesAt || null,
    }).select('id').single();

    if (insertPeriod.error) throw insertPeriod.error;
    const periodId = String(insertPeriod.data.id);

    const defs = [
        { slug: 'men_team_overall', gender: 'Men', weapon: 'Team', scope: 'Overall', rank_limit: 15 },
        { slug: 'women_team_overall', gender: 'Women', weapon: 'Team', scope: 'Overall', rank_limit: 15 },
        { slug: 'men_team_diii', gender: 'Men', weapon: 'Team', scope: 'DIII', rank_limit: 10 },
        { slug: 'women_team_diii', gender: 'Women', weapon: 'Team', scope: 'DIII', rank_limit: 10 },
        { slug: 'men_squad_epee', gender: 'Men', weapon: 'Epee', scope: 'Overall', rank_limit: 10 },
        { slug: 'men_squad_foil', gender: 'Men', weapon: 'Foil', scope: 'Overall', rank_limit: 10 },
        { slug: 'men_squad_sabre', gender: 'Men', weapon: 'Sabre', scope: 'Overall', rank_limit: 10 },
        { slug: 'women_squad_epee', gender: 'Women', weapon: 'Epee', scope: 'Overall', rank_limit: 10 },
        { slug: 'women_squad_foil', gender: 'Women', weapon: 'Foil', scope: 'Overall', rank_limit: 10 },
        { slug: 'women_squad_sabre', gender: 'Women', weapon: 'Sabre', scope: 'Overall', rank_limit: 10 },
    ];

    await db.from('ballot_definitions').insert(defs.map((d) => ({ ...d, period_id: periodId }))).select();
    return periodId;
}

async function rpc(name: string, args: Record<string, unknown>) {
    const result = await client().rpc(name, args);
    if (result.error) throw result.error;
}

export async function schedulePoll(input: { periodId: string; opensAt: string | null; closesAt: string | null }): Promise<void> {
    await rpc('schedule_poll_period', { target_period: input.periodId, requested_opens_at: input.opensAt, requested_closes_at: input.closesAt });
}

export async function openPoll(periodId: string): Promise<void> {
    await rpc('open_poll_period', { target_period: periodId });
}

export async function closePoll(periodId: string): Promise<void> {
    await rpc('close_poll_period', { target_period: periodId });
}

export async function publishPoll(periodId: string): Promise<void> {
    await rpc('publish_poll_period', { target_period: periodId });
}

export async function loadParticipation(periodId: string): Promise<PollParticipationRow[]> {
    const db = client();

    let targetPeriodId = periodId;
    if (targetPeriodId) {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetPeriodId);
        if (!isUuid) {
            try {
                const periodsRes = await db.from('poll_periods').select('id, status, opens_at').order('opens_at', { ascending: false });
                const allPeriods = (periodsRes?.data ?? []) as any[];
                const openRow = allPeriods.find((r) => r.status === 'open') ?? allPeriods[0];
                const matchedPeriod = allPeriods.find((r) => r.id === targetPeriodId);
                targetPeriodId = matchedPeriod?.id || openRow?.id || targetPeriodId;
            } catch {}
        }
    }

    try {
        const result = await db.rpc('list_poll_participation', { target_period: targetPeriodId });
        if (!result.error && result.data && result.data.length > 0) {
            const grouped = new Map<string, PollParticipationRow>();
            for (const row of result.data as ParticipationRpcRow[]) {
                const current = grouped.get(row.voter_id) ?? { voterId: row.voter_id, voterName: row.voter_name, email: row.email, statuses: {} };
                current.statuses[row.definition_slug] = row.ballot_status;
                grouped.set(row.voter_id, current);
            }
            return [...grouped.values()];
        }
    } catch {}

    const [profilesRes, votesRes] = await Promise.all([
        db.from('profiles').select('id, display_name, can_vote, active').eq('active', true),
        db.from('votes').select('voter_id, category, status').eq('poll_id', targetPeriodId),
    ]);

    const voters = (profilesRes?.data ?? []).filter((p: any) => p.can_vote !== false);
    const votes = (votesRes?.data ?? []) as any[];

    const grouped = new Map<string, PollParticipationRow>();
    for (const v of voters as any[]) {
        grouped.set(v.id, {
            voterId: v.id,
            voterName: v.display_name || 'Coach',
            email: '',
            statuses: {},
        });
    }

    for (const row of votes) {
        if (!grouped.has(row.voter_id)) {
            grouped.set(row.voter_id, {
                voterId: row.voter_id,
                voterName: 'Coach',
                email: '',
                statuses: {},
            });
        }
        const voter = grouped.get(row.voter_id)!;
        voter.statuses[row.category] = row.status || 'submitted';
    }

    return [...grouped.values()];
}

export async function loadCommitteeAccess(): Promise<CommitteeAccess[]> {
    const result = await client().rpc('list_committee_access');
    if (result.error) throw result.error;
    return ((result.data ?? []) as CommitteeAccessRpcRow[]).map((row) => ({
        email: row.email,
        displayName: row.display_name,
        role: row.role,
        canVote: row.can_vote,
        active: row.active,
        linked: row.linked,
    }));
}

export async function saveCommitteeAccess(input: CommitteeAccessInput): Promise<void> {
    await rpc('save_committee_access', {
        requested_email: input.email.trim().toLowerCase(),
        requested_display_name: input.displayName.trim(),
        requested_role: input.role,
        requested_can_vote: input.canVote,
        requested_active: input.active,
    });
}
