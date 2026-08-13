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
    const result = await client().rpc('list_poll_participation', { target_period: periodId });
    if (result.error) throw result.error;
    const grouped = new Map<string, PollParticipationRow>();
    for (const row of (result.data ?? []) as ParticipationRpcRow[]) {
        const current = grouped.get(row.voter_id) ?? { voterId: row.voter_id, voterName: row.voter_name, email: row.email, statuses: {} };
        current.statuses[row.definition_slug] = row.ballot_status;
        grouped.set(row.voter_id, current);
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
