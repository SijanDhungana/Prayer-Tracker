/**
 * "Can I pray on the way there?" — the scheduling engine.
 *
 * Deliberately free of AI and of the network. Given travel durations and an
 * iqamah time, whether a stop works is arithmetic with two yes/no rules, so
 * the answer is exact, explainable, and testable. The fuzzy part (asking
 * Google how long a drive takes) is somebody else's job — see travel.ts.
 */
import type { Masjid, Prayer } from "./types";

/** Time inside the masjid: park, pray the jamaah, get back to the car. */
export const DEFAULT_STOP_MINUTES = 10;

/**
 * Slack against the iqamah. Arriving at the exact minute means missing the
 * first rak'ah — this is the walk from the car to the prayer hall.
 */
export const DEFAULT_ARRIVAL_BUFFER_MINUTES = 3;

export interface TripInputs {
  /** When the trip starts. */
  now: Date;
  /** Latest acceptable arrival at the destination, or null if open-ended. */
  deadline: Date | null;
  prayer: Prayer;
  /** Minutes spent at the masjid. */
  stopMinutes?: number;
  /** Minutes of slack required before iqamah. */
  arrivalBufferMinutes?: number;
}

/** One masjid's travel legs, as told to us by the routing provider. */
export interface Legs {
  /** Minutes from the origin to this masjid, in current traffic. */
  toMasjid: number;
  /** Minutes from this masjid to the destination, leaving after the prayer. */
  toDestination: number;
}

export interface Candidate {
  masjid: Masjid;
  legs: Legs;
  /** Today's iqamah for the chosen prayer, or null if this masjid has none. */
  iqamah: Date | null;
  /** When the prayer's window closes — praying after this doesn't count. */
  prayerWindowEnds?: Date | null;
}

export interface Timeline {
  leaveNow: Date;
  arriveMasjid: Date;
  /** When the prayer actually starts: the iqamah, or arrival if you're late. */
  prayStart: Date;
  departMasjid: Date;
  arriveDestination: Date;
  /** Minutes spent waiting at the masjid before the iqamah. */
  waitMinutes: number;
  /** Extra minutes versus driving straight there. */
  detourMinutes: number;
  /**
   * The latest you could set off and still make the congregation, or null if
   * that's simply now. Leaving immediately to sit outside a masjid for an hour
   * is arithmetically valid and something nobody does, so when the wait is
   * long this is the answer the traveller actually wants.
   */
  couldLeaveAt: Date | null;
}

/** Beyond this, "wait at the masjid" stops being a plan. */
export const LONG_WAIT_MINUTES = 20;

export interface Option {
  masjid: Masjid;
  timeline: Timeline;
  /** In time for the congregation, buffer included. */
  catchesJamaah: boolean;
  /** Arrives at the destination by the deadline (true when there is none). */
  meetsDeadline: boolean;
  /** Minutes late to the destination; 0 when on time. */
  minutesLate: number;
  /** Prayer's window closes before you'd finish — the stop is pointless. */
  missesPrayerWindow: boolean;
}

export type Priority = "destination" | "prayer";

export interface PlanResult {
  /** Options satisfying the priority's hard rule, best first. */
  viable: Option[];
  /**
   * Options that break the hard rule, least-bad first. Shown rather than
   * hidden: "you'd be 5 minutes late" is a decision the traveller should get
   * to make, not one the app should quietly make for them.
   */
  compromises: Option[];
  /** Direct arrival with no prayer stop, for comparison. */
  directArrival: Date | null;
  directMeetsDeadline: boolean;
}

const minutesBetween = (from: Date, to: Date) =>
  (to.getTime() - from.getTime()) / 60_000;

const addMinutes = (date: Date, minutes: number) =>
  new Date(date.getTime() + minutes * 60_000);

/**
 * Walk one masjid's clock forward from "leave now" to "arrive at the
 * destination".
 *
 * The subtle step is `prayStart`: arriving early means *waiting* for the
 * iqamah, not praying on arrival — so the stop is `max(arrival, iqamah)`
 * plus the time inside, which is why a masjid can look close and still cost
 * half an hour.
 */
