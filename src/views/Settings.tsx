import HomeMasjidCard from "../components/HomeMasjidCard";
import LocationChip from "../components/LocationChip";
import SegmentedControl from "../components/SegmentedControl";
import Icon from "../components/Icon";
import { useAuth } from "../lib/auth";
import type { ReferencePoint } from "../lib/location";
import { adhanTimes } from "../lib/prayer";
import { suggestionsPath, signInPath } from "../lib/route";
import {
  ASR_LABELS,
  ASR_NOTES,
  THEME_LABELS,
  applyAsrPreference,
  CLOCK_LABELS,
  useSettings,
  type AsrPreference,
  type Theme,
} from "../lib/settings";
import { authConfigured } from "../lib/supabase";
import { formatTime } from "../lib/time";
import type { Masjid } from "../lib/types";

/**
 * Settings — design spec v2 §8.5.
 *
 * A grouped list, the standard settings pattern, not pills. The Asr radio
 * cards are kept verbatim: §8.5 calls them "the best thing in the app", so
 * they are re-tokenized and otherwise left alone, live preview included.
 */
const OPTIONS: AsrPreference[] = ["masjid", "hanafi", "standard"];

export default function Settings({
  masjids,
  date,
  reference,
}: {
  masjids: Masjid[];
  date: Date;
  reference: ReferencePoint;
}) {
  const { asr, setAsr, theme, setTheme, homeMasjidId, setHomeMasjidId, clock, setClock } =
    useSettings();
  const home = masjids.find((m) => m.id === homeMasjidId) ?? null;
  const { session, email, isAdmin, signOut } = useAuth();

  // Any masjid will do to illustrate the gap — they sit within a few minutes
  // of each other across the city — so use the first and name it, rather than
  // showing a time from nowhere in particular.
  const sample = masjids[0];

  return (
    <section>
      <h1 className="font-display text-title font-semibold">Settings</h1>

      <Group title="Prayer times">
        <div className="px-4 py-4">
          <h3 className="text-body font-medium text-ink">Asr calculation</h3>
          <p className="mt-1 text-meta text-ink-2">
            Asr is the one prayer whose calculated time depends on the school
            you follow — the two are about an hour apart.
          </p>

          <div className="mt-3 overflow-hidden rounded-md border border-line">
            {OPTIONS.map((option, index) => {
              const selected = asr === option;
              const [adjusted] = applyAsrPreference([sample], option);
              return (
                <label
                  key={option}
                  className={
                    "flex cursor-pointer items-center gap-3 p-3 " +
                    (index > 0 ? "border-t border-line " : "") +
                    (selected ? "bg-brand-wash" : "hover:bg-surface-2")
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
                    <span className="mt-0.5 block text-meta text-ink-3">
                      {ASR_NOTES[option]}
                    </span>
                  </span>
                  {sample && (
                    <span className="shrink-0 font-num text-body font-medium text-ink">
                      {formatTime(adhanTimes(adjusted, date).asr)}
                    </span>
                  )}
                </label>
              );
            })}
          </div>
          {sample && (
            <p className="mt-2 text-meta text-ink-3">
              Times shown are today&rsquo;s Asr adhan at {sample.name}.
            </p>
          )}
        </div>

        <div className="border-t border-line px-4 py-4">
          <label
            htmlFor="home-masjid"
            className="block text-body font-medium text-ink"
          >
            My masjid
          </label>
          <p className="mt-1 text-meta text-ink-2">
            The one you usually attend. Its next congregation is pinned to the
            top of Next up.
          </p>
          <select
            id="home-masjid"
            value={homeMasjidId ?? ""}
            onChange={(e) => setHomeMasjidId(e.target.value || null)}
            className="mt-2 min-h-[44px] w-full rounded-md border border-line bg-surface-2 px-3 text-body text-ink"
          >
            <option value="">None</option>
            {masjids.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          {home && <HomeMasjidCard masjid={home} compact />}
        </div>

        <Row label="Location">
          <LocationChip reference={reference} />
        </Row>

        <p className="px-4 pb-4 text-meta text-ink-3">
          Kept on this device. Nothing is sent anywhere.
        </p>
      </Group>

      <Group title="Appearance">
        <div className="px-4 py-4">
          <h3 className="mb-3 text-body font-medium text-ink">Theme</h3>
          <SegmentedControl
            label="Theme"
            value={theme}
            onChange={setTheme}
            options={(["system", "dark", "light"] as Theme[]).map((t) => ({
              value: t,
              label: THEME_LABELS[t],
            }))}
          />
        </div>
        <div className="border-t border-line px-4 py-4">
          <h3 className="mb-1 text-body font-medium text-ink">Time format</h3>
          <p className="mb-3 text-meta text-ink-3">
            System follows your phone, so the app and its widget always agree.
          </p>
          <SegmentedControl
            label="Time format"
            value={clock}
            onChange={setClock}
            options={(["system", "12h", "24h"] as const).map((c) => ({
              value: c,
              label: CLOCK_LABELS[c],
            }))}
          />
        </div>
      </Group>

      <Group title="Data">
        {isAdmin && (
          <LinkRow href={suggestionsPath} label="Suggestions" badge="admin" />
        )}
        <p className="px-4 py-4 text-meta text-ink-3">
          Times come from each masjid&rsquo;s own website, read daily. Adhan
          times are calculated with the adhan library for this location.
        </p>
      </Group>

      {authConfigured && (
        <Group title="Account">
          <div className="px-4 py-4">
            {session ? (
              <>
                <p className="truncate text-body text-ink">{email}</p>
                {isAdmin && (
                  <span className="mt-1 inline-block rounded-full bg-brand-wash px-2 py-0.5 text-meta font-medium text-brand">
                    Admin
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="mt-3 block min-h-[44px] text-body font-medium text-danger"
                >
                  Sign out
                </button>
              </>
            ) : (
              <a
                href={signInPath}
                className="flex min-h-[44px] items-center text-body font-medium text-brand"
              >
                Sign in
              </a>
            )}
          </div>
        </Group>
      )}
    </section>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <h2 className="px-1 text-meta uppercase tracking-[0.08em] text-ink-3">
        {title}
      </h2>
      <div className="mt-2 overflow-hidden rounded-lg border border-line bg-surface">
        {children}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-[56px] flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-2">
      <span className="min-w-0 flex-1 truncate text-body text-ink">{label}</span>
      {children}
    </div>
  );
}

function LinkRow({
  href,
  label,
  badge,
}: {
  href: string;
  label: string;
  badge?: string;
}) {
  return (
    <a
      href={href}
      className="flex min-h-[56px] items-center gap-3 px-4 text-body text-ink hover:bg-surface-2"
    >
      <span className="flex-1">{label}</span>
      {badge && (
        <span className="rounded-full bg-brand-wash px-2 py-0.5 text-meta font-medium text-brand">
          {badge}
        </span>
      )}
      <Icon name="chevron-right" size={18} />
    </a>
  );
}
