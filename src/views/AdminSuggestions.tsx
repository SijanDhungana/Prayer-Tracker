import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../lib/auth";
import { getSupabase, type SuggestionRow } from "../lib/supabase";
import { masjids } from "../data/masjids";
import { adhanTimes } from "../lib/prayer";
import { clockMinutes, formatTime, minutesOfDay } from "../lib/time";
import { PRAYER_LABELS, PRAYERS, type Prayer } from "../lib/types";
import { listPath, masjidPath, signInPath } from "../lib/route";

type Filter = "pending" | "approved" | "rejected" | "all";

const label = (slot: string) =>
  slot === "jumuah" ? "Jumu'ah" : (PRAYER_LABELS[slot as Prayer] ?? slot);

/** A suggestion is either a clock time or "N minutes after the adhan". */
const describe = (row: SuggestionRow) =>
  row.offset_minutes != null
    ? row.offset_minutes === 0
      ? "right after adhan"
      : `${row.offset_minutes} min after adhan`
    : (row.suggested_time ?? "—");

/**
 * What the app currently shows and what the calculation says, so an admin can
 * judge a suggestion without leaving the page. The masjid's own site is one tap
 * away for the actual confirmation.
 */
function Context({ row, date }: { row: SuggestionRow; date: Date }) {
  const masjid = masjids.find((m) => m.id === row.masjid_id);
  if (!masjid) {
    return (
      <p className="text-xs text-red-700">
        No masjid with id “{row.masjid_id}” — this suggestion can&rsquo;t be
        applied.
      </p>
    );
  }

  const adhan = adhanTimes(masjid, date);
  // Only a clock time can land before its own adhan. An offset is measured
  // from the adhan, so it never can.
  const impossible =
    row.suggested_time != null &&
    row.slot !== "jumuah" &&
    PRAYERS.includes(row.slot as Prayer) &&
    (clockMinutes(row.suggested_time) ?? 0) <
      minutesOfDay(adhan[row.slot as Prayer]);

  return (
    <>
      <p className="mt-1 text-xs text-stone-500">
        {masjid.name} ·{" "}
        {/* A discovered masjid may have no website on file to check against. */}
        {masjid.website && (
          <>
            <a
              className="underline underline-offset-2"
              href={masjid.website}
              target="_blank"
              rel="noreferrer"
            >
              check their site
            </a>{" "}
            ·{" "}
          </>
        )}
        <a className="underline underline-offset-2" href={masjidPath(masjid.id)}>
          open in app
        </a>
      </p>
      {row.slot !== "jumuah" && PRAYERS.includes(row.slot as Prayer) && (
        <p className="mt-1 text-xs text-stone-500">
          {label(row.slot)} adhan today is{" "}
          {formatTime(adhan[row.slot as Prayer])}.
        </p>
      )}
      {impossible && (
        <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
          This is before the prayer begins — almost certainly a morning/evening
          mix-up. Approving it will be refused.
        </p>
      )}
    </>
  );
}

export default function AdminSuggestions({ date }: { date: Date }) {
  const { isAdmin, loading, session } = useAuth();
  const [rows, setRows] = useState<SuggestionRow[] | null>(null);
  const [filter, setFilter] = useState<Filter>("pending");
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const pending = getSupabase();
    if (!pending) return;
    const client = await pending;
    let query = client
      .from("suggestions")
      .select("*")
      .order("created_at", { ascending: false });
    if (filter !== "all") query = query.eq("status", filter);

    const { data, error } = await query;
    if (error) setError(error.message);
    else setRows((data ?? []) as SuggestionRow[]);
  }, [filter]);

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);

  async function review(row: SuggestionRow, status: "approved" | "rejected") {
    const pending = getSupabase();
    if (!pending || !session) return;
    setBusy(row.id);
    setError(null);
    const { error } = await (await pending)
      .from("suggestions")
      .update({
        status,
        reviewed_by: session.user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    setBusy(null);
    if (error) setError(error.message);
    else await load();
  }

  if (loading) return <p className="text-sm text-stone-500">Checking…</p>;

  if (!isAdmin) {
    return (
      <section>
        <h1 className="text-2xl font-semibold tracking-tight">Suggestions</h1>
        <p className="mt-3 rounded-xl border border-dashed border-stone-300 p-6 text-sm text-stone-600">
          {session
            ? "This page is for admins. Your account doesn't have that role."
            : "Sign in with an admin account to review suggestions."}
        </p>
        <a
          href={session ? listPath : signInPath}
          className="mt-4 inline-block text-sm font-medium text-emerald-700 underline underline-offset-2"
        >
          {session ? "← All masjids" : "Sign in"}
        </a>
      </section>
    );
  }

  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight">Suggestions</h1>
      <p className="mt-1 text-sm text-stone-600">
        Approving publishes the time to everyone immediately.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {(["pending", "approved", "rejected", "all"] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={
              "rounded-full px-3 py-1.5 text-sm font-medium capitalize " +
              (filter === f
                ? "bg-emerald-700 text-white"
                : "bg-white text-stone-600 ring-1 ring-stone-200")
            }
          >
            {f}
          </button>
        ))}
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">
          {error}
        </p>
      )}

      {rows === null ? (
        <p className="mt-6 text-sm text-stone-500">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-stone-300 p-6 text-center text-sm text-stone-600">
          Nothing {filter === "all" ? "here" : filter} right now.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {rows.map((row) => (
            <li
              key={row.id}
              className="rounded-xl border border-stone-200 bg-white p-4"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-base font-semibold">
                  {label(row.slot)} → {describe(row)}
                </h2>
                <span
                  className={
                    "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium " +
                    (row.status === "pending"
                      ? "bg-amber-50 text-amber-800"
                      : row.status === "approved"
                        ? "bg-emerald-50 text-emerald-800"
                        : "bg-stone-100 text-stone-600")
                  }
                >
                  {row.status}
                </span>
              </div>

              <Context row={row} date={date} />

              {row.note && (
                <p className="mt-2 text-sm text-stone-700">
                  “{row.note}”
                </p>
              )}
              <p className="mt-1 text-[11px] text-stone-400">
                Submitted {new Date(row.created_at).toLocaleString()}
              </p>

              {row.status === "pending" && (
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    disabled={busy === row.id}
                    onClick={() => review(row, "approved")}
                    className="flex-1 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
                  >
                    Verify
                  </button>
                  <button
                    type="button"
                    disabled={busy === row.id}
                    onClick={() => review(row, "rejected")}
                    className="flex-1 rounded-lg bg-white px-3 py-2 text-sm font-medium text-stone-700 ring-1 ring-stone-200 hover:text-stone-900 disabled:opacity-60"
                  >
                    Reject
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
