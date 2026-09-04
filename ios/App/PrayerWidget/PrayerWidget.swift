import WidgetKit
import SwiftUI
import CoreLocation
import MapKit

/// The home-screen widget: the next iqamah at the nearest masjid, where it is,
/// and whether you can still make it.
///
/// Iqamah, not adhan — that is the whole point of the app (CLAUDE.md §2), and
/// a widget showing the astronomical time would answer a question nobody is
/// asking on a home screen. The adhan is shown underneath, smaller, because
/// the gap between the two is what tells you whether you can still make it.
///
/// The medium and large sizes add a map and a travel time. "Leave by" is the
/// number that actually decides whether someone gets up now, and it uses the
/// same allowance the app's trip planner does: three minutes to park and walk
/// in. Small stays text-only — a map at that size is a green smudge.
struct PrayerEntry: TimelineEntry {
    let date: Date
    let upcoming: PrayerMath.Upcoming?
    let distanceKm: Double?
    /// Nearby alternatives, for the larger sizes.
    let alsoNearby: [(masjid: Masjid, iqamah: Date, km: Double)]
    /// Why there is nothing to show, when there is nothing to show.
    let problem: String?
    /// Times older than the app's 45-day threshold, or never scraper-verified.
    let unverified: Bool
    let usingCachedData: Bool
    /// Map snapshots for each appearance; nil until one has rendered.
    let mapLight: UIImage?
    let mapDark: UIImage?
    let travel: Travel?
}

struct Travel {
    enum Mode { case drive, walk }
    let mode: Mode
    let minutes: Int
    /// Iqamah minus travel minus the parking allowance.
    let leaveBy: Date
}

/// The app's own assumption in PlanTrip: "3 minutes to park and walk in".
private let PARKING_ALLOWANCE_MINUTES = 3
/// Under this the walk is the honest estimate; nobody drives 600 m to pray.
private let WALK_UNDER_KM = 1.2

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> PrayerEntry {
        PrayerEntry(date: Date(), upcoming: nil, distanceKm: nil, alsoNearby: [],
                    problem: nil, unverified: false, usingCachedData: false,
                    mapLight: nil, mapDark: nil, travel: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (PrayerEntry) -> Void) {
        Task { completion(await entry(for: Date(), family: context.family)) }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<PrayerEntry>) -> Void) {
        Task {
            let now = Date()
            let first = await entry(for: now, family: context.family)

            /// One entry a minute so the countdown stays honest without asking
            /// iOS to wake us every minute — entries are cheap, reloads are
            /// budgeted. The map and the ETA are computed once and shared.
            var entries = [first]
            let horizon = min(first.upcoming?.iqamah ?? now.addingTimeInterval(1800),
                              now.addingTimeInterval(3600))
            var t = now.addingTimeInterval(60)
            while t < horizon {
                entries.append(PrayerEntry(
                    date: t, upcoming: first.upcoming, distanceKm: first.distanceKm,
                    alsoNearby: first.alsoNearby, problem: first.problem,
                    unverified: first.unverified, usingCachedData: first.usingCachedData,
                    mapLight: first.mapLight, mapDark: first.mapDark, travel: first.travel))
                t = t.addingTimeInterval(60)
            }
            // Recompute at the iqamah — the next prayer, and possibly the
            // nearest masjid, are different from that instant on.
            let reload = first.upcoming?.iqamah.addingTimeInterval(30)
                ?? now.addingTimeInterval(1800)
            completion(Timeline(entries: entries, policy: .after(reload)))
        }
    }

    private func entry(for now: Date, family: WidgetFamily) async -> PrayerEntry {
        let (masjids, cached) = await MasjidDirectory.load()
        guard !masjids.isEmpty else {
            return failed("No masjid data yet — open the app once", now: now, cached: cached)
        }
        guard let fix = await WidgetLocation().current() else {
            return failed("Location off for widgets", now: now, cached: cached)
        }

        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = .current
        let here = fix.coordinate
        let near = PrayerMath.nearest(to: here.latitude, here.longitude, in: masjids, limit: 6)

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
            return failed("No iqamah times nearby", now: now, cached: cached)
        }

        let there = CLLocationCoordinate2D(latitude: upcoming.masjid.lat,
                                           longitude: upcoming.masjid.lng)

        // Only the sizes that draw a map pay for one.
        let wantsMap = family != .systemSmall
        async let travel = travelTime(from: here, to: there, km: km, iqamah: upcoming.iqamah)
        async let light = wantsMap ? MapSnapshot.render(from: here, to: there, dark: false) : nil
        async let dark = wantsMap ? MapSnapshot.render(from: here, to: there, dark: true) : nil

        return PrayerEntry(
            date: now, upcoming: upcoming, distanceKm: km,
            alsoNearby: others.map { (masjid: $0.0, iqamah: $0.1, km: $0.2) },
            problem: nil,
            unverified: (upcoming.masjid.needsReview ?? false)
                || PrayerMath.isStale(upcoming.masjid.lastVerified, now: now),
            usingCachedData: cached,
            mapLight: await light, mapDark: await dark, travel: await travel)
    }

    private func failed(_ problem: String, now: Date, cached: Bool) -> PrayerEntry {
        PrayerEntry(date: now, upcoming: nil, distanceKm: nil, alsoNearby: [],
                    problem: problem, unverified: false, usingCachedData: cached,
                    mapLight: nil, mapDark: nil, travel: nil)
    }

    /// Apple's own ETA for the trip. Walking under WALK_UNDER_KM, driving
    /// otherwise. A routing failure returns nil and the view simply omits the
    /// line — a made-up travel time is worse than none, because "leave by"
    /// would then be a confident number nobody computed.
    private func travelTime(from a: CLLocationCoordinate2D, to b: CLLocationCoordinate2D,
                            km: Double, iqamah: Date) async -> Travel? {
        let request = MKDirections.Request()
        request.source = MKMapItem(placemark: MKPlacemark(coordinate: a))
        request.destination = MKMapItem(placemark: MKPlacemark(coordinate: b))
        let walk = km < WALK_UNDER_KM
        request.transportType = walk ? .walking : .automobile
        guard let eta = try? await MKDirections(request: request).calculateETA() else { return nil }
        let minutes = max(1, Int((eta.expectedTravelTime / 60).rounded()))
        let leave = iqamah.addingTimeInterval(-Double(minutes + PARKING_ALLOWANCE_MINUTES) * 60)
        return Travel(mode: walk ? .walk : .drive, minutes: minutes, leaveBy: leave)
    }
}

