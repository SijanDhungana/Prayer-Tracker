import { useState } from "react";

import AddressInput from "../components/AddressInput";
import TripMap from "../components/TripMap";
import { formatDistance, haversineKm, type Point } from "../lib/distance";
import { googleMapsConfigured } from "../lib/googleMaps";
import type { ReferencePoint } from "../lib/location";
import { adhanTimes, iqamahTimes } from "../lib/prayer";
import { formatTime, minutesOfDay, todayIn, zonedTimeOnDate } from "../lib/time";
import {
  candidatesAlongRoute,
  directionsUrl,
  drivingMinutes,
  drivingMinutesTo,
  geocode,
  type GeocodeResult,
} from "../lib/travel";
import {
  DEFAULT_ARRIVAL_BUFFER_MINUTES,
  DEFAULT_STOP_MINUTES,
  LONG_WAIT_MINUTES,
  planTrip,
  planWhenToLeave,
  type Candidate,
  type Option,
  type PlanResult,
  type Priority,
} from "../lib/tripPlan";
import { PRAYERS, PRAYER_LABELS, type Masjid, type Prayer } from "../lib/types";

/** How far off the straight line a masjid can sit and still count. */
const CORRIDOR_KM = 6;
/** Cap on masjids priced per search — each one costs a matrix element. */
const MAX_CANDIDATES = 8;

type Phase = "idle" | "working" | "done" | "error";

/** Where the journey starts: the device's position, or somewhere typed. */
type OriginMode = "here" | "address";
/**
 * When it starts: right now, a chosen clock time — or unknown, with the
 * planner working backward from the iqamah to the latest workable departure.
 */
type DepartMode = "now" | "later" | "latest";

