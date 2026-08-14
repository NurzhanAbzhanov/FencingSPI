import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

type Poll = {
  id: string | number
  label: string
  is_open: boolean
  opened_at: string | null
  closed_at: string | null
  scheduled_open_at: string | null
  scheduled_close_at: string | null
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  )
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
]

function generateSeasonOptions(): string[] {
  const currentYear = new Date().getFullYear();
  const startYear = Math.min(2022, currentYear - 2);
  const endYear = currentYear + 15;
  const list: string[] = [];
  for (let y = startYear; y <= endYear; y++) {
    const endSuffix = String(y + 1).slice(-2);
    list.push(`${y}-${endSuffix}`);
  }
  return list;
}

function getCurrentSeason(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const startYear = m >= 8 ? y : y - 1;
  const endSuffix = String(startYear + 1).slice(-2);
  return `${startYear}-${endSuffix}`;
}

const SEASONS = generateSeasonOptions();

function getMonthDateRange(month: number, seasonStr: string): { open: string; close: string } {
  const parts = seasonStr.split("-");
  const startYear = parseInt(parts[0], 10) || new Date().getFullYear();
  let endYear = parseInt(parts[1], 10) || (startYear + 1);
  if (endYear < 100) endYear = Math.floor(startYear / 100) * 100 + endYear;

  const year = month >= 8 ? startYear : endYear;
  const mm = String(month).padStart(2, "0");
  const lastDay = new Date(year, month, 0).getDate();
  const dd = String(lastDay).padStart(2, "0");

  return {
    open: `${year}-${mm}-01T00:00`,
    close: `${year}-${mm}-${dd}T23:59`,
  };
}