/// A static map with you and the masjid on it.
///
/// Widgets cannot host a live map view, but MapKit will render one to an
/// image, and that is all a glance needs: where it is relative to where you
/// are. Rendered once per timeline for each appearance, so the widget does
/// not flip to a white map when the phone goes dark at night.
enum MapSnapshot {
    private static var cache: [String: UIImage] = [:]

    static func render(from here: CLLocationCoordinate2D, to there: CLLocationCoordinate2D,
                       dark: Bool) async -> UIImage? {
        let key = String(format: "%.3f,%.3f|%.4f,%.4f|%d",
                         here.latitude, here.longitude, there.latitude, there.longitude, dark ? 1 : 0)
        if let hit = cache[key] { return hit }

        let options = MKMapSnapshotter.Options()
        options.region = region(covering: here, there)
        options.size = CGSize(width: 150, height: 150)
        options.mapType = .mutedStandard
        options.pointOfInterestFilter = .excludingAll
        options.showsBuildings = false
        options.traitCollection = UITraitCollection(userInterfaceStyle: dark ? .dark : .light)

        guard let snapshot = try? await MKMapSnapshotter(options: options).start() else { return nil }

        let image = UIGraphicsImageRenderer(size: options.size).image { ctx in
            snapshot.image.draw(at: .zero)
            let g = ctx.cgContext

            // You: a small blue dot, the shape every map app has taught.
            let you = snapshot.point(for: here)
            g.setFillColor(UIColor.white.cgColor)
            g.fillEllipse(in: CGRect(x: you.x - 7, y: you.y - 7, width: 14, height: 14))
            g.setFillColor(UIColor.systemBlue.cgColor)
            g.fillEllipse(in: CGRect(x: you.x - 5, y: you.y - 5, width: 10, height: 10))

            // The masjid: the app's brand green, ringed so it reads on any tile.
            let pin = snapshot.point(for: there)
            g.setFillColor(UIColor.white.cgColor)
            g.fillEllipse(in: CGRect(x: pin.x - 11, y: pin.y - 11, width: 22, height: 22))
            g.setFillColor(UIColor(red: 0.247, green: 0.639, blue: 0.514, alpha: 1).cgColor)
            g.fillEllipse(in: CGRect(x: pin.x - 8, y: pin.y - 8, width: 16, height: 16))
        }
        cache[key] = image
        return image
    }

    /// Both points in frame with room around them; never tighter than a few
    /// hundred metres, or two points across the street fill the map with one
    /// building's roof.
    private static func region(covering a: CLLocationCoordinate2D,
                               _ b: CLLocationCoordinate2D) -> MKCoordinateRegion {
        let center = CLLocationCoordinate2D(latitude: (a.latitude + b.latitude) / 2,
                                            longitude: (a.longitude + b.longitude) / 2)
        let latSpan = max(abs(a.latitude - b.latitude) * 1.9, 0.006)
        let lngSpan = max(abs(a.longitude - b.longitude) * 1.9, 0.006)
        let span = max(latSpan, lngSpan)
        return MKCoordinateRegion(center: center,
                                  span: MKCoordinateSpan(latitudeDelta: span, longitudeDelta: span))
    }
}

