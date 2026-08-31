import Foundation
import Adhan

/// Prayer arithmetic for the widget.
///
/// This is a port of `src/lib/prayer.ts`, deliberately using Adhan-Swift so it
/// cannot drift from the app: both are the same algorithm from the same
/// authors, so a time shown on the home screen and the same time shown in the
/// app agree by construction rather than by two implementations happening to
/// round the same way. Wrong times here make someone miss a prayer
/// (CLAUDE.md §14), so nothing below guesses when a value is missing.
enum PrayerMath {

    static func method(_ name: String) -> CalculationMethod {
        switch name {
        case "NorthAmerica": return .northAmerica
        case "MuslimWorldLeague": return .muslimWorldLeague
        case "Egyptian": return .egyptian
        case "Karachi": return .karachi
        case "UmmAlQura": return .ummAlQura
        case "Dubai": return .dubai
        case "MoonsightingCommittee": return .moonsightingCommittee
        case "Kuwait": return .kuwait
        case "Qatar": return .qatar
        case "Singapore": return .singapore
        default: return .northAmerica
        }
    }

    /// Adhan times for a masjid on a given day, or nil if Adhan cannot solve
    /// them — which happens at extreme latitudes and must not be papered over.
    static func adhanTimes(for masjid: Masjid, on day: Date,
                           calendar: Calendar) -> PrayerTimes? {
        var params = method(masjid.calc.method).params
        params.madhab = masjid.calc.madhab == "shafi" ? .shafi : .hanafi
        let components = calendar.dateComponents([.year, .month, .day], from: day)
        return PrayerTimes(
            coordinates: Coordinates(latitude: masjid.lat, longitude: masjid.lng),
            date: components,
            calculationParameters: params)
    }

    private static func adhan(_ times: PrayerTimes, _ prayer: Prayer) -> Date {
        switch prayer {
        case .fajr: return times.fajr
        case .dhuhr: return times.dhuhr
        case .asr: return times.asr
        case .maghrib: return times.maghrib
        case .isha: return times.isha
        }
    }

    /// Resolve one iqamah rule to a wall-clock instant on `day`.
    ///
    /// An offset rule is relative to that prayer's own adhan, which is why
    /// Maghrib tracks sunset through the year instead of going stale — the
    /// same reason the data model prefers offsets for it.
    static func iqamah(for prayer: Prayer, masjid: Masjid, times: PrayerTimes,
                       day: Date, calendar: Calendar) -> Date? {
        guard let rule = masjid.iqamah[prayer] else { return nil }
        switch rule {
        case .offset(let minutes):
            return calendar.date(byAdding: .minute, value: minutes,
                                 to: adhan(times, prayer))
        case .fixed(let hour, let minute):
            return calendar.date(bySettingHour: hour, minute: minute, second: 0,
                                 of: day, matchingPolicy: .nextTime)
        }
    }

    struct Upcoming {
        let masjid: Masjid
        let prayer: Prayer
        let iqamah: Date
        let adhan: Date
        let isTomorrow: Bool
    }

    /// The next iqamah at this masjid after `now`.
    ///
    /// After the last Isha of the day there is still an answer — tomorrow's
    /// Fajr — and a widget that goes blank late at night is exactly when
    /// someone is checking whether they can still make it. So the day rolls
    /// over rather than returning nil.
    static func next(after now: Date, at masjid: Masjid,
                     calendar: Calendar) -> Upcoming? {
        for dayOffset in 0...1 {
            guard let day = calendar.date(byAdding: .day, value: dayOffset, to: now),
                  let times = adhanTimes(for: masjid, on: day, calendar: calendar)
            else { continue }

            let candidates = Prayer.allCases.compactMap { prayer -> Upcoming? in
                guard let at = iqamah(for: prayer, masjid: masjid, times: times,
                                      day: day, calendar: calendar),
                      at > now
                else { return nil }
                return Upcoming(masjid: masjid, prayer: prayer, iqamah: at,
                                adhan: adhan(times, prayer),
                                isTomorrow: dayOffset == 1)
            }
            if let soonest = candidates.min(by: { $0.iqamah < $1.iqamah }) {
                return soonest
            }
        }
        return nil
    }

    /// Great-circle distance in km — the same haversine as `src/lib/distance.ts`.
    static func distanceKm(_ aLat: Double, _ aLng: Double,
                           _ bLat: Double, _ bLng: Double) -> Double {
        let r = 6371.0
        let dLat = (bLat - aLat) * .pi / 180
        let dLng = (bLng - aLng) * .pi / 180
        let lat1 = aLat * .pi / 180
        let lat2 = bLat * .pi / 180
        let h = sin(dLat / 2) * sin(dLat / 2)
            + sin(dLng / 2) * sin(dLng / 2) * cos(lat1) * cos(lat2)
        return 2 * r * asin(min(1, sqrt(h)))
    }

    /// Masjids nearest a point, closest first.
    static func nearest(to lat: Double, _ lng: Double,
                        in masjids: [Masjid], limit: Int) -> [(Masjid, Double)] {
        masjids
            .map { ($0, distanceKm(lat, lng, $0.lat, $0.lng)) }
            .sorted { $0.1 < $1.1 }
            .prefix(limit)
            .map { ($0.0, $0.1) }
    }

    /// Whether stored times are old enough to say so, matching the app's
    /// STALE_AFTER_DAYS of 45 in `src/lib/trust.ts`.
    static func isStale(_ lastVerified: String?, now: Date) -> Bool {
        guard let lastVerified, lastVerified.count >= 10 else { return true }
        var parts = DateComponents()
        parts.year = Int(lastVerified.prefix(4))
        parts.month = Int(lastVerified.dropFirst(5).prefix(2))
        parts.day = Int(lastVerified.dropFirst(8).prefix(2))
        var utc = Calendar(identifier: .gregorian)
        utc.timeZone = TimeZone(identifier: "UTC")!
        guard let then = utc.date(from: parts) else { return true }
        return now.timeIntervalSince(then) > 45 * 24 * 60 * 60
    }
}
