import { useState } from "react";
import {
  submissionUrl,
  warnIfBeforeAdhan,
  type Suggestion,
} from "../lib/suggestions";
import { formatTime } from "../lib/time";
import { PRAYERS, PRAYER_LABELS, type Masjid, type Prayer } from "../lib/types";

type Slot = Prayer | "jumuah";

export default function SuggestTimeForm({
  masjid,
  date,
  adhan,
  iqamah,
  initialPrayer,
  onClose,
}: {
  masjid: Masjid;
  date: Date;
  adhan: Record<Prayer, Date>;
  iqamah: Record<Prayer, Date | null>;
  initialPrayer: Slot;
  onClose: () => void;
}) {
  const [prayer, setPrayer] = useState<Slot>(initialPrayer);
  const [time, setTime] = useState("");
  const [source, setSource] = useState("");

  const showing =
    prayer === "jumuah"
      ? masjid.jumuah.map((j) => j.khutbah).join(", ") || null
      : iqamah[prayer]
        ? formatTime(iqamah[prayer]!)
        : null;

  const warning = time ? warnIfBeforeAdhan(prayer, time, adhan) : null;

  const suggestion: Suggestion = {
    masjid,
    prayer,
    time,
    source,
    date,
    currentlyShowing: showing,
  };

  return (
    <form
      className="mt-4 rounded-xl border border-stone-200 bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        window.open(submissionUrl(suggestion), "_blank", "noopener,noreferrer");
        onClose();
      }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-base font-semibold">Suggest a time</h3>
        <button
          type="button"
          onClick={onClose}
          className="text-sm text-stone-500 hover:text-stone-900"
        >
          Cancel
        </button>
      </div>
      <p className="mt-1 text-sm text-stone-600">
        Know this masjid&rsquo;s iqamah? Tell us and we&rsquo;ll check it against
        the masjid.
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
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="Sign at the masjid, called the office, their website…"
          className="mt-1 block w-full rounded-lg bg-stone-50 px-3 py-2 text-base font-normal text-stone-900 ring-1 ring-stone-200 placeholder:text-stone-400"
        />
      </label>

      <button
        type="submit"
        className="mt-4 w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"
      >
        Send suggestion
      </button>
      <p className="mt-2 text-[11px] text-stone-500">
        Opens a pre-filled report on GitHub, where corrections are tracked. A
        free GitHub account is needed to post it.
      </p>
    </form>
  );
}
