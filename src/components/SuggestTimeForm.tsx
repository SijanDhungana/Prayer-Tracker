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
}: {
  masjid: Masjid;
  adhan: Record<Prayer, Date>;
  iqamah: Record<Prayer, Date | null>;
  initialPrayer: Slot;
  onClose: () => void;
}) {
  const { session } = useAuth();
  const [prayer, setPrayer] = useState<Slot>(initialPrayer);
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

  const warning = time ? warnIfBeforeAdhan(prayer, time, adhan) : null;

  if (!authConfigured) {
    return (
      <Panel onClose={onClose}>
        <p className="text-sm text-stone-600">
          Suggestions aren&rsquo;t available on this deployment yet.
        </p>
      </Panel>
    );
  }

  if (!session) {
    return (
      <Panel onClose={onClose}>
        <p className="text-sm text-stone-600">
          Sign in to suggest a time. Accounts exist so corrections can be traced
          and reviewed before they reach anyone&rsquo;s prayer.
        </p>
        <a
          href={signInPath}
          className="mt-4 block w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-emerald-800"
        >
          Sign in
        </a>
      </Panel>
    );
  }

  if (sent) {
    return (
      <Panel onClose={onClose}>
        <p className="text-sm text-stone-700">
          Thank you — sent for review. It goes live once an admin confirms it
          against the masjid.
        </p>
      </Panel>
    );
  }

  return (
    <form
      className="mt-4 rounded-xl border border-stone-200 bg-white p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const pending = getSupabase();
        if (!pending || !session) return;
        setBusy(true);
        setError(null);
        const { error } = await (await pending).from("suggestions").insert({
          masjid_id: masjid.id,
          slot: prayer,
          suggested_time: time,
          note: note.trim() || null,
          created_by: session.user.id,
        });
        setBusy(false);
        if (error) setError(error.message);
        else setSent(true);
      }}
    >
      <Header onClose={onClose} />
      <p className="mt-1 text-sm text-stone-600">
        Know this masjid&rsquo;s iqamah? An admin will confirm it against the
        masjid before it goes live.
      </p>

      <label className="mt-4 block text-sm font-medium text-stone-700">
        Prayer
        <select
          value={prayer}
          onChange={(e) => setPrayer(e.target.value as Slot)}
          className="mt-1 block w-full rounded-lg bg-stone-50 px-3 py-2 text-base font-normal text-stone-900 ring-1 ring-stone-200"
        >
          {PRAYERS.map((p) => (
            <option key={p} value={p}>
              {PRAYER_LABELS[p]}
            </option>
          ))}
          <option value="jumuah">Jumu&rsquo;ah (Friday)</option>
        </select>
      </label>

      <label className="mt-3 block text-sm font-medium text-stone-700">
        Iqamah time
        <input
          type="time"
          required
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="mt-1 block w-full rounded-lg bg-stone-50 px-3 py-2 text-base font-normal tabular-nums text-stone-900 ring-1 ring-stone-200"
        />
      </label>

      <p className="mt-1 text-xs text-stone-500">
        {showing
          ? `Currently showing ${showing}.`
          : "Nothing is showing for this prayer yet."}
      </p>

      {warning && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {warning}
        </p>
      )}

      <label className="mt-3 block text-sm font-medium text-stone-700">
        How do you know?{" "}
        <span className="font-normal text-stone-500">(optional)</span>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Sign at the masjid, called the office, their website…"
          className="mt-1 block w-full rounded-lg bg-stone-50 px-3 py-2 text-base font-normal text-stone-900 ring-1 ring-stone-200 placeholder:text-stone-400"
        />
      </label>

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="mt-4 w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
      >
        {busy ? "Sending…" : "Send suggestion"}
      </button>
    </form>
  );
}

function Header({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h3 className="text-base font-semibold">Suggest a time</h3>
      <button
        type="button"
        onClick={onClose}
        className="text-sm text-stone-500 hover:text-stone-900"
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
    <div className="mt-4 rounded-xl border border-stone-200 bg-white p-4">
      <Header onClose={onClose} />
      <div className="mt-2">{children}</div>
    </div>
  );
}
