import CoreLocation

/// One location fix for a widget timeline.
///
/// Widgets do not get continuous location. They inherit the container app's
/// authorization and may ask for a fix while a timeline is being built, which
/// is what `isAuthorizedForWidgetUpdates` reports — the app having permission
/// is not on its own enough. When there is no fix the widget must say so
/// rather than quietly showing another city's masjid, so this returns nil and
/// the view falls back visibly.
final class WidgetLocation: NSObject, CLLocationManagerDelegate {
    private let manager = CLLocationManager()
    private var waiting: CheckedContinuation<CLLocation?, Never>?

    override init() {
        super.init()
        manager.delegate = self
        // A widget shows the nearest masjid, not a turn-by-turn route. Coarse
        // accuracy resolves faster, costs less battery, and cannot change
        // which masjid is nearest at city scale.
        manager.desiredAccuracy = kCLLocationAccuracyKilometer
    }

    /// The last fix iOS handed us, kept so a timeline built while the fix is
    /// still in flight renders the right masjid instead of a fallback.
    private static var lastKnown: CLLocation?

    func current() async -> CLLocation? {
        guard manager.isAuthorizedForWidgetUpdates else { return nil }
        if let cached = manager.location {
            Self.lastKnown = cached
            return cached
        }
        let fix = await withCheckedContinuation { (c: CheckedContinuation<CLLocation?, Never>) in
            waiting = c
            manager.requestLocation()
        }
        if let fix { Self.lastKnown = fix }
        return fix ?? Self.lastKnown
    }

    func locationManager(_ m: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        waiting?.resume(returning: locations.last)
        waiting = nil
    }

    func locationManager(_ m: CLLocationManager, didFailWithError error: Error) {
        waiting?.resume(returning: nil)
        waiting = nil
    }
}
