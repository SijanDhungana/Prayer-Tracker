import WidgetKit
import SwiftUI

/// The home-screen widget: the next iqamah at the nearest masjid.
///
/// Iqamah, not adhan — that is the whole point of the app (CLAUDE.md §2), and
/// a widget showing the astronomical time would answer a question nobody is
/// asking on a home screen. The adhan is shown underneath, smaller, because
/// the gap between the two is what tells you whether you can still make it.
struct PrayerEntry: TimelineEntry {
    let date: Date
    let upcoming: PrayerMath.Upcoming?
    let distanceKm: Double?
    /// Nearby alternatives, for the medium size.
    let alsoNearby: [(masjid: Masjid, iqamah: Date, km: Double)]
    /// Why there is nothing to show, when there is nothing to show.
    let problem: String?
    /// Times older than the app's 45-day threshold, or never scraper-verified.
    let unverified: Bool
    let usingCachedData: Bool
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> PrayerEntry {
        PrayerEntry(date: Date(), upcoming: nil, distanceKm: nil, alsoNearby: [],
                    problem: nil, unverified: false, usingCachedData: false)
    }

    func getSnapshot(in context: Context, completion: @escaping (PrayerEntry) -> Void) {
        Task { completion(await entry(for: Date())) }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<PrayerEntry>) -> Void) {
        Task {
            let now = Date()
            let first = await entry(for: now)

            /// One entry a minute so the countdown stays honest without asking
            /// iOS to wake us every minute — entries are cheap, reloads are
            /// budgeted. The run stops at the iqamah itself, which is exactly
            /// when the answer changes.
            var entries = [first]
            let horizon = min(first.upcoming?.iqamah ?? now.addingTimeInterval(1800),
                              now.addingTimeInterval(3600))
            var t = now.addingTimeInterval(60)
            while t < horizon {
                entries.append(PrayerEntry(date: t, upcoming: first.upcoming,
                                           distanceKm: first.distanceKm,
                                           alsoNearby: first.alsoNearby,
                                           problem: first.problem,
                                           unverified: first.unverified,
                                           usingCachedData: first.usingCachedData))
                t = t.addingTimeInterval(60)
            }
            // Recompute at the iqamah — the next prayer, and possibly the
            // nearest masjid, are different from that instant on.
            let reload = first.upcoming?.iqamah.addingTimeInterval(30)
                ?? now.addingTimeInterval(1800)
            completion(Timeline(entries: entries, policy: .after(reload)))
        }
    }

    private func entry(for now: Date) async -> PrayerEntry {
        let (masjids, cached) = await MasjidDirectory.load()
        guard !masjids.isEmpty else {
            return PrayerEntry(date: now, upcoming: nil, distanceKm: nil, alsoNearby: [],
                               problem: "No masjid data yet — open the app once",
                               unverified: false, usingCachedData: cached)
        }
        guard let fix = await WidgetLocation().current() else {
            return PrayerEntry(date: now, upcoming: nil, distanceKm: nil, alsoNearby: [],
                               problem: "Location off for widgets",
                               unverified: false, usingCachedData: cached)
        }

        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = .current
        let near = PrayerMath.nearest(to: fix.coordinate.latitude,
                                      fix.coordinate.longitude, in: masjids, limit: 6)

        // The nearest masjid with a resolvable next iqamah. A masjid whose
        // rules cannot be solved is skipped rather than shown blank — being
        // closest is not useful if it cannot answer the question.
        var chosen: (PrayerMath.Upcoming, Double)?
        var others: [(Masjid, Date, Double)] = []
        for (masjid, km) in near {
            guard let up = PrayerMath.next(after: now, at: masjid, calendar: calendar)
            else { continue }
            if chosen == nil { chosen = (up, km) }
            else if others.count < 2 { others.append((masjid, up.iqamah, km)) }
        }
        guard let (upcoming, km) = chosen else {
            return PrayerEntry(date: now, upcoming: nil, distanceKm: nil, alsoNearby: [],
                               problem: "No iqamah times nearby",
                               unverified: false, usingCachedData: cached)
        }
        return PrayerEntry(
            date: now, upcoming: upcoming, distanceKm: km,
            alsoNearby: others.map { (masjid: $0.0, iqamah: $0.1, km: $0.2) },
            problem: nil,
            unverified: (upcoming.masjid.needsReview ?? false)
                || PrayerMath.isStale(upcoming.masjid.lastVerified, now: now),
            usingCachedData: cached)
    }
}

private let clock: DateFormatter = {
    let f = DateFormatter(); f.dateFormat = "h:mm"; return f
}()

struct PrayerWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: PrayerEntry

    var body: some View {
        if let problem = entry.problem {
            VStack(alignment: .leading, spacing: 4) {
                Text("Masjid Times").font(.caption2).foregroundStyle(.secondary)
                Text(problem).font(.footnote).fontWeight(.medium)
                    .minimumScaleFactor(0.8).lineLimit(3)
            }
        } else if let up = entry.upcoming {
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 4) {
                    Text(up.prayer.label.uppercased())
                        .font(.caption2).fontWeight(.semibold).foregroundStyle(.secondary)
                    if up.isTomorrow {
                        Text("TOMORROW").font(.system(size: 9)).foregroundStyle(.tertiary)
                    }
                    // A quiet mark, not a warning: these times are
                    // community-collected and the app says so wherever they
                    // appear (CLAUDE.md §14).
                    if entry.unverified {
                        Image(systemName: "exclamationmark.circle")
                            .font(.system(size: 9)).foregroundStyle(.tertiary)
                    }
                }

                Text(clock.string(from: up.iqamah))
                    .font(.system(size: family == .systemSmall ? 34 : 40,
                                  weight: .semibold, design: .rounded))
                    .minimumScaleFactor(0.7).lineLimit(1)

                Text(up.iqamah, style: .relative)
                    .font(.caption2).foregroundStyle(.secondary).lineLimit(1)

                Text(up.masjid.name)
                    .font(.caption2).fontWeight(.medium)
                    .lineLimit(2).minimumScaleFactor(0.8)
                    .padding(.top, 2)

                if let km = entry.distanceKm {
                    Text(km < 1 ? "\(Int(km * 1000)) m · adhan \(clock.string(from: up.adhan))"
                                : String(format: "%.1f km · adhan %@", km, clock.string(from: up.adhan)))
                        .font(.system(size: 9)).foregroundStyle(.tertiary).lineLimit(1)
                }

                if family != .systemSmall, !entry.alsoNearby.isEmpty {
                    Divider().padding(.vertical, 3)
                    ForEach(entry.alsoNearby, id: \.masjid.id) { other in
                        HStack(spacing: 6) {
                            Text(other.masjid.name).font(.system(size: 10))
                                .lineLimit(1).truncationMode(.tail)
                            Spacer(minLength: 4)
                            Text(clock.string(from: other.iqamah))
                                .font(.system(size: 10, weight: .medium))
                                .monospacedDigit()
                        }
                        .foregroundStyle(.secondary)
                    }
                }
            }
        }
    }
}

@main
struct PrayerWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "PrayerWidget", provider: Provider()) { entry in
            PrayerWidgetView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Next Iqamah")
        .description("The next congregation at the masjid nearest you.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
