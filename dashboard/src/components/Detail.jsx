import { useState } from "react";
import { MapContainer, TileLayer, CircleMarker } from "react-leaflet";
import { CATEGORY_LABELS, SEV, STATUS, clock, ago, wardOf, DISTRICT_NAMES } from "../api";

const K = ({ children }) => (
  <div style={{
    font: "600 9.5px/1 var(--font-body)", letterSpacing: ".14em",
    textTransform: "uppercase", color: "var(--color-neutral-600)", marginBottom: 8,
  }}>{children}</div>
);

// Only the next legitimate step carries the accent. Completed steps drop back
// and read out what already happened.
const STEPS = [
  { to: "acknowledged", todo: "Acknowledge", done: "Acknowledged" },
  { to: "assigned", todo: "Assign a crew", done: "Crew assigned" },
  { to: "resolved", todo: "Mark resolved", done: "Resolved" },
];
const RANK = { new: 0, acknowledged: 1, assigned: 2, resolved: 3 };

export default function Detail({ report: r, onClose, onStatus }) {
  const [showTranscript, setShowTranscript] = useState(false);
  const sv = SEV[r.severity] ?? SEV.medium;
  const st = STATUS[r.status] ?? STATUS.new;
  const placed = r.lat != null && r.lng != null;
  const spoken = r.transcript?.find((t) => t.role === "user")?.text;
  const ward = wardOf(r.district);

  return (
    <div className="panel">
      <header>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 7 }}>
            <span className="dot" style={{ width: 11, height: 11, background: sv.c }} />
            <span style={{ font: "600 10px/1 var(--font-body)", letterSpacing: ".14em", textTransform: "uppercase", color: "var(--color-neutral-700)" }}>
              {sv.label}
            </span>
            <span className="pill" style={{ color: st.c }}>{st.label}</span>
          </div>
          <h2>{r.location_text ?? "Location not given"}</h2>
          <div className="ref">{r.id} · {CATEGORY_LABELS[r.category] ?? r.category} · {clock(r.created_at)}, {ago(r.created_at)}</div>
        </div>
        <button className="closebtn" onClick={onClose} aria-label="Close">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </header>

      <div className="scroll">
        {r.photo ? (
          <div style={{ margin: "18px 0 0" }}>
            <div className="plate" style={{ width: "100%", height: 238, overflow: "hidden" }}>
              <img src={r.photo} alt="Sent with the report" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            </div>
            <div style={{ marginTop: 7, fontSize: 11, color: "var(--color-neutral-600)" }}>
              Sent with the report by the resident.
            </div>
          </div>
        ) : (
          <div className="nophoto">
            No photo. The resident was asked and skipped, which is expected in about half of voice reports.
          </div>
        )}

        <section>
          <K>Location, as spoken</K>
          {spoken
            ? <p style={{ margin: "0 0 12px", fontSize: 15, lineHeight: 1.55, fontStyle: "italic" }}>“{spoken}”</p>
            : <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--color-neutral-600)" }}>
                No transcript. This row came from the city's own service request feed, not a voice report.
              </p>}

          {/* Never a drawn shape: real tiles, or an honest note that we could
              not place it. A fake pin is worse than no pin. */}
          {placed ? (
            <>
              <div style={{ height: 186, border: "1px solid var(--color-divider)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
                <MapContainer center={[r.lat, r.lng]} zoom={16} style={{ height: "100%", width: "100%" }}
                              dragging={false} zoomControl={false} scrollWheelZoom={false} doubleClickZoom={false} attributionControl={false}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <CircleMarker center={[r.lat, r.lng]} radius={9} pathOptions={{ color: "rgba(32,31,29,.75)", weight: 2.5, fillColor: sv.c, fillOpacity: 0.88 }} />
                </MapContainer>
              </div>
              <div style={{ marginTop: 7, fontSize: 11, color: "var(--color-neutral-600)", fontVariantNumeric: "tabular-nums" }}>
                {r.lat.toFixed(4)}, {r.lng.toFixed(4)} · matched to {r.district}
                {DISTRICT_NAMES[ward] ? `, ${DISTRICT_NAMES[ward]}` : ""} · © OpenStreetMap contributors
              </div>
            </>
          ) : (
            <div className="nophoto" style={{ margin: 0 }}>
              Location not mapped. The street the resident gave is not in the city's own request record, so
              no coordinates were guessed for it.
            </div>
          )}
        </section>

        <section>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 18px" }}>
            <div>
              <K>Category</K>
              <div style={{ fontSize: 14 }}>{CATEGORY_LABELS[r.category] ?? r.category}</div>
            </div>
            <div>
              <K>Severity</K>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                <span className="dot" style={{ width: 10, height: 10, background: sv.c }} />{sv.label}
              </div>
            </div>
            <div>
              <K>Safety risk flagged</K>
              <div style={{ fontSize: 14, color: r.safety_risk ? "var(--sev-high)" : "var(--color-neutral-700)" }}>
                {r.safety_risk ? "Yes, the resident described a risk of harm" : "No"}
              </div>
            </div>
            <div>
              <K>Reported in</K>
              <div style={{ fontSize: 14 }}>{(r.language ?? "en").toUpperCase()}</div>
            </div>
          </div>
        </section>

        <section>
          <K>What's wrong</K>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6 }}>{r.description}</p>
        </section>

        {r.transcript?.length > 0 && (
          <section>
            <button className="reveal" onClick={() => setShowTranscript((v) => !v)}>
              {showTranscript ? "Hide the original transcript" : "Read the original transcript"}
            </button>
            {showTranscript && (
              <div className="verbatim">
                {r.transcript.map((l, i) => (
                  <p key={i}>
                    <span className="who">{l.role === "user" ? "Resident" : "Repoth"} </span>{l.text}
                  </p>
                ))}
                <p style={{ fontSize: 11, color: "var(--color-neutral-600)" }}>
                  Verbatim. Use it when the summary above reads wrong.
                </p>
              </div>
            )}
          </section>
        )}

        <section>
          <K>Trail</K>
          {(r.trail?.length ? r.trail : [{ at: r.created_at, what: "Reported" }]).map((t, i) => (
            <div key={i} style={{ display: "flex", gap: 11, fontSize: 12.5, lineHeight: 1.5, padding: "5px 0" }}>
              <span style={{ fontVariantNumeric: "tabular-nums", color: "var(--color-neutral-600)", flex: "none", width: 64 }}>
                {clock(t.at)}
              </span>
              <span>{t.what}</span>
            </div>
          ))}
        </section>
      </div>

      <footer>
        {STEPS.map((s) => {
          const done = RANK[r.status] >= RANK[s.to];
          const next = RANK[r.status] === RANK[s.to] - 1;
          return (
            <button
              key={s.to}
              onClick={() => !done && onStatus(r.id, s.to)}
              disabled={done}
              style={{
                border: `1px solid ${next ? "var(--color-accent)" : "var(--color-divider)"}`,
                background: next ? "var(--color-accent-100)" : "transparent",
                color: next ? "var(--color-accent-800)" : "var(--color-neutral-600)",
                cursor: done ? "default" : "pointer",
              }}
            >
              {done ? s.done : s.todo}
            </button>
          );
        })}
      </footer>
    </div>
  );
}
