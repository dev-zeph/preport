import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import { SEV_COLOR, CATEGORY_LABELS } from "../api";

export default function MapView({ reports, onSelect }) {
  const placed = reports.filter((r) => r.lat && r.lng);
  const unplaced = reports.length - placed.length;

  return (
    <div className="pane" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <h2>Map</h2>
        <p className="muted">
          {placed.length} of {reports.length} reports placed.
          {unplaced > 0 && ` ${unplaced} could not be mapped and are not shown.`}
        </p>
      </div>
      <div style={{ flex: 1, minHeight: 420 }}>
        <MapContainer center={[44.651, -63.582]} zoom={12} scrollWheelZoom>
          {/* Attribution is the OpenStreetMap licence condition. Keep it. */}
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="© OpenStreetMap contributors"
          />
          {placed.map((r) => (
            <CircleMarker
              key={r.id}
              center={[r.lat, r.lng]}
              radius={r.safety_risk ? 10 : 7}
              pathOptions={{
                color: SEV_COLOR[r.severity] ?? "#888",
                fillColor: SEV_COLOR[r.severity] ?? "#888",
                fillOpacity: 0.65, weight: 2,
              }}
              eventHandlers={{ click: () => onSelect(r) }}
            >
              <Popup>
                <b>{CATEGORY_LABELS[r.category] ?? r.category}</b><br />
                {r.location_text}<br />
                <small>{r.severity} · {r.district ?? "unmapped"}</small>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
