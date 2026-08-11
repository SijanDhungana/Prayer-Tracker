import {
  ASR_LABELS,
  ASR_NOTES,
  THEME_LABELS,
  useSettings,
  type AsrPreference,
  type Theme,
} from "../lib/settings";
import { adhanTimes } from "../lib/prayer";
import { formatTime } from "../lib/time";
import { applyAsrPreference } from "../lib/settings";
import type { Masjid } from "../lib/types";

const OPTIONS: AsrPreference[] = ["masjid", "hanafi", "standard"];

/**
 * A worked example beats a definition. Showing what today's Asr actually
 * becomes at a masjid the visitor can see makes the hour-long gap concrete
 * before they commit to a choice.
 */
function Preview({
  masjid,
  option,
  date,
}: {
  masjid: Masjid;
  option: AsrPreference;
  date: Date;
}) {
  const [adjusted] = applyAsrPreference([masjid], option);
  return (
    <span className="shrink-0 text-sm font-semibold tabular-nums text-ink">
      {formatTime(adhanTimes(adjusted, date).asr)}
    </span>
  );
}

export default function Settings({
  masjids,
  date,
}: {
  masjids: Masjid[];
  date: Date;
}) {
  const { asr, setAsr, theme, setTheme } = useSettings();

  // Any masjid will do to illustrate the gap — they sit within a few minutes
  // of each other across the city — so use the first one and name it, rather
  // than showing a time from nowhere in particular.
  const sample = masjids[0];

  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-1 text-sm text-ink-2">
        Kept on this device. Nothing is sent anywhere.
      </p>

      <h2 className="mt-6 text-base font-semibold">Asr calculation</h2>
      <p className="mt-1 text-sm text-ink-2">
        Asr is the one prayer whose calculated time depends on the school you
        follow — the two are about an hour apart.
      </p>

      <div className="mt-3 overflow-hidden rounded-xl border border-line bg-surface">
        {OPTIONS.map((option, index) => {
          const selected = asr === option;
          return (
            <label
              key={option}
              className={
                "flex cursor-pointer items-center gap-3 p-4 hover:bg-surface-sunk " +
                (index > 0 ? "border-t border-line " : "") +
                (selected ? "bg-brand-wash hover:bg-brand-wash" : "")
              }
            >
              <input
                type="radio"
                name="asr"
                value={option}
                checked={selected}
                onChange={() => setAsr(option)}
                className="h-4 w-4 shrink-0 accent-brand"
              />
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-ink">
                  {ASR_LABELS[option]}
                </span>
                <span className="mt-0.5 block text-xs text-ink-3">
                  {ASR_NOTES[option]}
                </span>
              </span>
              {sample && <Preview masjid={sample} option={option} date={date} />}
            </label>
          );
        })}
      </div>

      {sample && (
        <p className="mt-2 text-xs text-ink-3">
          Times shown are today&rsquo;s Asr adhan at {sample.name}.
        </p>
      )}

      <h2 className="mt-8 text-base font-semibold">Theme</h2>
      <p className="mt-1 text-sm text-ink-2">
        System follows your device, which most people leave on a schedule.
      </p>

      <div className="mt-3 flex gap-2" role="radiogroup" aria-label="Theme">
        {(["system", "light", "dark"] as Theme[]).map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={theme === option}
            onClick={() => setTheme(option)}
            className={
              "min-w-0 flex-1 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors " +
              (theme === option
                ? "bg-brand text-brand-ink"
                : "bg-surface text-ink-2 ring-1 ring-line hover:text-ink")
            }
          >
            {THEME_LABELS[option]}
          </button>
        ))}
      </div>

      <p className="mt-4 rounded-xl bg-surface-sunk px-4 py-3 text-xs text-ink-2">
        This changes the <strong>adhan</strong> times the app calculates. It
        does not change any masjid&rsquo;s iqamah — those are clock times each
        masjid sets itself, and they are shown exactly as published.
      </p>
    </section>
  );
}