export default function PollManagementPage({ season: _propSeason = '2025-26' }: { season?: string } = {}) {
  const [loading, setLoading] = useState(true)
  const [polls, setPolls] = useState<Poll[]>([])
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success' | 'error'>('error')
  const [busy, setBusy] = useState(false)

  // Create-form state
  const currentMonthNum = new Date().getMonth() + 1;
  const initialSeason = getCurrentSeason();
  const initialRange = getMonthDateRange(currentMonthNum, initialSeason);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonthNum)
  const [selectedSeason, setSelectedSeason] = useState<string>(initialSeason)
  const [newLabel, setNewLabel] = useState<string>(MONTHS[currentMonthNum - 1] + " (" + initialSeason + ")")
  const [newScheduledOpen, setNewScheduledOpen] = useState(initialRange.open)
  const [newScheduledClose, setNewScheduledClose] = useState(initialRange.close)

  const handleMonthChange = (m: number) => {
    setSelectedMonth(m)
    setNewLabel(`${MONTHS[m - 1]} (${selectedSeason})`)
    const range = getMonthDateRange(m, selectedSeason)
    setNewScheduledOpen(range.open)
    setNewScheduledClose(range.close)
  }

  const handleSeasonChange = (s: string) => {
    setSelectedSeason(s)
    setNewLabel(`${MONTHS[selectedMonth - 1]} (${s})`)
    const range = getMonthDateRange(selectedMonth, s)
    setNewScheduledOpen(range.open)
    setNewScheduledClose(range.close)
  }

  // Inline schedule-editor state
  const [editingSchedulePollId, setEditingSchedulePollId] = useState<string | number | null>(null)
  const [scheduleOpen, setScheduleOpen] = useState('')
  const [scheduleClose, setScheduleClose] = useState('')

  async function refreshPolls(): Promise<Poll[]> {
    if (!supabase) return []
    const periodsRes = await supabase
      .from('poll_periods')
      .select('id, label, status, opens_at, closes_at')
      .order('month', { ascending: false })

    if (periodsRes.data && periodsRes.data.length > 0) {
      const loaded: Poll[] = periodsRes.data.map((p) => ({
        id: p.id,
        label: p.label,
        is_open: p.status === 'open',
        opened_at: p.opens_at,
        closed_at: p.closes_at,
        scheduled_open_at: p.opens_at,
        scheduled_close_at: p.closes_at,
      }))
      setPolls(loaded)
      return loaded
    }

    const { data, error } = await supabase
      .from('polls')
      .select('id, label, is_open, opened_at, closed_at, scheduled_open_at, scheduled_close_at')
      .order('id', { ascending: false })

    if (error) {
      setMessage(`Failed to load polls. (${error.message ?? 'unknown error'})`)
      setMessageType('error')
      return []
    }

    const loaded = (data ?? []) as Poll[]
    setPolls(loaded)
    return loaded
  }

  async function applySchedule(currentPolls: Poll[]): Promise<boolean> {
    if (!supabase) return false
    const now = new Date()
    let madeChanges = false

    for (const poll of currentPolls) {
      const closeTime = poll.scheduled_close_at || poll.closed_at
      if (poll.is_open && closeTime && new Date(closeTime) <= now) {
        await supabase
          .from('polls')
          .update({ is_open: false, closed_at: now.toISOString() })
          .eq('id', poll.id)
        madeChanges = true
      }
    }

    const isStillOpen = (p: Poll) =>
      p.is_open &&
      !((p.scheduled_close_at || p.closed_at) && new Date((p.scheduled_close_at || p.closed_at)!) <= now)

    const anyStillOpen = currentPolls.some(isStillOpen)

    if (!anyStillOpen) {
      const candidates = currentPolls
        .filter(
          (p) =>
            !p.is_open &&
            (p.scheduled_open_at || p.opened_at) &&
            new Date((p.scheduled_open_at || p.opened_at)!) <= now &&
            (!(p.scheduled_close_at || p.closed_at) || new Date((p.scheduled_close_at || p.closed_at)!) > now),
        )
        .sort(
          (a, b) =>
            new Date((b.scheduled_open_at || b.opened_at)!).getTime() -
            new Date((a.scheduled_open_at || a.opened_at)!).getTime(),
        )

      if (candidates.length > 0) {
        await supabase
          .from('polls')
          .update({ is_open: true, opened_at: now.toISOString(), closed_at: null })
          .eq('id', candidates[0].id)
        madeChanges = true
      }
    }

    return madeChanges
  }

  useEffect(() => {
    async function loadPage() {
      const loaded = await refreshPolls()
      const changed = await applySchedule(loaded)
      if (changed) await refreshPolls()
      setLoading(false)
    }
    loadPage()
  }, [])

  async function handleCreatePoll() {
    const trimmedLabel = newLabel.trim()
    if (!trimmedLabel) {
      setMessage('Enter a label for the new poll.')
      setMessageType('error')
      return
    }
    if (!supabase) return
    setBusy(true)
    setMessage('')

    let seasonId: string | null = null
    const seasonSlug = selectedSeason.replace(/(\d{4})-(\d{2})\d{2}/, "$1-$2") || selectedSeason
    const parts = selectedSeason.split('-')
    const startYear = parseInt(parts[0], 10) || new Date().getFullYear()
    let endYear = parseInt(parts[1], 10) || (startYear + 1)
    if (endYear < 100) endYear = Math.floor(startYear / 100) * 100 + endYear

    try {
      const seasonRes = await supabase
        .from('seasons')
        .select('id')
        .or(`slug.eq.${selectedSeason},slug.eq.${seasonSlug}`)
        .maybeSingle()

      if (seasonRes?.data?.id) {
        seasonId = seasonRes.data.id
      } else {
        const insSeason = await supabase
          .from('seasons')
          .insert({
            slug: seasonSlug,
            name: selectedSeason,
            starts_on: `${startYear}-08-01`,
            ends_on: `${endYear}-07-31`,
            is_active: false,
          })
          .select('id')
          .single()
        seasonId = insSeason.data?.id || null
      }
    } catch {}

    if (!seasonId) {
      const fallbackSeason = await supabase.from('seasons').select('id').limit(1).maybeSingle()
      seasonId = fallbackSeason.data?.id || null
    }

    if (!seasonId) {
      setMessage('Could not determine season ID for this poll.')
      setMessageType('error')
      setBusy(false)
      return
    }

    const payload: Record<string, unknown> = {
      label: trimmedLabel,
      month: selectedMonth,
      status: 'draft',
      season_id: seasonId,
    }
    if (newScheduledOpen) payload.opens_at = new Date(newScheduledOpen).toISOString()
    if (newScheduledClose) payload.closes_at = new Date(newScheduledClose).toISOString()

    const { error: periodErr } = await supabase
      .from('poll_periods')
      .insert(payload)
      .select('id')
      .single()

    if (periodErr) {
      // If month collision in this season, find next available month number
      try {
        const existing = await supabase.from('poll_periods').select('month').eq('season_id', seasonId)
        const usedMonths = new Set((existing?.data ?? []).map((r: any) => Number(r.month)))
        let altMonth = selectedMonth
        while (usedMonths.has(altMonth)) {
          altMonth = (altMonth % 12) + 1
        }
        payload.month = altMonth
        const retry = await supabase.from('poll_periods').insert(payload).select('id').single()
        if (retry.error) {
          setMessage(`Could not create poll: ${retry.error.message}`)
          setMessageType('error')
          setBusy(false)
          return
        }
      } catch (err: any) {
        setMessage(`Could not create poll: ${err.message || periodErr.message}`)
        setMessageType('error')
        setBusy(false)
        return
      }
    }

    setNewLabel(`${MONTHS[selectedMonth - 1]} (${selectedSeason})`)
    const nextRange = getMonthDateRange(selectedMonth, selectedSeason)
    setNewScheduledOpen(nextRange.open)
    setNewScheduledClose(nextRange.close)
    setMessage('Poll created successfully.')
    setMessageType('success')
    const loaded = await refreshPolls()
    const changed = await applySchedule(loaded)
    if (changed) await refreshPolls()
    setBusy(false)
  }

  async function handleOpenPoll(pollId: string | number) {
    if (!supabase) return
    setBusy(true)
    setMessage('')

    await supabase.from('poll_periods').update({ status: 'closed', closes_at: new Date().toISOString() }).eq('status', 'open').neq('id', pollId)
    await supabase.from('polls').update({ is_open: false, closed_at: new Date().toISOString() }).eq('is_open', true).neq('id', pollId)

    const nowIso = new Date().toISOString()
    const periodUpd = await supabase.from('poll_periods').update({ status: 'open', opens_at: nowIso, closes_at: null }).eq('id', pollId)
    if (periodUpd.error) {
      await supabase.from('polls').update({ is_open: true, opened_at: nowIso, closed_at: null }).eq('id', pollId)
    }

    setMessage('Poll is now open.')
    setMessageType('success')
    await refreshPolls()
    setBusy(false)
  }

  async function handleClosePoll(pollId: string | number) {
    if (!supabase) return
    setBusy(true)
    setMessage('')

    const nowIso = new Date().toISOString()
    const periodUpd = await supabase.from('poll_periods').update({ status: 'closed', closes_at: nowIso }).eq('id', pollId)
    if (periodUpd.error) {
      await supabase.from('polls').update({ is_open: false, closed_at: nowIso }).eq('id', pollId)
    }

    setMessage('Poll closed.')
    setMessageType('success')
    await refreshPolls()
    setBusy(false)
  }

  async function handleDeletePoll(pollId: string | number, label: string) {
    if (!confirm(`Are you sure you want to delete "${label}"?\n\nThis will permanently delete this poll round.`)) {
      return
    }
    if (!supabase) return
    setBusy(true)
    setMessage('')

    await supabase.from('ballot_definitions').delete().eq('period_id', pollId)
    await supabase.from('votes').delete().eq('poll_id', pollId)
    await supabase.from('spi_rankings').delete().eq('poll_id', pollId)

    const delPeriod = await supabase.from('poll_periods').delete().eq('id', pollId)
    if (delPeriod.error) {
      await supabase.from('polls').delete().eq('id', pollId)
    }

    setMessage('Poll deleted.')
    setMessageType('success')
    const loaded = await refreshPolls()
    const changed = await applySchedule(loaded)
    if (changed) await refreshPolls()
    setBusy(false)
  }

  function startEditSchedule(poll: Poll) {
    setEditingSchedulePollId(poll.id)
    setScheduleOpen(toDatetimeLocal(poll.scheduled_open_at || poll.opened_at))
    setScheduleClose(toDatetimeLocal(poll.scheduled_close_at || poll.closed_at))
  }

  function cancelEditSchedule() {
    setEditingSchedulePollId(null)
    setScheduleOpen('')
    setScheduleClose('')
  }

  async function handleSaveSchedule(pollId: string | number) {
    if (!supabase) return
    setBusy(true)
    setMessage('')

    const opensAtIso = scheduleOpen ? new Date(scheduleOpen).toISOString() : null
    const closesAtIso = scheduleClose ? new Date(scheduleClose).toISOString() : null

    const pUpd = await supabase
      .from('poll_periods')
      .update({ opens_at: opensAtIso, closes_at: closesAtIso })
      .eq('id', pollId)

    if (pUpd.error) {
      await supabase
        .from('polls')
        .update({ scheduled_open_at: opensAtIso, scheduled_close_at: closesAtIso })
        .eq('id', pollId)
    }

    cancelEditSchedule()
    setMessage('Schedule saved.')
    setMessageType('success')
    const loaded = await refreshPolls()
    const changed = await applySchedule(loaded)
    if (changed) await refreshPolls()
    setBusy(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-xs text-gray-500">Loading…</p>
      </div>
    )
  }

  const openPoll = polls.find((p) => p.is_open)
  const nextScheduled = polls
    .filter((p) => !p.is_open && (p.scheduled_open_at || p.opened_at) && new Date((p.scheduled_open_at || p.opened_at)!) > new Date())
    .sort((a, b) => new Date((a.scheduled_open_at || a.opened_at)!).getTime() - new Date((b.scheduled_open_at || b.opened_at)!).getTime())[0] ?? null

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-6">
          <a href="#/polls" className="text-xs font-medium text-green-700 hover:text-green-800">
            ← Dashboard
          </a>
          <h1 className="mt-1 text-2xl font-bold text-gray-900 tracking-tight">Manage Polls</h1>
        </div>

        {message && (
          <div
            className={`mb-5 px-3.5 py-2.5 rounded-md text-xs border shadow-2xs ${
              messageType === 'success'
                ? 'bg-green-50 border-green-200 text-green-800'
                : 'bg-red-50 border-red-200 text-red-700'
            }`}
          >
            {message}
          </div>
        )}

        {/* Status + Create side by side */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 mb-6">
          {/* Current status card */}
          <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-2xs">
            <h2 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-3">
              Current Status
            </h2>
            {openPoll ? (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-sm font-semibold text-gray-900">Open</span>
                </div>
                <p className="text-xs text-gray-600 font-medium">{openPoll.label}</p>
                <p className="text-[11px] text-gray-400 mt-1">
                  Opens: {formatDate(openPoll.opened_at || openPoll.scheduled_open_at)}
                </p>
                {(openPoll.closed_at || openPoll.scheduled_close_at) && (
                  <p className="text-[11px] text-amber-600 mt-0.5">
                    Deadline: {formatDate(openPoll.closed_at || openPoll.scheduled_close_at)}
                  </p>
                )}
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-gray-300" />
                  <span className="text-sm font-semibold text-gray-900">Closed</span>
                </div>
                <p className="text-xs text-gray-500">No poll is currently open.</p>
                {nextScheduled && (
                  <p className="text-[11px] text-green-700 mt-1">
                    Next: <span className="font-semibold">{nextScheduled.label}</span> opens{' '}
                    {formatDate(nextScheduled.scheduled_open_at || nextScheduled.opened_at)}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Create new poll card */}
          <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-2xs">
            <h2 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-3">
              Create New Poll
            </h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="poll-month" className="block text-[11px] text-gray-500 mb-1">
                    Month
                  </label>
                  <select
                    id="poll-month"
                    value={selectedMonth}
                    onChange={(e) => handleMonthChange(Number(e.target.value))}
                    className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs text-gray-900 bg-white focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600 shadow-2xs cursor-pointer"
                  >
                    {MONTHS.map((m, idx) => (
                      <option key={m} value={idx + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="poll-season" className="block text-[11px] text-gray-500 mb-1">
                    Season
                  </label>
                  <select
                    id="poll-season"
                    value={selectedSeason}
                    onChange={(e) => handleSeasonChange(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs text-gray-900 bg-white focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600 shadow-2xs cursor-pointer"
                  >
                    {SEASONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="poll-label" className="block text-[11px] text-gray-500 mb-1">
                  Poll Name
                </label>
                <input
                  id="poll-label"
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreatePoll()}
                  placeholder="e.g. October (2026-2027)"
                  className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-xs text-gray-900 bg-white focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600 shadow-2xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="new-sched-open" className="block text-[11px] text-gray-500 mb-1">
                    Opens At <span className="text-gray-400">(optional)</span>
                  </label>
                  <input
                    id="new-sched-open"
                    type="datetime-local"
                    value={newScheduledOpen}
                    onChange={(e) => setNewScheduledOpen(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-900 bg-white focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600 shadow-2xs"
                  />
                </div>
                <div>
                  <label htmlFor="new-sched-close" className="block text-[11px] text-gray-500 mb-1">
                    Closes At <span className="text-gray-400">(optional)</span>
                  </label>
                  <input
                    id="new-sched-close"
                    type="datetime-local"
                    value={newScheduledClose}
                    onChange={(e) => setNewScheduledClose(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-900 bg-white focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600 shadow-2xs"
                  />
                </div>
              </div>

              <button
                type="button"
                disabled={busy}
                onClick={handleCreatePoll}
                className="w-full rounded-md bg-green-700 hover:bg-green-800 text-white font-semibold text-xs py-2 transition-colors disabled:opacity-50 shadow-2xs cursor-pointer"
              >
                {busy ? "Creating…" : "Create Poll"}
              </button>
            </div>
          </div>
        </div>

        {/* All Polls Table (Simplified to Opens At and Closes At) */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-2xs">
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">All Polls</h2>
            <span className="text-[11px] text-gray-400">{polls.length} rounds</span>
          </div>

          {polls.length === 0 ? (
            <p className="px-5 py-8 text-xs text-gray-400 text-center">No polls yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Poll Round', 'Status', 'Opens At', 'Closes At', 'Links', 'Actions'].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-2.5 font-medium text-gray-500 uppercase tracking-wider text-[11px] whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {polls.map((poll) => {
                    const isEditingSchedule = editingSchedulePollId === poll.id
                    const openDisplay = poll.scheduled_open_at || poll.opened_at
                    const closeDisplay = poll.scheduled_close_at || poll.closed_at

                    return (
                      <tr key={poll.id} className="hover:bg-gray-50/75 transition-colors">
                        {/* Poll Name */}
                        <td className="px-4 py-2.5 font-medium text-gray-900 whitespace-nowrap">{poll.label}</td>

                        {/* Status badge */}
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          {poll.is_open ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-800">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block animate-pulse" /> Open
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600">
                              Closed
                            </span>
                          )}
                        </td>

                        {/* Opens At */}
                        <td className="px-4 py-2.5 text-[11px] whitespace-nowrap">
                          {isEditingSchedule ? (
                            <input
                              type="datetime-local"
                              value={scheduleOpen}
                              onChange={(e) => setScheduleOpen(e.target.value)}
                              className="rounded border border-gray-300 px-1.5 py-0.5 text-xs bg-white text-gray-900 focus:border-green-600 focus:outline-none"
                            />
                          ) : (
                            <span className="text-gray-600">{formatDate(openDisplay)}</span>
                          )}
                        </td>

                        {/* Closes At */}
                        <td className="px-4 py-2.5 text-[11px] whitespace-nowrap">
                          {isEditingSchedule ? (
                            <input
                              type="datetime-local"
                              value={scheduleClose}
                              onChange={(e) => setScheduleClose(e.target.value)}
                              className="rounded border border-gray-300 px-1.5 py-0.5 text-xs bg-white text-gray-900 focus:border-green-600 focus:outline-none"
                            />
                          ) : (
                            <span className="text-gray-600">{formatDate(closeDisplay)}</span>
                          )}
                        </td>

                        {/* Links */}
                        <td className="px-4 py-2.5 text-[11px] whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <a href={`#/polls/results?period=${poll.id}`} className="text-green-700 hover:text-green-800 font-medium">
                              Results
                            </a>
                            <span className="text-gray-300">·</span>
                            <a href={`#/admin/participation?period=${poll.id}`} className="text-green-700 hover:text-green-800 font-medium">
                              Participation
                            </a>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          {isEditingSchedule ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleSaveSchedule(poll.id)}
                                disabled={busy}
                                className="h-6 px-2 text-[11px] font-medium rounded border border-green-300 text-green-700 bg-green-50 hover:bg-green-100 transition-colors disabled:opacity-50 cursor-pointer"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={cancelEditSchedule}
                                disabled={busy}
                                className="h-6 px-2 text-[11px] font-medium rounded border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 transition-colors cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              {poll.is_open ? (
                                <button
                                  type="button"
                                  onClick={() => handleClosePoll(poll.id)}
                                  disabled={busy}
                                  className="h-6 px-2.5 text-[11px] font-medium rounded border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50 cursor-pointer"
                                >
                                  Close
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleOpenPoll(poll.id)}
                                  disabled={busy}
                                  className="h-6 px-2.5 text-[11px] font-medium rounded border border-green-300 text-green-700 bg-green-50 hover:bg-green-100 transition-colors disabled:opacity-50 cursor-pointer"
                                >
                                  Open
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => startEditSchedule(poll)}
                                disabled={busy}
                                className="h-6 px-2 text-[11px] font-medium rounded border border-gray-200 text-gray-600 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50 cursor-pointer"
                              >
                                Edit Schedule
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeletePoll(poll.id, poll.label)}
                                disabled={busy}
                                className="h-6 px-2 text-[11px] font-medium rounded border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-50 cursor-pointer"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
