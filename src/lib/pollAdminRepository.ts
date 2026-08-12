import { supabase } from './supabase';
import type {
    CommitteeAccess,
    CommitteeAccessInput,
    PollParticipationRow,
    PollPeriodAdmin,
    PollPeriodStatus,
} from '../types/polls';

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
    const db = client();
    const [profiles, definitions, ballots] = await Promise.all([
        db.from('profiles').select('id, display_name').eq('active', true).eq('can_vote', true),
        db.from('ballot_definitions').select('id, slug').eq('period_id', periodId).eq('hidden', false).is('archived_at', null),
        db.from('ballots').select('voter_id, definition_id, status, profiles!ballots_voter_id_fkey(id, display_name)').in('definition_id', []),
    ]);
    if (profiles.error) throw profiles.error;
    if (definitions.error) throw definitions.error;
    const definitionRows = definitions.data ?? [];
    const ballotResult = definitionRows.length
        ? await db.from('ballots').select('voter_id, definition_id, status').in('definition_id', definitionRows.map((item) => item.id))
        : ballots;
    if (ballotResult.error) throw ballotResult.error;
    const statuses = new Map((ballotResult.data ?? []).map((item) => [`${item.voter_id}:${item.definition_id}`, item.status]));
    return (profiles.data ?? []).map((profile) => ({
        voterId: profile.id,
        voterName: profile.display_name,
        email: '',
        statuses: Object.fromEntries(definitionRows.map((definition) => [definition.slug, statuses.get(`${profile.id}:${definition.id}`) ?? 'not_started'])),
    }));
}

export async function loadCommitteeAccess(): Promise<CommitteeAccess[]> {
    const result = await client().from('committee_access_grants')
        .select('email, display_name, role, can_vote, active')
        .order('display_name');
    if (result.error) throw result.error;
    return (result.data ?? []).map((row) => ({
        email: row.email,
        displayName: row.display_name,
        role: row.role,
        canVote: row.can_vote,
        active: row.active,
        linked: false,
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