export default function PlanTrip({
  masjids,
  reference,
}: {
  masjids: Masjid[];
  reference: ReferencePoint;
}) {
  const today = todayIn();

  const [originMode, setOriginMode] = useState<OriginMode>("here");
  const [originText, setOriginText] = useState("");
  const [originPicked, setOriginPicked] = useState<GeocodeResult | null>(null);

  const [departMode, setDepartMode] = useState<DepartMode>("now");
  const [departAt, setDepartAt] = useState("");

  const [destination, setDestination] = useState("");
  // Set when a suggestion is picked, so submitting doesn't pay to geocode
  // text Google already resolved.
  const [picked, setPicked] = useState<GeocodeResult | null>(null);
  const [deadline, setDeadline] = useState("");
  const [prayer, setPrayer] = useState<Prayer>(() => currentPrayer(masjids, today));
  const [priority, setPriority] = useState<Priority>("destination");

  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PlanResult | null>(null);
  const [destLabel, setDestLabel] = useState<string | null>(null);
  const [destPoint, setDestPoint] = useState<Point | null>(null);
  const [originLabel, setOriginLabel] = useState<string | null>(null);
  const [originResolved, setOriginResolved] = useState<Point | null>(null);
  const [searched, setSearched] = useState(0);
  // Remounts Results per successful plan, so the map's selection resets.
  const [planKey, setPlanKey] = useState(0);

  // A chosen departure is a clock time today; anything unparseable falls back
  // to leaving now rather than silently planning for midnight.
  const departureTime =
    departMode === "later" && departAt
      ? (zonedTimeOnDate(today, departAt) ?? new Date())
      : new Date();

  const originReady =
    originMode === "here" || originPicked != null || originText.trim() !== "";

  // Says what "here" actually resolves to, rather than promising a device
  // location the browser may never have given us.
  const locationLabel =
    reference.status === "active" ? "My location" : reference.label;

  async function plan(event: React.FormEvent) {
    event.preventDefault();
    if (!destination.trim()) return;

    setPhase("working");
    setError(null);
    setResult(null);

    try {
      const now = departureTime;
      // "Here" means the reference point the picker resolved — the device's
      // position when it was shared, the chosen neighbourhood otherwise.
      const start =
        originMode === "here"
          ? { point: reference.point, label: reference.label }
          : (originPicked ?? (await geocode(originText.trim())));
      const from = start.point;

      const target = picked ?? (await geocode(destination.trim()));
      setDestLabel(target.label);
      setDestPoint(target.point);
      setOriginLabel(start.label);
      setOriginResolved(from);

      const shortlist = candidatesAlongRoute(
        masjids,
        from,
        target.point,
        CORRIDOR_KM,
        MAX_CANDIDATES,
      );
      setSearched(shortlist.length);

      if (shortlist.length === 0) {
        setResult({
          viable: [],
          compromises: [],
          directArrival: null,
          directMeetsDeadline: true,
        });
        setPhase("done");
        return;
      }

      // Leg 1 and the direct drive share an origin, so one call covers both:
      // the destination rides along as the last entry.
      const points = shortlist.map((m) => ({ lat: m.lat, lng: m.lng }));
      const outbound = await drivingMinutes(
        from,
        [...points, target.point],
        now,
      );
      const directMinutes = outbound[outbound.length - 1];
      if (directMinutes == null) {
        throw new Error("Couldn't find a route to that destination.");
      }

      // Leg 2 leaves after praying. One representative departure — the
      // candidates are all within half an hour of each other, and paying for
      // a per-masjid prediction isn't worth the couple of minutes it'd shave.
      const iqamahByMasjid = shortlist.map(
        (masjid) => iqamahTimes(masjid, today)[prayer],
      );
      const departAfter = representativeDeparture(now, iqamahByMasjid);
      const inbound = await drivingMinutesTo(points, target.point, departAfter);

      const deadlineAt = deadline ? zonedTimeOnDate(today, deadline) : null;
      const windowEnds = prayerWindowEnds(shortlist, prayer, today);

      const candidates: Candidate[] = [];
      shortlist.forEach((masjid, index) => {
        const toMasjid = outbound[index];
        const toDestination = inbound[index];
        // A masjid Google can't route to is dropped, not guessed at.
        if (toMasjid == null || toDestination == null) return;
        candidates.push({
          masjid,
          legs: { toMasjid, toDestination },
          iqamah: iqamahByMasjid[index],
          prayerWindowEnds: windowEnds[index],
        });
      });

      // "Tell me when": each candidate gets its own departure, worked back
      // from its iqamah. The legs were priced at current traffic — close
      // enough for departures within the next couple of hours, and the
      // alternative is a paid matrix call per candidate.
      setResult(
        departMode === "latest"
          ? planWhenToLeave(
              candidates,
              { now, deadline: deadlineAt, prayer },
              directMinutes,
            )
          : planTrip(
              candidates,
              { now, deadline: deadlineAt, prayer },
              directMinutes,
              priority,
            ),
      );
      setPlanKey((k) => k + 1);
      setPhase("done");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong planning that trip.",
      );
      setPhase("error");
    }
  }

  if (!googleMapsConfigured) {
    return (
      <section>
        <h1 className="text-2xl font-semibold tracking-tight">Plan a trip</h1>
        <p className="mt-3 rounded-xl border border-dashed border-stone-300 p-6 text-center text-sm text-stone-600">
          Trip planning needs a Google Maps API key. Everything else on the
          site works without it.
        </p>
      </section>
    );
  }

  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight">Plan a trip</h1>
      <p className="mt-1 text-sm text-stone-600">
        Where are you headed? We&rsquo;ll find masjids on the way and work out
        whether you can pray and still get there.
      </p>

      <form onSubmit={plan} className="mt-4 space-y-4">
        <Field label="Leaving from">
          <Segmented
            options={[
              { value: "here", label: locationLabel },
              { value: "address", label: "An address" },
            ]}
            value={originMode}
            onChange={(mode) => setOriginMode(mode as OriginMode)}
          />
          {originMode === "here" ? (
            reference.status === "active" ? (
              <p className="mt-1.5 text-xs text-emerald-700">
                Using your device&rsquo;s location.
              </p>
            ) : (
              <p className="mt-1.5 text-xs text-stone-500">
                Set above, or{" "}
                <button
                  type="button"
                  onClick={reference.useDeviceLocation}
                  disabled={reference.status === "locating"}
                  className="font-medium text-emerald-700 underline underline-offset-2 disabled:opacity-60"
                >
                  {reference.status === "locating"
                    ? "locating…"
                    : "use my location"}
                </button>
                .
              </p>
            )
          ) : (
            <div className="mt-1.5">
              <AddressInput
                value={originText}
                onChange={setOriginText}
                onResolved={setOriginPicked}
                bias={reference.point}
                placeholder="Where you're setting off from"
              />
            </div>
          )}
        </Field>

        <Field label="Leaving at">
          <Segmented
            options={[
              { value: "now", label: "Now" },
              { value: "later", label: "A set time" },
              { value: "latest", label: "Tell me when" },
            ]}
            value={departMode}
            onChange={(mode) => setDepartMode(mode as DepartMode)}
          />
          {departMode === "latest" && (
            <p className="mt-1.5 text-xs text-stone-500">
              We&rsquo;ll work back from each masjid&rsquo;s iqamah and tell
              you the latest you can set off.
            </p>
          )}
          {departMode === "later" && (
            <>
              <input
                type="time"
                value={departAt}
                onChange={(e) => setDepartAt(e.target.value)}
                className="mt-1.5 w-full rounded-lg bg-white px-3 py-2 text-sm tabular-nums text-stone-900 ring-1 ring-stone-200"
              />
              {departAt && departureTime < new Date() && (
                <p className="mt-1.5 text-xs text-amber-700">
                  That&rsquo;s earlier today — the plan uses today&rsquo;s
                  prayer times, and traffic is estimated for now.
                </p>
              )}
            </>
          )}
        </Field>

        <Field label="Going to">
          <AddressInput
            value={destination}
            onChange={setDestination}
            onResolved={setPicked}
            bias={reference.point}
            placeholder="Costco, 50 Overlea Blvd"
          />
        </Field>

        <div className="flex flex-wrap gap-3">
          <label className="min-w-0 flex-1">
            <span className="text-sm font-medium text-stone-700">
              Arrive by <span className="font-normal text-stone-400">(optional)</span>
            </span>
            <input
              type="time"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="mt-1 w-full rounded-lg bg-white px-3 py-2 text-sm tabular-nums text-stone-900 ring-1 ring-stone-200"
            />
          </label>

          <label className="min-w-0 flex-1">
            <span className="text-sm font-medium text-stone-700">Prayer</span>
            <select
              value={prayer}
              onChange={(e) => setPrayer(e.target.value as Prayer)}
              className="mt-1 w-full rounded-lg bg-white px-3 py-2 text-sm text-stone-900 ring-1 ring-stone-200"
            >
              {PRAYERS.map((p) => (
                <option key={p} value={p}>
                  {PRAYER_LABELS[p]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <fieldset className={departMode === "latest" ? "hidden" : undefined}>
          <legend className="text-sm font-medium text-stone-700">
            What matters more?
          </legend>
          <div className="mt-1.5 flex gap-2">
            <PriorityChip
              active={priority === "destination"}
              onClick={() => setPriority("destination")}
              label="Getting there on time"
              hint="Prayer if it fits"
            />
            <PriorityChip
              active={priority === "prayer"}
              onClick={() => setPriority("prayer")}
              label="Catching the jamaah"
              hint="Arrive late if needed"
            />
          </div>
        </fieldset>

        <button
          type="submit"
          disabled={phase === "working" || !destination.trim() || !originReady}
          className="w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {phase === "working" ? "Working it out…" : "Find a way"}
        </button>
      </form>

      <p className="mt-2 text-xs text-stone-500">
        Assumes {DEFAULT_STOP_MINUTES} minutes at the masjid and{" "}
        {DEFAULT_ARRIVAL_BUFFER_MINUTES} minutes to park and walk in.
      </p>

      {error && (
        <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {error}
        </p>
      )}

      {result && phase === "done" && (
        <Results
          key={planKey}
          result={result}
          mode={departMode}
          priority={priority}
          prayer={prayer}
          destLabel={destLabel}
          destPoint={destPoint}
          originLabel={originLabel}
          from={originResolved ?? reference.point}
          searched={searched}
        />
      )}
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <span className="block text-sm font-medium text-stone-700">{label}</span>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function Segmented({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={
            "min-w-0 flex-1 truncate rounded-lg px-3 py-2 text-sm font-medium transition-colors " +
            (value === option.value
              ? "bg-emerald-700 text-white"
              : "bg-white text-stone-700 ring-1 ring-stone-200 hover:text-stone-900")
          }
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function PriorityChip({
  active,
  onClick,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        "min-w-0 flex-1 rounded-lg px-3 py-2 text-left text-sm transition-colors " +
        (active
          ? "bg-emerald-700 text-white"
          : "bg-white text-stone-700 ring-1 ring-stone-200 hover:text-stone-900")
      }
    >
      <span className="block font-medium">{label}</span>
      <span
        className={
          "block text-[11px] " + (active ? "text-emerald-100" : "text-stone-500")
        }
      >
        {hint}
      </span>
    </button>
  );
}

function Results({
  result,
  mode,
  priority,
  prayer,
  destLabel,
  destPoint,
  originLabel,
  from,
  searched,
}: {
  result: PlanResult;
  mode: DepartMode;
  priority: Priority;
  prayer: Prayer;
  destLabel: string | null;
  destPoint: Point | null;
  originLabel: string | null;
  from: Point;
  searched: number;
}) {
  const label = PRAYER_LABELS[prayer];
  const nothing = result.viable.length === 0 && result.compromises.length === 0;

  // The option whose route is drawn. Starts on the best one.
  const first = result.viable[0] ?? result.compromises[0] ?? null;
  const [selectedId, setSelectedId] = useState<string | null>(
    first ? first.masjid.id : null,
  );
  const selected =
    [...result.viable, ...result.compromises].find(
      (option) => option.masjid.id === selectedId,
    ) ?? first;

  return (
    <div className="mt-6">
      {destLabel && (
        <p className="text-sm text-stone-600">
          {originLabel && (
            <>
              From <span className="font-medium text-stone-900">{originLabel}</span>{" "}
              to{" "}
            </>
          )}
          {!originLabel && "To "}
          <span className="font-medium text-stone-900">{destLabel}</span>
          {result.directArrival && (
            <>
              {" "}
              · straight there by{" "}
              <span className="tabular-nums">
                {formatTime(result.directArrival)}
              </span>
            </>
          )}
        </p>
      )}

      {selected && destPoint && (
        <TripMap
          from={from}
          masjid={selected.masjid}
          destination={destPoint}
        />
      )}

      {nothing ? (
        <p className="mt-3 rounded-xl border border-dashed border-stone-300 p-6 text-center text-sm text-stone-600">
          {searched === 0
            ? "No masjids sit anywhere near that route. Try a destination across town, or check the Map tab."
            : `None of the ${searched} masjids on that route can fit ${label} in — the prayer window closes before you'd arrive.`}
        </p>
      ) : (
        <>
          {result.viable.length > 0 ? (
            <>
              <h2 className="mt-4 text-sm font-semibold text-stone-900">
                {mode === "latest"
                  ? `Catches ${label} and still gets you there`
                  : priority === "destination"
                    ? "Gets you there on time"
                    : `Catches ${label} in jamaah`}
              </h2>
              <ul className="mt-2 space-y-3">
                {result.viable.map((option) => (
                  <OptionCard
                    key={option.masjid.id}
                    option={option}
                    mode={mode}
                    prayer={prayer}
                    from={from}
                    destPoint={destPoint}
                    selected={selected?.masjid.id === option.masjid.id}
                    onShow={() => setSelectedId(option.masjid.id)}
                  />
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {mode === "latest"
                ? `No departure catches ${label} and still makes your deadline. Closest options below.`
                : priority === "destination"
                  ? "Nothing gets you there on time with a prayer stop. Closest options below."
                  : `No masjid on this route makes ${label} in jamaah. Closest options below.`}
            </p>
          )}

          {result.compromises.length > 0 && (
            <>
              <h2 className="mt-6 text-sm font-semibold text-stone-900">
                {mode === "latest"
                  ? "Not quite"
                  : priority === "destination"
                    ? "Would make you late"
                    : "Misses the jamaah"}
              </h2>
              <p className="text-xs text-stone-500">
                Shown so the call is yours, not the app&rsquo;s.
              </p>
              <ul className="mt-2 space-y-3">
                {result.compromises.slice(0, 3).map((option) => (
                  <OptionCard
                    key={option.masjid.id}
                    option={option}
                    mode={mode}
                    prayer={prayer}
                    from={from}
                    destPoint={destPoint}
                    selected={selected?.masjid.id === option.masjid.id}
                    onShow={() => setSelectedId(option.masjid.id)}
                    muted
                  />
                ))}
              </ul>
            </>
          )}
        </>
      )}

      <p className="mt-4 text-xs text-stone-500">
        Drive times are Google&rsquo;s traffic estimates and iqamah times are
        community-collected — leave yourself room.
      </p>
    </div>
  );
}

function OptionCard({
  option,
  mode,
  prayer,
  from,
  destPoint,
  selected = false,
  onShow,
  muted = false,
}: {
  option: Option;
  mode: DepartMode;
  prayer: Prayer;
  from: Point;
  destPoint: Point | null;
  selected?: boolean;
  onShow?: () => void;
  muted?: boolean;
}) {
  const { masjid, timeline } = option;
  const label = PRAYER_LABELS[prayer];

  return (
    <li
      className={
        "rounded-xl border bg-white p-4 " +
        (selected
          ? "border-emerald-400 ring-1 ring-emerald-400 "
          : muted
            ? "border-stone-200 "
            : "border-emerald-200 ") +
        (muted ? "opacity-90" : "shadow-sm")
      }
    >
      {mode === "latest" && (
        <p className="mb-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900">
          Leave by{" "}
          <span className="text-lg tabular-nums">
            {formatTime(timeline.leaveNow)}
          </span>
        </p>
      )}
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="min-w-0 text-base font-semibold text-stone-900">
          {masjid.name}
        </h3>
        <span className="shrink-0 text-xs tabular-nums text-stone-500">
          {formatDistance(haversineKm(from, masjid))}
        </span>
      </div>

      <div className="mt-1 flex flex-wrap gap-1.5">
        <Badge tone={option.catchesJamaah ? "good" : "warn"}>
          {option.catchesJamaah ? `${label} in jamaah` : `Misses ${label} jamaah`}
        </Badge>
        <Badge tone={option.meetsDeadline ? "good" : "warn"}>
          {option.meetsDeadline
            ? "On time"
            : `${Math.round(option.minutesLate)} min late`}
        </Badge>
        <Badge tone="neutral">
          +{Math.round(timeline.detourMinutes)} min detour
        </Badge>
      </div>

      <ol className="mt-3 space-y-1 border-t border-stone-100 pt-3 text-sm">
        <Step time={timeline.leaveNow} text="Leave" />
        <Step time={timeline.arriveMasjid} text="Reach the masjid" />
        {timeline.waitMinutes >= 1 && (
          <Step
            time={timeline.prayStart}
            text={`${label} iqamah`}
            note={`wait ${Math.round(timeline.waitMinutes)} min`}
          />
        )}
        <Step time={timeline.departMasjid} text="Back on the road" />
        <Step
          time={timeline.arriveDestination}
          text="Arrive"
          emphasis
        />
      </ol>

      {timeline.couldLeaveAt &&
        timeline.waitMinutes > LONG_WAIT_MINUTES && (
          <p className="mt-2 rounded-lg bg-stone-50 px-2.5 py-1.5 text-xs text-stone-600">
            That&rsquo;s a {Math.round(timeline.waitMinutes)} minute wait —
            leave at{" "}
            <span className="font-semibold tabular-nums text-stone-900">
              {formatTime(timeline.couldLeaveAt)}
            </span>{" "}
            instead and walk in just before the iqamah.
          </p>
        )}

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium">
        {!selected && onShow && (
          <button
            type="button"
            onClick={onShow}
            className="text-emerald-700 underline underline-offset-2"
          >
            Show on map
          </button>
        )}
        {destPoint && (
          <a
            href={directionsUrl(from, masjid, destPoint)}
            target="_blank"
            rel="noreferrer"
            className="text-emerald-700 underline underline-offset-2"
          >
            Directions via this masjid →
          </a>
        )}
      </div>
    </li>
  );
}

function Step({
  time,
  text,
  note,
  emphasis = false,
}: {
  time: Date;
  text: string;
  note?: string;
  emphasis?: boolean;
}) {
  return (
    <li className="flex items-baseline gap-3">
      <span
        className={
          "w-[4.5rem] shrink-0 tabular-nums " +
          (emphasis ? "font-semibold text-stone-900" : "text-stone-500")
        }
      >
        {formatTime(time)}
      </span>
      <span className={emphasis ? "font-medium text-stone-900" : "text-stone-700"}>
        {text}
        {note && <span className="ml-1.5 text-xs text-stone-400">({note})</span>}
      </span>
    </li>
  );
}

function Badge({
  tone,
  children,
}: {
  tone: "good" | "warn" | "neutral";
  children: React.ReactNode;
}) {
  const tones = {
    good: "bg-emerald-50 text-emerald-800",
    warn: "bg-amber-50 text-amber-800",
    neutral: "bg-stone-100 text-stone-600",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/**
 * A single departure time to price the homeward leg with.
 *
 * The candidates' iqamahs are all within about half an hour, so the latest of
 * them plus the stop is close enough for a traffic prediction — and it errs
 * toward the busier end rather than flattering the estimate.
 */
function representativeDeparture(now: Date, iqamahs: (Date | null)[]): Date {
  const times = iqamahs.filter((t): t is Date => t != null && t > now);
  const anchor =
    times.length > 0
      ? new Date(Math.max(...times.map((t) => t.getTime())))
      : now;
  return new Date(anchor.getTime() + DEFAULT_STOP_MINUTES * 60_000);
}

/**
 * When each prayer's window shuts — the next prayer's adhan, since a prayer
 * is only valid until then. Isha is left open: it runs into the night, and
 * cutting it at midnight would wrongly rule out late trips.
 */
function prayerWindowEnds(
  masjids: Masjid[],
  prayer: Prayer,
  today: Date,
): (Date | null)[] {
  const order = PRAYERS.indexOf(prayer);
  const next = PRAYERS[order + 1];
  if (!next) return masjids.map(() => null);
  return masjids.map((masjid) => adhanTimes(masjid, today)[next]);
}

/** Default the picker to the prayer you're most likely planning around. */
function currentPrayer(masjids: Masjid[], today: Date): Prayer {
  const reference = masjids[0];
  if (!reference) return "dhuhr";

  const times = adhanTimes(reference, today);
  const nowMinutes = minutesOfDay(new Date());

  // The last prayer whose adhan has passed — that's the one you still owe.
  let current: Prayer = "fajr";
  for (const prayer of PRAYERS) {
    if (minutesOfDay(times[prayer]) <= nowMinutes) current = prayer;
  }
  return current;
}
