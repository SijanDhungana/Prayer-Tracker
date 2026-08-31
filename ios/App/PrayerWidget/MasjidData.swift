import Foundation

/// One iqamah rule, mirroring the two shapes in `src/data/masjids.json`:
/// `{"type":"fixed","time":"HH:mm"}` or `{"type":"offset","minutes":N}`.
///
/// Decoding is strict on purpose. A rule this widget cannot understand is
/// dropped rather than guessed at — a congregation time invented by a lenient
/// parser would be indistinguishable, on screen, from one the masjid set.
enum IqamahRule: Decodable {
    case fixed(hour: Int, minute: Int)
    case offset(minutes: Int)

    private enum Keys: String, CodingKey { case type, time, minutes }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: Keys.self)
        switch try c.decode(String.self, forKey: .type) {
        case "fixed":
            let raw = try c.decode(String.self, forKey: .time)
            let parts = raw.split(separator: ":")
            guard parts.count == 2,
                  let h = Int(parts[0]), let m = Int(parts[1]),
                  (0..<24).contains(h), (0..<60).contains(m)
            else {
                throw DecodingError.dataCorruptedError(
                    forKey: .time, in: c, debugDescription: "not HH:mm: \(raw)")
            }
            self = .fixed(hour: h, minute: m)
        case "offset":
            self = .offset(minutes: try c.decode(Int.self, forKey: .minutes))
        case let other:
            throw DecodingError.dataCorruptedError(
                forKey: .type, in: c, debugDescription: "unknown rule type: \(other)")
        }
    }
}

struct Iqamah: Decodable {
    let fajr: IqamahRule?
    let dhuhr: IqamahRule?
    let asr: IqamahRule?
    let maghrib: IqamahRule?
    let isha: IqamahRule?

    subscript(prayer: Prayer) -> IqamahRule? {
        switch prayer {
        case .fajr: return fajr
        case .dhuhr: return dhuhr
        case .asr: return asr
        case .maghrib: return maghrib
        case .isha: return isha
        }
    }
}

struct Calc: Decodable {
    let method: String
    let madhab: String
}

struct Masjid: Decodable {
    let id: String
    let name: String
    let address: String
    let lat: Double
    let lng: Double
    let calc: Calc
    let iqamah: Iqamah
    let lastVerified: String?
    let needsReview: Bool?
}

enum Prayer: String, CaseIterable {
    case fajr, dhuhr, asr, maghrib, isha

    var label: String {
        switch self {
        case .fajr: return "Fajr"
        case .dhuhr: return "Dhuhr"
        case .asr: return "Asr"
        case .maghrib: return "Maghrib"
        case .isha: return "Isha"
        }
    }
}

/// Loads the same directory the app fetches at runtime.
///
/// The last good response is written to the extension's own container and
/// reused when a fetch fails, so a widget on a phone with no signal shows the
/// times it had rather than an error. Nothing partial is ever cached: the
/// payload is decoded first, and only a payload that parses replaces the last
/// one. That mirrors the app's own rule in `src/lib/masjidData.ts` — good data
/// is never overwritten with a bad read.
enum MasjidDirectory {
    /// Matches VITE_DATA_URL. The `masjids.json` a deployment serves is the
    /// same file the daily scrape commits, so the widget tracks the app.
    static let url = URL(string: "https://prayer-tracker-opal.vercel.app/masjids.json")!

    private static var cacheURL: URL? {
        FileManager.default
            .urls(for: .cachesDirectory, in: .userDomainMask).first?
            .appendingPathComponent("masjids.cache.json")
    }

    static func load() async -> (masjids: [Masjid], stale: Bool) {
        var request = URLRequest(url: url)
        request.timeoutInterval = 15
        // The deployment sets must-revalidate; asking for a fresh copy here
        // keeps a cached prayer time from outliving the schedule it came from.
        request.cachePolicy = .reloadIgnoringLocalCacheData

        if let (data, response) = try? await URLSession.shared.data(for: request),
           (response as? HTTPURLResponse)?.statusCode == 200,
           let decoded = try? JSONDecoder().decode([Masjid].self, from: data),
           !decoded.isEmpty {
            if let cacheURL { try? data.write(to: cacheURL, options: .atomic) }
            return (decoded, false)
        }

        if let cacheURL,
           let data = try? Data(contentsOf: cacheURL),
           let decoded = try? JSONDecoder().decode([Masjid].self, from: data) {
            return (decoded, true)
        }
        return ([], true)
    }
}
