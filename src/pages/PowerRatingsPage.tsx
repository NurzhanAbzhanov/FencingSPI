import {
    Pencil,
    RotateCcw,
    Save,
    ShieldCheck,
    X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
    createOverrideKey,
    deletePowerRatingOverride,
    loadPowerRatingOverrides,
    loadPowerRatingRecords,
    savePowerRatingOverride,
} from "../lib/powerRatingOverrides";
import type {
    PlatformUser,
    PowerRatingOverride,
    PowerRatingRecord,
    Program,
} from "../types/platform";
import type { Gender, Weapon } from "../types/types";
import "./PowerRatingsPage.css";

const WEAPONS: Weapon[] = ["Team", "Epee", "Foil", "Sabre"];

export default function PowerRatingsPage({
    embedded = false,
    programs,
    season,
    user,
}: {
    embedded?: boolean;
    programs: Program[];
    season: string;
    user: PlatformUser;
}) {
    const [records, setRecords] = useState<PowerRatingRecord[]>([]);
    const [overrides, setOverrides] = useState<PowerRatingOverride[]>([]);
    const [gender, setGender] = useState<Gender>("Men");
    const [weapon, setWeapon] = useState<Weapon>("Team");
    const [search, setSearch] = useState("");
    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [draftRating, setDraftRating] = useState("");
    const [draftReason, setDraftReason] = useState("");
    const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
    const [message, setMessage] = useState("");

    useEffect(() => {
        let active = true;
        Promise.all([
            loadPowerRatingRecords(season),
            loadPowerRatingOverrides(season),
        ])
            .then(([loadedRecords, loadedOverrides]) => {
                if (!active) return;
                setRecords(loadedRecords);
                setOverrides(loadedOverrides);
                setStatus("ready");
            })
            .catch((error: unknown) => {
                if (!active) return;
                setMessage(
                    error instanceof Error
                        ? error.message
                        : "Could not load power ratings."
                );
                setStatus("error");
            });
        return () => {
            active = false;
        };
    }, [season]);

    const recordsByKey = useMemo(
        () => new Map(records.map((record) => [createOverrideKey(record), record])),
        [records]
    );
    const overridesByKey = useMemo(
        () => new Map(overrides.map((override) => [createOverrideKey(override), override])),
        [overrides]
    );
    const rows = useMemo(() => {
        const normalizedSearch = search.trim().toLowerCase();
        return programs
            .filter((program) => program.gender === gender)
            .filter(
                (program) =>
                    !normalizedSearch ||
                    program.name.toLowerCase().includes(normalizedSearch) ||
                    String(program.id).includes(normalizedSearch)
            )
            .sort((left, right) => left.name.localeCompare(right.name));
    }, [gender, programs, search]);

    if (user.role !== "admin") {
        return (
            <section className="empty-state">
                <ShieldCheck size={24} />
                <h1>Admin access required</h1>
                <p>Only administrators can change power-rating overrides.</p>
            </section>
        );
    }

    function startEditing(program: Program) {
        const key = createOverrideKey({ teamId: program.id, gender, weapon });
        const currentOverride = overridesByKey.get(key);
        const calculated = recordsByKey.get(key)?.calculatedPowerRating ?? 0;
        setEditingKey(key);
        setDraftRating(String(currentOverride?.adjustedPowerRating ?? calculated));
        setDraftReason(currentOverride?.reason ?? "");
        setMessage("");
    }

    function cancelEditing() {
        setEditingKey(null);
        setDraftRating("");
        setDraftReason("");
        setMessage("");
    }

    async function saveOverride(program: Program) {
        const adjustedPowerRating = Number(draftRating);
        if (!Number.isFinite(adjustedPowerRating) || adjustedPowerRating < 0) {
            setMessage("Enter a non-negative power rating.");
            return;
        }
        if (!draftReason.trim()) {
            setMessage("Enter a reason for the override.");
            return;
        }

        const override: PowerRatingOverride = {
            season,
            teamId: program.id,
            gender,
            weapon,
            adjustedPowerRating,
            reason: draftReason.trim(),
            updatedAt: new Date().toISOString(),
            updatedBy: user.name,
        };

        try {
            await savePowerRatingOverride(override);
            setOverrides((current) => [
                ...current.filter(
                    (item) => createOverrideKey(item) !== createOverrideKey(override)
                ),
                override,
            ]);
            setEditingKey(null);
            setMessage(`${program.name} ${weapon} power rating overridden.`);
        } catch (error) {
            setMessage(
                error instanceof Error ? error.message : "Could not save override."
            );
        }
    }

    async function resetOverride(override: PowerRatingOverride, teamName: string) {
        try {
            await deletePowerRatingOverride(override);
            setOverrides((current) =>
                current.filter(
                    (item) => createOverrideKey(item) !== createOverrideKey(override)
                )
            );
            setMessage(`${teamName} ${weapon} power rating reset.`);
        } catch (error) {
            setMessage(
                error instanceof Error ? error.message : "Could not reset override."
            );
        }
    }

    return (
        <section className={`${embedded ? "admin-section" : "page-section"} power-ratings-page`} aria-label={embedded ? "Power Rating Overrides" : undefined}>
            {embedded ? <h2>Power Rating Overrides</h2> : <div className="page-title-row">
                <div>
                    <p className="eyebrow">Calculation controls</p>
                    <h1>Power Rating Overrides</h1>
                </div>
                <div className="session-user">
                    <ShieldCheck size={16} /> {user.name}
                </div>
            </div>}

            <div className="power-rating-filters">
                <label>
                    Gender
                    <select value={gender} onChange={(event) => {
                        setGender(event.target.value as Gender);
                        cancelEditing();
                    }}>
                        <option>Men</option>
                        <option>Women</option>
                    </select>
                </label>
                <label>
                    Team/Squad
                    <select value={weapon} onChange={(event) => {
                        setWeapon(event.target.value as Weapon);
                        cancelEditing();
                    }}>
                        {WEAPONS.map((item) => <option key={item}>{item}</option>)}
                    </select>
                </label>
                <label>
                    School
                    <input
                        type="search"
                        placeholder="Search schools or IDs"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                    />
                </label>
                <div className="override-summary">
                    <strong>{overrides.filter((item) => item.season === season).length}</strong>
                    <span>active overrides</span>
                </div>
            </div>

            {message && (
                <div className={`form-message ${status === "error" ? "error" : ""}`} role="status">
                    {message}
                </div>
            )}

            {status === "loading" ? (
                <div className="page-loading">Loading power ratings</div>
            ) : (
                <div className="power-rating-table-wrap">
                    <table className="power-rating-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>School</th>
                                <th className="numeric">Calculated PR</th>
                                <th className="numeric">Override</th>
                                <th className="numeric">Effective PR</th>
                                <th>Reason</th>
                                <th><span className="sr-only">Actions</span></th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((program) => {
                                const key = createOverrideKey({
                                    teamId: program.id,
                                    gender,
                                    weapon,
                                });
                                const calculated =
                                    recordsByKey.get(key)?.calculatedPowerRating ?? 0;
                                const override = overridesByKey.get(key);
                                const editing = editingKey === key;
                                return (
                                    <tr key={key} className={override ? "has-override" : ""}>
                                        <td>{program.id}</td>
                                        <td className="power-rating-school">{program.name}</td>
                                        <td className="numeric">{formatPowerRating(calculated)}</td>
                                        <td className="numeric">
                                            {editing ? (
                                                <input
                                                    aria-label={`${program.name} override power rating`}
                                                    className="override-rating-input"
                                                    min="0"
                                                    step="10"
                                                    type="number"
                                                    value={draftRating}
                                                    onChange={(event) => setDraftRating(event.target.value)}
                                                />
                                            ) : override ? formatPowerRating(override.adjustedPowerRating) : "—"}
                                        </td>
                                        <td className="numeric effective-rating">
                                            {formatPowerRating(
                                                override?.adjustedPowerRating ?? calculated
                                            )}
                                        </td>
                                        <td>
                                            {editing ? (
                                                <input
                                                    aria-label={`${program.name} override reason`}
                                                    className="override-reason-input"
                                                    placeholder="Reason required"
                                                    value={draftReason}
                                                    onChange={(event) => setDraftReason(event.target.value)}
                                                />
                                            ) : override ? (
                                                <div className="override-reason">
                                                    <span>{override.reason}</span>
                                                    <small>{override.updatedBy} · {formatTimestamp(override.updatedAt)}</small>
                                                </div>
                                            ) : "—"}
                                        </td>
                                        <td>
                                            <div className="override-actions">
                                                {editing ? (
                                                    <>
                                                        <button title="Save override" aria-label={`Save ${program.name} override`} onClick={() => saveOverride(program)}><Save size={16} /></button>
                                                        <button title="Cancel" aria-label="Cancel editing override" onClick={cancelEditing}><X size={16} /></button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button title={override ? "Edit override" : "Add override"} aria-label={`${override ? "Edit" : "Add"} ${program.name} override`} onClick={() => startEditing(program)}><Pencil size={16} /></button>
                                                        {override && <button className="reset-override" title="Reset to calculated rating" aria-label={`Reset ${program.name} power rating`} onClick={() => resetOverride(override, program.name)}><RotateCcw size={16} /></button>}
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}

function formatPowerRating(value: number): string {
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function formatTimestamp(value: string): string {
    return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(new Date(value));
}