export function buildTimeline(
  candidate: Candidate,
  inputs: TripInputs,
  directMinutes: number,
): Timeline {
  const stop = inputs.stopMinutes ?? DEFAULT_STOP_MINUTES;
  const buffer = inputs.arrivalBufferMinutes ?? DEFAULT_ARRIVAL_BUFFER_MINUTES;

  const arriveMasjid = addMinutes(inputs.now, candidate.legs.toMasjid);
  const prayStart =
    candidate.iqamah && candidate.iqamah > arriveMasjid
      ? candidate.iqamah
      : arriveMasjid;
  const departMasjid = addMinutes(prayStart, stop);
  const arriveDestination = addMinutes(
    departMasjid,
    candidate.legs.toDestination,
  );

  const viaMinutes = minutesBetween(inputs.now, arriveDestination);
  const waitMinutes = Math.max(0, minutesBetween(arriveMasjid, prayStart));

  // Set off just late enough to walk in on the buffer rather than idle there.
  // Only meaningful when there's a real wait to collapse.
  const latestDeparture =
    candidate.iqamah && waitMinutes > 0
      ? addMinutes(candidate.iqamah, -(buffer + candidate.legs.toMasjid))
      : null;

  return {
    leaveNow: inputs.now,
    arriveMasjid,
    prayStart,
    departMasjid,
    arriveDestination,
    waitMinutes,
    detourMinutes: Math.max(0, viaMinutes - directMinutes),
    couldLeaveAt:
      latestDeparture && latestDeparture > inputs.now ? latestDeparture : null,
  };
}

export function evaluate(
  candidate: Candidate,
  inputs: TripInputs,
  directMinutes: number,
): Option {
  const buffer =
    inputs.arrivalBufferMinutes ?? DEFAULT_ARRIVAL_BUFFER_MINUTES;
  const timeline = buildTimeline(candidate, inputs, directMinutes);

  const catchesJamaah =
    candidate.iqamah != null &&
    addMinutes(timeline.arriveMasjid, buffer) <= candidate.iqamah;

  const minutesLate = inputs.deadline
    ? Math.max(0, minutesBetween(inputs.deadline, timeline.arriveDestination))
    : 0;

  // A stop is pointless if the prayer's window shuts before you'd be done.
  const missesPrayerWindow =
    candidate.prayerWindowEnds != null &&
    timeline.prayStart > candidate.prayerWindowEnds;

  return {
    masjid: candidate.masjid,
    timeline,
    catchesJamaah,
    meetsDeadline: minutesLate === 0,
    minutesLate,
    missesPrayerWindow,
  };
}

/**
 * Rank within the viable set.
 *
 * Under `destination` priority everything here already meets the deadline, so
 * catching the jamaah is the tie-break and detour settles the rest. Under
 * `prayer` priority everything already catches the jamaah, so arriving
 * soonest wins.
 */
function compareViable(a: Option, b: Option, priority: Priority): number {
  if (priority === "destination") {
    if (a.catchesJamaah !== b.catchesJamaah) return a.catchesJamaah ? -1 : 1;
    return a.timeline.detourMinutes - b.timeline.detourMinutes;
  }
  return (
    a.timeline.arriveDestination.getTime() -
    b.timeline.arriveDestination.getTime()
  );
}

/**
 * Rank the near-misses by how much they cost you, so the first compromise
 * shown is the smallest one.
 */
function compareCompromises(a: Option, b: Option, priority: Priority): number {
  if (priority === "destination") {
    // Least late first; among equals, prefer one that at least gets the jamaah.
    if (a.minutesLate !== b.minutesLate) return a.minutesLate - b.minutesLate;
    if (a.catchesJamaah !== b.catchesJamaah) return a.catchesJamaah ? -1 : 1;
    return a.timeline.detourMinutes - b.timeline.detourMinutes;
  }
  // Prayer priority: missing the jamaah is the failure, so surface the ones
  // that come closest to it, then those that cost the least time.
  if (a.catchesJamaah !== b.catchesJamaah) return a.catchesJamaah ? -1 : 1;
  return a.minutesLate - b.minutesLate;
}

