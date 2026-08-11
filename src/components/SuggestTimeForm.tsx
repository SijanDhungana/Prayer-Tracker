import { useState } from "react";
import { useAuth } from "../lib/auth";
import { authConfigured, getSupabase } from "../lib/supabase";
import { warnIfBeforeAdhan } from "../lib/suggestions";
import { formatTime } from "../lib/time";
import { signInPath } from "../lib/route";
import { PRAYERS, PRAYER_LABELS, type Masjid, type Prayer } from "../lib/types";

type Slot = Prayer | "jumuah";

export default function SuggestTimeForm({
  masjid,
  adhan,
  iqamah,
  initialPrayer,
  onClose,
  onPublished,
}: {
  masjid: Masjid;
  adhan: Record<Prayer, Date>;
  iqamah: Record<Prayer, Date | null>;
  initialPrayer: Slot;
  onClose: () => void;
  /** Called after an admin publishes, so the page can re-read the times. */
  onPublished?: () => void;
}) {
  const { session, isAdmin } = useAuth();
  const [prayer, setPrayer] = useState<Slot>(initialPrayer);
  // Maghrib follows sunset, so an offset is the form that stays right all year
  // — it opens on that. Every other prayer is announced as a clock time.
  const [mode, setMode] = useState<"clock" | "offset">(
    initialPrayer === "maghrib" ? "offset" : "clock",
  );
  const [offset, setOffset] = useState("5");
  const [time, setTime] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const showing =
    prayer === "jumuah"
      ? masjid.jumuah.map((j) => j.khutbah).join(", ") || null
      : iqamah[prayer]
        ? formatTime(iqamah[prayer]!)
        : null;

  // An offset is measured from the adhan, so it cannot precede it — the
  // warning only has meaning for a clock time.
  const warning =
    mode === "clock" && time ? warnIfBeforeAdhan(prayer, time, adhan) : null;

  const offsetMinutes = Number(offset);
  const offsetValid =
    mode === "offset" &&
    offset.trim() !== "" &&
    Number.isInteger(offsetMinutes) &&
    offsetMinutes >= 0 &&
    offsetMinutes <= 90;

  // An admin's entry goes live the moment it is saved, with nobody downstream
  // to catch a slip. So the invariant the scraper and the reviewer both enforce
  // becomes a hard stop here rather than a caution.
  const blocked =
    (isAdmin && warning !== null) || (mode === "offset" && !offsetValid);

  if (!authConfigured) {
    return (
      <Panel onClose={onClose}>
        <p className="text-sm text-ink-2">
          Suggestions aren&rsquo;t available on this deployment yet.
        </p>
      </Panel>
    );
  }

  if (!session) {
    return (
      <Panel onClose={onClose}>
        <p className="text-sm text-ink-2">
          Sign in to suggest a time. Accounts exist so corrections can be traced
          and reviewed before they reach anyone&rsquo;s prayer.
        </p>
        <a
          href={signInPath}
          className="mt-4 block w-full rounded-lg bg-brand px-4 py-2.5 text-center text-sm font-semibold text-brand-ink hover:bg-brand-press"
        >
          Sign in
        </a>
      </Panel>
    );
  }

  if (sent) {
    return (
      <Panel onClose={onClose}>
        <p className="text-sm text-ink-2">
          {isAdmin
            ? "Published. Everyone sees this time now."
            : "Thank you — sent for review. It goes live once an admin confirms it against the masjid."}
        </p>
      </Panel>
    );
  }

  return (
    <form
      className="mt-4 rounded-xl border border-line bg-surface p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const pending = getSupabase();
        if (!pending || !session || blocked) return;
        setBusy(true);
        setError(null);

        // An admin writes the row already approved — the policy permits it only
        // for an admin, and only with their own id as the reviewer.
        const review = isAdmin
          ? {
              status: "approved" as const,
              reviewed_by: session.user.id,
              reviewed_at: new Date().toISOString(),
            }
          : {};

        const { error } = await (await pending).from("suggestions").insert({
          masjid_id: masjid.id,
          slot: prayer,
          // Exactly one of these, matching the database constraint.
          suggested_time: mode === "offset" ? null : time,
          offset_minutes: mode === "offset" ? offsetMinutes : null,
          note: note.trim() || null,
          created_by: session.user.id,
          ...review,
        });
        setBusy(false);
        if (error) {
          setError(error.message);
        } else {
          setSent(true);
          if (isAdmin) onPublished?.();
        }
      }}
    >
      <Header onClose={onClose} title={isAdmin ? "Set the time" : "Suggest a time"} />
      <p className="mt-1 text-sm text-ink-2">
        {isAdmin
          ? "You're an admin, so this publishes straight away — no review step."
          : "Know this masjid's iqamah? An admin will confirm it against the masjid before it goes live."}
      </p>

      <label className="mt-4 block text-sm font-medium text-ink-2">
        Prayer
        <select
          value={prayer}
          onChange={(e) => {
            const next = e.target.value as Slot;
            setPrayer(next);
            // Jumu'ah is always announced as a clock time; Maghrib as an offset.
            if (next === "jumuah") setMode("clock");
            else if (next === "maghrib") setMode("offset");
          }}
          className="mt-1 block w-full rounded-lg bg-surface-sunk px-3 py-2 text-base font-normal text-ink ring-1 ring-line"
        >
          {PRAYERS.map((p) => (
            <option key={p} value={p}>
              {PRAYER_LABELS[p]}
            </option>
          ))}
          <option value="jumuah">Jumu&rsquo;ah (Friday)</option>
        </select>
      </label>

      {prayer !== "jumuah" && (
        <div className="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-surface-sunk p-1">
          {(["offset", "clock"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={
                "rounded-lg py-2 text-center text-sm font-medium transition-colors " +
                (mode === m
                  ? "bg-surface text-ink shadow-sm"
                  : "text-ink-2 hover:text-ink")
              }
            >
              {m === "offset" ? "After adhan" : "Set time"}
            </button>
          ))}
        </div>
      )}

      {mode === "offset" ? (
        <>
          <label className="mt-3 block text-sm font-medium text-ink-2">
            Minutes after the adhan
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={90}
              required
              value={offset}
              onChange={(e) => setOffset(e.target.value)}
              className="mt-1 block w-full rounded-lg bg-surface-sunk px-3 py-2 text-base font-normal tabular-nums text-ink ring-1 ring-line"
            />
          </label>
          <p className="mt-1 text-xs text-ink-3">
            {offsetValid
              ? `Today that is ${formatTime(new Date(adhan[prayer as Prayer].getTime() + offsetMinutes * 60000))}. It follows the adhan every day, so it stays right as sunset moves.`
              : "Enter a whole number of minutes between 0 and 90."}
          </p>
        </>
      ) : (
        <label className="mt-3 block text-sm font-medium text-ink-2">
          Iqamah time
          <input
            type="time"
            required
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="mt-1 block w-full rounded-lg bg-surface-sunk px-3 py-2 text-base font-normal tabular-nums text-ink ring-1 ring-line"
          />
        </label>
      )}

      <p className="mt-1 text-xs text-ink-3">
        {showing
          ? `Currently showing ${showing}.`
          : "Nothing is showing for this prayer yet."}
      </p>

      {warning && (
        <p
          className={
            "mt-3 rounded-lg px-3 py-2 text-xs " +
            (blocked ? "bg-danger-wash text-danger" : "bg-caution-wash text-caution")
          }
        >
          {warning}
          {blocked && " This publishes immediately, so it can't be saved as-is."}
        </p>
      )}

      <label className="mt-3 block text-sm font-medium text-ink-2">
        How do you know?{" "}
        <span className="font-normal text-ink-3">(optional)</span>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Sign at the masjid, called the office, their website…"
          className="mt-1 block w-full rounded-lg bg-surface-sunk px-3 py-2 text-base font-normal text-ink ring-1 ring-line placeholder:text-ink-3"
        />
      </label>

      {error && (
        <p className="mt-3 rounded-lg bg-danger-wash px-3 py-2 text-xs text-danger">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy || blocked}
        className="mt-4 w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-brand-ink hover:bg-brand-press disabled:opacity-60"
      >
        {busy
          ? isAdmin
            ? "Publishing…"
            : "Sending…"
          : isAdmin
            ? "Publish time"
            : "Send suggestion"}
      </button>
    </form>
  );
}

function Header({
  onClose,
  title = "Suggest a time",
}: {
  onClose: () => void;
  title?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h3 className="text-base font-semibold">{title}</h3>
      <button
        type="button"
        onClick={onClose}
        className="text-sm text-ink-3 hover:text-ink"
      >
        Close
      </button>
    </div>
  );
}

function Panel({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="mt-4 rounded-xl border border-line bg-surface p-4">
      <Header onClose={onClose} />
      <div className="mt-2">{children}</div>
    </div>
  );
}