/// The device's own clock format, so the widget agrees with the phone.
private func clock(_ date: Date) -> String {
    date.formatted(date: .omitted, time: .shortened)
}

/// "in 12 min", "in 2 h 5 min", "now", "8 min ago" — the app's own phrasing,
/// ported from src/lib/nextUp.ts so the two never read differently.
private func relative(_ target: Date, from now: Date) -> String {
    let m = Int((target.timeIntervalSince(now) / 60).rounded())
    if m == 0 { return "now" }
    let abs = Swift.abs(m)
    let h = abs / 60, rest = abs % 60
    let span = abs < 60 ? "\(abs) min" : rest == 0 ? "\(h) h" : "\(h) h \(rest) min"
    return m > 0 ? "in \(span)" : "\(span) ago"
}

private func distance(_ km: Double) -> String {
    km < 1 ? "\(Int(km * 1000)) m" : String(format: "%.1f km", km)
}

struct PrayerWidgetView: View {
    @Environment(\.widgetFamily) private var family
    @Environment(\.colorScheme) private var scheme
    let entry: PrayerEntry

    var body: some View {
        if let problem = entry.problem {
            VStack(alignment: .leading, spacing: 4) {
                Text("Masjid Times").font(.caption2).foregroundStyle(.secondary)
                Text(problem).font(.footnote).fontWeight(.medium)
                    .minimumScaleFactor(0.8).lineLimit(3)
            }
        } else if let up = entry.upcoming {
            switch family {
            case .systemSmall:
                details(up, compact: true)
            case .systemLarge:
                VStack(alignment: .leading, spacing: 10) {
                    map(height: 150)
                    details(up, compact: false)
                    if !entry.alsoNearby.isEmpty {
                        Divider()
                        nearby
                    }
                    Spacer(minLength: 0)
                }
            default:
                HStack(alignment: .top, spacing: 12) {
                    map(height: 130).frame(width: 130)
                    details(up, compact: false)
                }
            }
        }
    }

    @ViewBuilder
    private func map(height: CGFloat) -> some View {
        let image = scheme == .dark ? entry.mapDark : entry.mapLight
        if let image {
            Image(uiImage: image)
                .resizable()
                .aspectRatio(contentMode: .fill)
                .frame(height: height)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        } else {
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(.quaternary)
                .frame(height: height)
                .overlay(Image(systemName: "map").foregroundStyle(.tertiary))
        }
    }

    private func details(_ up: PrayerMath.Upcoming, compact: Bool) -> some View {
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

            Text(clock(up.iqamah))
                .font(.system(size: compact ? 34 : 32, weight: .semibold, design: .rounded))
                .minimumScaleFactor(0.7).lineLimit(1)

            Text(relative(up.iqamah, from: entry.date))
                .font(.caption2).foregroundStyle(.secondary).lineLimit(1)

            Text(up.masjid.name)
                .font(.caption2).fontWeight(.medium)
                .lineLimit(2).minimumScaleFactor(0.8)
                .padding(.top, 2)

            if let km = entry.distanceKm {
                Text("\(distance(km)) · adhan \(clock(up.adhan))")
                    .font(.system(size: 9)).foregroundStyle(.tertiary).lineLimit(1)
            }

            if let travel = entry.travel {
                travelLine(travel, iqamah: up.iqamah)
            }
        }
    }

    /// "8 min drive · leave by 1:34", or "leave now" once that has passed.
    /// Green while there is still time, the caution colour once there is not
    /// — but never colour alone, the words change too.
    private func travelLine(_ travel: Travel, iqamah: Date) -> some View {
        let late = entry.date >= travel.leaveBy
        let mode = travel.mode == .walk ? "walk" : "drive"
        let advice = late
            ? (entry.date < iqamah ? "leave now" : "under way")
            : "leave by \(clock(travel.leaveBy))"
        return HStack(spacing: 4) {
            Image(systemName: travel.mode == .walk ? "figure.walk" : "car.fill")
                .font(.system(size: 9))
            Text("\(travel.minutes) min \(mode) · \(advice)")
                .font(.system(size: 10, weight: .medium)).lineLimit(1)
        }
        .foregroundStyle(late ? Color.orange : Color(red: 0.247, green: 0.639, blue: 0.514))
        .padding(.top, 3)
    }

    private var nearby: some View {
        VStack(alignment: .leading, spacing: 3) {
            ForEach(entry.alsoNearby, id: \.masjid.id) { other in
                HStack(spacing: 6) {
                    Text(other.masjid.name).font(.system(size: 11))
                        .lineLimit(1).truncationMode(.tail)
                    Spacer(minLength: 4)
                    Text(distance(other.km)).font(.system(size: 10)).foregroundStyle(.tertiary)
                    Text(clock(other.iqamah))
                        .font(.system(size: 11, weight: .medium)).monospacedDigit()
                }
                .foregroundStyle(.secondary)
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
        .description("The next congregation at the masjid nearest you, with a map and when to leave.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}
