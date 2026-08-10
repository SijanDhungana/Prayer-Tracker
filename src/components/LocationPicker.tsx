import { PRESETS, type ReferencePoint } from "../lib/location";

export default function LocationPicker({
  reference,
}: {
  reference: ReferencePoint;
}) {
  const { status, error, presetId, selectPreset, useDeviceLocation } = reference;
  const usingDevice = status === "active";

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm text-stone-600" htmlFor="reference-point">
          Distances from
        </label>

        <select
          id="reference-point"
          value={usingDevice ? "device" : presetId}
          onChange={(e) => selectPreset(e.target.value)}
          className="min-w-0 flex-1 rounded-lg bg-stone-50 px-2 py-1.5 text-sm font-medium text-stone-900 ring-1 ring-stone-200"
        >
          {usingDevice && <option value="device">My location</option>}
          {PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.label}
            </option>
          ))}
        </select>

        {!usingDevice && (
          <button
            type="button"
            onClick={useDeviceLocation}
            disabled={status === "locating"}
            className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-50 disabled:opacity-60"
          >
            {status === "locating" ? "Locating…" : "Use my location"}
          </button>
        )}
      </div>

      {error && <p className="mt-2 text-xs text-amber-700">{error}</p>}
    </div>
  );
}
