import { useEffect, useState, useRef } from "react";
import "leaflet/dist/leaflet.css";
import { API, getReports, getDistricts, CATEGORY_LABELS, SEV_COLOR, ago } from "./api";
import Detail from "./components/Detail";
import MapView from "./components/MapView";
import Coverage from "./components/Coverage";

export default function App() {
  const [reports, setReports] = useState([]);
  const [districts, setDistricts] = useState(null);
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState("incidents");
  const [live, setLive] = useState(false);
  const [filter, setFilter] = useState("all");
  const arrived = useRef(new Set());

  useEffect(() => {
    getReports().then(setReports).catch(console.error);
    getDistricts().then(setDistricts).catch(console.error);
  }, []);

  // The whole live-update feature. A row appears while you are still talking.
  useEffect(() => {
    const es = new EventSource(`${API}/api/stream`);
    es.addEventListener("hello", () => setLive(true));
    es.addEventListener("report:new", (e) => {
      const r = JSON.parse(e.data);
      arrived.current.add(r.id);
      setReports((prev) => [r, ...prev.filter((p) => p.id !== r.id)]);
    });
    es.addEventListener("report:updated", (e) => {
      const r = JSON.parse(e.data);
      setReports((prev) => prev.map((p) => (p.id === r.id ? r : p)));
      setSelected((s) => (s?.id === r.id ? r : s));
    });
    es.onerror = () => setLive(false);
    es.onopen = () => setLive(true);
    return () => es.close();
  }, []);

  const onStatus = (r) => {
    setReports((prev) => prev.map((p) => (p.id === r.id ? r : p)));
    setSelected(r);
  };

  const shown = reports.filter((r) => filter === "all" || r.status === filter);
  const newCount = reports.filter((r) => r.status === "new").length;

  return (
    <div className="app">
      <header>
        <div className="brand">Repoth <span>Public Works board · Halifax Regional Municipality</span></div>
        <div className="live">
          <span className={`dot ${live ? "" : "off"}`} />
          {live ? "Live" : "Disconnected"} · {newCount} new
        </div>
      </header>

      <nav>
        {["incidents", "map", "coverage"].map((t) => (
          <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
            {t === "incidents" ? `Incidents (${reports.length})` : t === "map" ? "Map" : "Coverage gap"}
          </button>
        ))}
      </nav>

      <main>
        {tab === "incidents" && (
          <>
            <div className="list">
              <div style={{ padding: "10px 18px", borderBottom: "1px solid var(--line)", display: "flex", gap: 6 }}>
                {["all", "new", "acknowledged", "assigned", "resolved"].map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    style={{
                      background: filter === f ? "var(--accent)" : "transparent",
                      color: filter === f ? "#fff" : "var(--dim)",
                      border: "1px solid var(--line)", borderRadius: 999,
                      padding: "4px 10px", fontSize: 12,
                    }}
                  >{f}</button>
                ))}
              </div>
              {shown.length === 0 && <div className="empty">No reports match this filter.</div>}
              {shown.map((r) => (
                <div
                  key={r.id}
                  className={`row ${selected?.id === r.id ? "on" : ""} ${arrived.current.has(r.id) ? "new" : ""}`}
                  onClick={() => setSelected(r)}
                >
                  <span className="sev" style={{ background: SEV_COLOR[r.severity] ?? "#888" }} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <h4>{CATEGORY_LABELS[r.category] ?? r.category}</h4>
                    <p>{r.location_text ?? "Location not given"}</p>
                    <div className="meta">
                      <span>{ago(r.created_at)}</span>
                      <span>·</span>
                      <span>{r.district ?? "not mapped"}</span>
                      <span>·</span>
                      <span>{r.status}</span>
                      {r.safety_risk && <span className="tag risk">risk</span>}
                      {r.source === "hrm_import" && <span className="tag seed">HRM data</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <Detail report={selected} onStatus={onStatus} />
          </>
        )}
        {tab === "map" && <MapView reports={reports} onSelect={(r) => { setSelected(r); setTab("incidents"); }} />}
        {tab === "coverage" && <Coverage data={districts} />}
      </main>
    </div>
  );
}
