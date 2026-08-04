import { Pencil, Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import {
    createMatchId,
    downloadMatchSubmissions,
} from "../lib/matchResultsStore";
import type {
    Gender,
    MatchSubmission,
    Team,
} from "../types/types";
import "./ResultsEntryPage.css";

type EntryForm = {
    gender: Gender | "";
    hostName: string;
    email: string;
    date: string;
    leftTeamId: string;
    rightTeamId: string;
    leftSabre: string;
    leftFoil: string;
    leftEpee: string;
    rightSabre: string;
    rightFoil: string;
    rightEpee: string;
};

type ResultsEntryPageProps = {
    teams: Team[];
    submissions: MatchSubmission[];
    onSubmissionsChange: (rows: MatchSubmission[]) => void;
};

const WEAPONS = [
    { label: "Sabre", left: "leftSabre", right: "rightSabre" },
    { label: "Foil", left: "leftFoil", right: "rightFoil" },
    { label: "Epee", left: "leftEpee", right: "rightEpee" },
] as const;

export default function ResultsEntryPage({
    teams,
    submissions,
    onSubmissionsChange,
}: ResultsEntryPageProps) {
    const [form, setForm] = useState<EntryForm>(createInitialForm);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [status, setStatus] = useState("");
    const [error, setError] = useState("");
    const formRef = useRef<HTMLFormElement>(null);

    const genderTeams = useMemo(
        () =>
            teams
                .filter((team) => team.gender === form.gender)
                .sort((a, b) => a.name.localeCompare(b.name)),
        [form.gender, teams]
    );
    const hostNames = useMemo(
        () =>
            [...new Set(teams.map((team) => team.name))].sort((a, b) =>
                a.localeCompare(b)
            ),
        [teams]
    );
    const totals = calculateTotals(form);
    const canSubmit =
        getValidationError(form, genderTeams, hostNames) === "";

    function updateField(field: keyof EntryForm, value: string) {
        setForm((current) => ({
            ...current,
            [field]: value,
        }));
        setError("");
        setStatus("");
    }

    function handleGenderChange(gender: Gender) {
        setForm((current) => ({
            ...current,
            gender,
            leftTeamId: "",
            rightTeamId: "",
        }));
        setError("");
        setStatus("");
    }

    function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();

        const validationError = getValidationError(
            form,
            genderTeams,
            hostNames
        );

        if (validationError) {
            setError(validationError);
            setStatus("");
            return;
        }

        if (!form.gender) {
            setError("Select a valid host and gender.");
            return;
        }

        const existingSubmission = editingId === null
            ? undefined
            : submissions.find((row) => row.id === editingId);
        const submission: MatchSubmission = {
            id: existingSubmission?.id ?? createMatchId(submissions),
            timestamp: existingSubmission?.timestamp ?? new Date().toISOString(),
            date: form.date,
            gender: form.gender,
            leftTeamId: Number(form.leftTeamId),
            rightTeamId: Number(form.rightTeamId),
            leftSabre: Number(form.leftSabre),
            leftFoil: Number(form.leftFoil),
            leftEpee: Number(form.leftEpee),
            rightSabre: Number(form.rightSabre),
            rightFoil: Number(form.rightFoil),
            rightEpee: Number(form.rightEpee),
            host: form.hostName,
            email: form.email.trim(),
        };

        onSubmissionsChange(
            existingSubmission
                ? submissions.map((row) => row.id === existingSubmission.id ? submission : row)
                : [...submissions, submission]
        );
        setEditingId(null);
        setForm((current) => clearMatchFields(current));
        setError("");
        setStatus(existingSubmission ? "Result updated." : "Result saved.");
    }

    function handleDelete(id: number) {
        const submission = submissions.find((row) => row.id === id);
        const label = submission
            ? `${getTeamName(submission.leftTeamId, teams)} versus ${getTeamName(submission.rightTeamId, teams)}`
            : "this result";

        if (!window.confirm(`Delete ${label}? This cannot be undone.`)) {
            return;
        }

        onSubmissionsChange(submissions.filter((row) => row.id !== id));
        if (editingId === id) {
            setEditingId(null);
            setForm(createInitialForm());
        }
        setStatus("Result deleted.");
        setError("");
    }

    function handleEdit(submission: MatchSubmission) {
        setEditingId(submission.id);
        setForm(createFormFromSubmission(submission));
        setError("");
        setStatus("");
        requestAnimationFrame(() => {
            formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
    }

    function resetForm() {
        setEditingId(null);
        setForm(createInitialForm());
        setError("");
        setStatus("");
    }

    return (
        <section className="entry-page">
            <div className="entry-page-header">
                <div>
                    <p className="page-eyebrow">Match data</p>
                    <h1>Squad and Team Results</h1>
                </div>
            </div>

            <form className="results-entry-form" onSubmit={handleSubmit} ref={formRef}>
                {editingId !== null && (
                    <div className="editing-banner" role="status">
                        Editing saved result #{editingId}
                    </div>
                )}
                <section className="entry-section">
                    <div className="entry-section-heading">
                        <span className="section-number">01</span>
                        <div>
                            <h2>Competition details</h2>
                            <p>Identify the event and reporting contact.</p>
                        </div>
                    </div>

                    <div className="details-grid">
                        <fieldset className="gender-fieldset">
                            <legend>
                                Gender <Required />
                            </legend>
                            <div className="segmented-control">
                                {(["Men", "Women"] as Gender[]).map((gender) => (
                                    <label key={gender}>
                                        <input
                                            checked={form.gender === gender}
                                            name="gender"
                                            type="radio"
                                            value={gender}
                                            onChange={() =>
                                                handleGenderChange(gender)
                                            }
                                        />
                                        <span>{gender}</span>
                                    </label>
                                ))}
                            </div>
                        </fieldset>

                        <FormField
                            label="Host"
                            required
                            htmlFor="host-team"
                        >
                            <select
                                required
                                id="host-team"
                                value={form.hostName}
                                onChange={(event) =>
                                    updateField("hostName", event.target.value)
                                }
                            >
                                <option value="">Select host</option>
                                {hostNames.map((name) => (
                                    <option key={name} value={name}>
                                        {name}
                                    </option>
                                ))}
                            </select>
                        </FormField>

                        <FormField label="Email" htmlFor="reporter-email">
                            <input
                                id="reporter-email"
                                type="email"
                                value={form.email}
                                placeholder="name@school.edu"
                                onChange={(event) =>
                                    updateField("email", event.target.value)
                                }
                            />
                        </FormField>

                        <FormField
                            label="Date of competition"
                            required
                            htmlFor="competition-date"
                        >
                            <input
                                required
                                id="competition-date"
                                type="date"
                                value={form.date}
                                onChange={(event) =>
                                    updateField("date", event.target.value)
                                }
                            />
                        </FormField>
                    </div>
                </section>

                <section className="entry-section">
                    <div className="entry-section-heading">
                        <span className="section-number">02</span>
                        <div>
                            <h2>Match result</h2>
                            <p>Enter bouts won by each squad.</p>
                        </div>
                    </div>

                    <div className="team-select-grid">
                        <FormField
                            label="Left team"
                            required
                            htmlFor="left-team"
                        >
                            <select
                                required
                                disabled={!form.gender}
                                id="left-team"
                                value={form.leftTeamId}
                                onChange={(event) =>
                                    updateField("leftTeamId", event.target.value)
                                }
                            >
                                <option value="">Select team</option>
                                {genderTeams.map((team) => (
                                    <option
                                        disabled={
                                            String(team.id) === form.rightTeamId
                                        }
                                        key={team.id}
                                        value={team.id}
                                    >
                                        {team.name}
                                    </option>
                                ))}
                            </select>
                        </FormField>

                        <FormField
                            label="Right team"
                            required
                            htmlFor="right-team"
                        >
                            <select
                                required
                                disabled={!form.gender}
                                id="right-team"
                                value={form.rightTeamId}
                                onChange={(event) =>
                                    updateField("rightTeamId", event.target.value)
                                }
                            >
                                <option value="">Select team</option>
                                {genderTeams.map((team) => (
                                    <option
                                        disabled={
                                            String(team.id) === form.leftTeamId
                                        }
                                        key={team.id}
                                        value={team.id}
                                    >
                                        {team.name}
                                    </option>
                                ))}
                            </select>
                        </FormField>
                    </div>

                    <div className="score-entry" aria-label="Squad scores">
                        <div className="score-grid score-grid-header">
                            <span>Weapon</span>
                            <span>{getTeamLabel(form.leftTeamId, genderTeams, "Left team")}</span>
                            <span>{getTeamLabel(form.rightTeamId, genderTeams, "Right team")}</span>
                            <span>Count</span>
                        </div>

                        {WEAPONS.map((weapon) => {
                            const weaponTotal =
                                toNumber(form[weapon.left]) +
                                toNumber(form[weapon.right]);

                            return (
                                <div className="score-grid score-grid-row" key={weapon.label}>
                                    <span className="weapon-label">{weapon.label}</span>
                                    <ScoreInput
                                        label={`${weapon.label}, left team bouts won`}
                                        value={form[weapon.left]}
                                        onChange={(value) =>
                                            updateField(weapon.left, value)
                                        }
                                    />
                                    <ScoreInput
                                        label={`${weapon.label}, right team bouts won`}
                                        value={form[weapon.right]}
                                        onChange={(value) =>
                                            updateField(weapon.right, value)
                                        }
                                    />
                                    <span
                                        className={`weapon-count ${
                                            weaponTotal === 9 ? "complete" : ""
                                        }`}
                                    >
                                        {weaponTotal} / 9
                                    </span>
                                </div>
                            );
                        })}

                        <div className="score-grid total-row">
                            <span>Team total</span>
                            <output>{totals.left}</output>
                            <output>{totals.right}</output>
                            <output
                                className={
                                    totals.count === 27 ? "complete" : ""
                                }
                            >
                                {totals.count} / 27
                            </output>
                        </div>
                    </div>
                </section>

                {(error || status) && (
                    <div
                        aria-live="polite"
                        className={`entry-message ${error ? "error" : "success"}`}
                    >
                        {error || status}
                    </div>
                )}

                <div className="entry-actions">
                    <button
                        className="primary-action"
                        disabled={!canSubmit}
                        type="submit"
                    >
                        {editingId === null ? "Submit result" : "Save changes"}
                    </button>
                    <button
                        className="secondary-action"
                        type="button"
                        onClick={() => {
                            if (editingId === null) {
                                setForm((current) => clearMatchFields(current));
                                setError("");
                                setStatus("");
                            } else {
                                resetForm();
                            }
                        }}
                    >
                        {editingId === null ? "Clear match" : "Cancel editing"}
                    </button>
                    <span className="form-readiness">
                        {totals.count === 27
                            ? "Bout count complete"
                            : `${27 - totals.count} bouts remaining`}
                    </span>
                </div>
            </form>

            <section className="entry-history">
                <div className="history-header">
                    <div>
                        <h2>Entered results</h2>
                        <p>{submissions.length} saved in this browser</p>
                    </div>
                    <button
                        className="secondary-action"
                        disabled={submissions.length === 0}
                        type="button"
                        onClick={() => downloadMatchSubmissions(submissions)}
                    >
                        Download CSV
                    </button>
                </div>

                <div className="entry-history-table-wrap">
                    <table className="entry-history-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Gender</th>
                                <th>Match</th>
                                <th>Score</th>
                                <th>Host</th>
                                <th>
                                    <span className="sr-only">Actions</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {submissions.length === 0 ? (
                                <tr>
                                    <td className="history-empty" colSpan={6}>
                                        No results entered yet.
                                    </td>
                                </tr>
                            ) : (
                                [...submissions].reverse().map((row) => (
                                    <tr className={editingId === row.id ? "editing-row" : ""} key={row.id}>
                                        <td>{formatDate(row.date)}</td>
                                        <td>{row.gender}</td>
                                        <td>
                                            {getTeamName(row.leftTeamId, teams)} vs{" "}
                                            {getTeamName(row.rightTeamId, teams)}
                                        </td>
                                        <td>
                                            {getMatchTotal(row, "left")}–
                                            {getMatchTotal(row, "right")}
                                        </td>
                                        <td>{row.host}</td>
                                        <td>
                                            <div className="history-actions">
                                                <button
                                                    className="history-icon-action"
                                                    type="button"
                                                    aria-label={`Edit ${getTeamName(
                                                        row.leftTeamId,
                                                        teams
                                                    )} versus ${getTeamName(
                                                        row.rightTeamId,
                                                        teams
                                                    )}`}
                                                    title="Edit result"
                                                    onClick={() => handleEdit(row)}
                                                >
                                                    <Pencil size={16} />
                                                </button>
                                                <button
                                                    className="history-icon-action delete-action"
                                                    type="button"
                                                    aria-label={`Delete ${getTeamName(
                                                        row.leftTeamId,
                                                        teams
                                                    )} versus ${getTeamName(
                                                        row.rightTeamId,
                                                        teams
                                                    )}`}
                                                    onClick={() => handleDelete(row.id)}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </section>
    );
}

function FormField({
    children,
    htmlFor,
    label,
    required = false,
}: {
    children: React.ReactNode;
    htmlFor: string;
    label: string;
    required?: boolean;
}) {
    return (
        <div className="form-field">
            <label htmlFor={htmlFor}>
                {label} {required && <Required />}
            </label>
            {children}
        </div>
    );
}

function Required() {
    return <span className="required-label">Required</span>;
}

function ScoreInput({
    label,
    onChange,
    value,
}: {
    label: string;
    onChange: (value: string) => void;
    value: string;
}) {
    return (
        <label className="score-input">
            <span className="sr-only">{label}</span>
            <input
                required
                inputMode="numeric"
                max={9}
                min={0}
                type="number"
                value={value}
                onChange={(event) => onChange(event.target.value)}
            />
        </label>
    );
}

function createInitialForm(): EntryForm {
    return {
        gender: "",
        hostName: "",
        email: "",
        date: getLocalDate(),
        leftTeamId: "",
        rightTeamId: "",
        leftSabre: "",
        leftFoil: "",
        leftEpee: "",
        rightSabre: "",
        rightFoil: "",
        rightEpee: "",
    };
}

function createFormFromSubmission(submission: MatchSubmission): EntryForm {
    return {
        gender: submission.gender,
        hostName: submission.host,
        email: submission.email,
        date: submission.date,
        leftTeamId: String(submission.leftTeamId),
        rightTeamId: String(submission.rightTeamId),
        leftSabre: String(submission.leftSabre),
        leftFoil: String(submission.leftFoil),
        leftEpee: String(submission.leftEpee),
        rightSabre: String(submission.rightSabre),
        rightFoil: String(submission.rightFoil),
        rightEpee: String(submission.rightEpee),
    };
}

function clearMatchFields(form: EntryForm): EntryForm {
    return {
        ...form,
        leftTeamId: "",
        rightTeamId: "",
        leftSabre: "",
        leftFoil: "",
        leftEpee: "",
        rightSabre: "",
        rightFoil: "",
        rightEpee: "",
    };
}

function getLocalDate(): string {
    const now = new Date();
    const timezoneOffset = now.getTimezoneOffset() * 60_000;

    return new Date(now.getTime() - timezoneOffset).toISOString().slice(0, 10);
}

function calculateTotals(form: EntryForm) {
    const left =
        toNumber(form.leftSabre) +
        toNumber(form.leftFoil) +
        toNumber(form.leftEpee);
    const right =
        toNumber(form.rightSabre) +
        toNumber(form.rightFoil) +
        toNumber(form.rightEpee);

    return {
        left,
        right,
        count: left + right,
    };
}

function getValidationError(
    form: EntryForm,
    teams: Team[],
    hostNames: string[]
): string {
    if (!form.gender) {
        return "Select a gender.";
    }

    if (!form.hostName || !hostNames.includes(form.hostName)) {
        return "Select the host school.";
    }

    if (!form.date) {
        return "Enter the date of competition.";
    }

    if (!form.leftTeamId || !form.rightTeamId) {
        return "Select both competing teams.";
    }

    if (form.leftTeamId === form.rightTeamId) {
        return "Left and right teams must be different.";
    }

    const selectedIds = [Number(form.leftTeamId), Number(form.rightTeamId)];

    if (selectedIds.some((id) => !teams.some((team) => team.id === id))) {
        return "The selected teams must match the chosen gender.";
    }

    for (const weapon of WEAPONS) {
        const left = parseScore(form[weapon.left]);
        const right = parseScore(form[weapon.right]);

        if (left === undefined || right === undefined) {
            return `Enter whole-number ${weapon.label} scores from 0 to 9.`;
        }

        if (left + right !== 9) {
            return `${weapon.label} scores must total 9 bouts.`;
        }
    }

    return "";
}

function parseScore(value: string): number | undefined {
    if (value.trim() === "") {
        return undefined;
    }

    const score = Number(value);

    if (!Number.isInteger(score) || score < 0 || score > 9) {
        return undefined;
    }

    return score;
}

function toNumber(value: string): number {
    return parseScore(value) ?? 0;
}

function getTeamLabel(teamId: string, teams: Team[], fallback: string): string {
    return teams.find((team) => String(team.id) === teamId)?.name ?? fallback;
}

function getTeamName(teamId: number, teams: Team[]): string {
    return teams.find((team) => team.id === teamId)?.name ?? `Team ${teamId}`;
}

function formatDate(value: string): string {
    const [year, month, day] = value.split("-");

    return year && month && day ? `${month}/${day}/${year}` : value;
}

function getMatchTotal(
    row: MatchSubmission,
    side: "left" | "right"
): number {
    return side === "left"
        ? row.leftSabre + row.leftFoil + row.leftEpee
        : row.rightSabre + row.rightFoil + row.rightEpee;
}