/**
 * Split the candidates into "meets your priority" and "doesn't, and here's
 * the cost".
 *
 * `priority` decides which rule is inviolable: with `destination` the deadline
 * is hard and the prayer is a bonus; with `prayer` the congregation is hard
 * and the deadline bends.
 */
export function planTrip(
  candidates: Candidate[],
  inputs: TripInputs,
  directMinutes: number,
  priority: Priority,
): PlanResult {
  const directArrival = addMinutes(inputs.now, directMinutes);
  const directMeetsDeadline =
    inputs.deadline == null || directArrival <= inputs.deadline;

  const viable: Option[] = [];
  const compromises: Option[] = [];

  for (const candidate of candidates) {
    const option = evaluate(candidate, inputs, directMinutes);

    // Praying after the window closes isn't a worse option, it's not an
    // option — drop it rather than offering it as a compromise.
    if (option.missesPrayerWindow) continue;

    const satisfies =
      priority === "destination" ? option.meetsDeadline : option.catchesJamaah;

    (satisfies ? viable : compromises).push(option);
  }

  viable.sort((a, b) => compareViable(a, b, priority));
  compromises.sort((a, b) => compareCompromises(a, b, priority));

  return { viable, compromises, directArrival, directMeetsDeadline };
}

/**
 * The reverse question: not "I'm leaving now, what works?" but "how late can
 * I leave and still catch the jamaah AND arrive on time?"
 *
 * Worked backward from the iqamah: leave at
 * `iqamah − buffer − drive(origin → masjid)`, walk in on the buffer, pray,
 * drive on. If that instant has already passed, the jamaah is no longer
 * catchable — the option is evaluated leaving right now instead, and lands in
 * the compromise list with its real cost shown.
 */
export function whenToLeave(
  candidate: Candidate,
  inputs: TripInputs,
  directMinutes: number,
): Option | null {
  // No iqamah means there is nothing to time a departure against.
  if (!candidate.iqamah) return null;

  const buffer =
    inputs.arrivalBufferMinutes ?? DEFAULT_ARRIVAL_BUFFER_MINUTES;
  const latest = new Date(
    candidate.iqamah.getTime() -
      (buffer + candidate.legs.toMasjid) * 60_000,
  );

  const departure = latest >= inputs.now ? latest : inputs.now;
  return evaluate(candidate, { ...inputs, now: departure }, directMinutes);
}

/**
 * Rank candidates by the departure question. Both rules are hard here — the
 * whole point of asking "when do I leave" is making the prayer AND the
 * deadline — so viable means both, and the best option is the one that lets
 * you stay longest before setting off.
 */
export function planWhenToLeave(
  candidates: Candidate[],
  inputs: TripInputs,
  directMinutes: number,
): PlanResult {
  const directArrival = addMinutes(inputs.now, directMinutes);
  const directMeetsDeadline =
    inputs.deadline == null || directArrival <= inputs.deadline;

  const viable: Option[] = [];
  const compromises: Option[] = [];

  for (const candidate of candidates) {
    const option = whenToLeave(candidate, inputs, directMinutes);
    if (!option || option.missesPrayerWindow) continue;
    (option.catchesJamaah && option.meetsDeadline
      ? viable
      : compromises
    ).push(option);
  }

  // Latest departure first — more time before you have to move. Ties break
  // toward arriving sooner.
  viable.sort(
    (a, b) =>
      b.timeline.leaveNow.getTime() - a.timeline.leaveNow.getTime() ||
      a.timeline.arriveDestination.getTime() -
        b.timeline.arriveDestination.getTime(),
  );
  // The prayer is the anchor of the question being asked, so a compromise
  // that still catches the jamaah (but runs late) outranks one that gives
  // the jamaah up.
  compromises.sort((a, b) => compareCompromises(a, b, "prayer"));

  return { viable, compromises, directArrival, directMeetsDeadline };
}
