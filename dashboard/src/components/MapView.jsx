import { MapContainer, TileLayer, CircleMarker, Tooltip } from "react-leaflet";
import { SEV, CATEGORY_LABELS } from "../api";

// CircleMarker, not Marker, on purpose: the default Leaflet marker icon breaks
// under bundlers, and a circle lets severity be encoded as colour AND radius,
// so the map still reads for anyone who cannot separate the hues.
const RADIUS = { low: 7, medium: 12, high: 15 };

export default function MapView({ reports, selected, onSelect }) {
  const placed = reports.filter((r) => r.lat != null && r.lng != null);
  const unplaced = reports.length - placed.length;

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", animation: "rp-fade .3s ease both" }}>
      <div className="maphead">
        <h2>Where the reports are</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 12 }}>
          {["low", "medium", "high"].map((k) => (
            <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
              <span className="dot" style={{ width: RADIUS[k] - 3, height: RADIUS[k] - 3, background: SEV[k].c }} />
              {SEV[k].label}
            </span>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <span className="disclosure">
          <span className="tag tag-outline">Real coordinates</span>
          Pins come from the city's own request record, never guessed.
          {unplaced > 0 && ` ${unplaced} report${unplaced === 1 ? "" : "s"} could not be placed and ${unplaced === 1 ? "is" : "are"} not shown.`}
          {" "}Basemap © OpenStreetMap contributors.
        </span>
      </div>

      <div style={{ flex: 1, minHeight: 420 }}>
        <MapContainer center={[44.6605, -63.5859]} zoom={12} style={{ height: "100%", width: "100%" }}>
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          {placed.map((r) => {
            const sv = SEV[r.severity] ?? SEV.medium;
            const on = selected?.id === r.id;
            return (
              <CircleMarker
                key={r.id}
                center={[r.lat, r.lng]}
                radius={on ? 11 : (RADIUS[r.severity] ?? 12) / 2 + 2}
                pathOptions={{
                  color: on ? "var(--color-text)" : "rgba(32,31,29,.75)",
                  weight: on ? 2.5 : 1,
                  fillColor: sv.c,
                  fillOpacity: 0.88,
                }}
                eventHandlers={{ click: () => onSelect(r) }}
              >
                <Tooltip>
                  {CATEGORY_LABELS[r.category] ?? r.category} · {r.location_text ?? "location not given"}
                </Tooltip>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>
    </div>
  );
}
