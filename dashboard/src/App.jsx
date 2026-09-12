import { useEffect, useMemo, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import "./index.css";

import {
  getReports, setStatus, subscribe, configuredBackend,
  CATEGORY_LABELS, SEV, STATUS, clock, ago, wardOf, DISTRICT_NAMES,
} from "./api";
import Mark from "./components/Mark";
import Detail from "./components/Detail";
import MapView from "./components/MapView";
import Coverage from "./components/Coverage";

const SEV_FILTERS = [["All", "all"], ["Safety risk", "high"], ["Soon", "medium"], ["Can wait", "low"]];
const STATUS_FILTERS = [["All", "all"], ["Open", "open"], ["New", "new"], ["Resolved", "resolved"]];
const BLANK = { q: "", sev: "all", status: "all", cat: "all", dist: "all" };

// Newest first, always. The query already orders, but the board's reading order
// should not depend on where the rows came from.
const byNewest = (rs) => [...rs].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

export default function App() {
  const [reports, setReports] = useState([]);
  const [loadErr, setLoadErr] = useState(null);
  const [live, setLive] = useState(false);
  const [view, setView] = useState("list");
  const [sel, setSel] = useState(null);
  const [f, setF] = useState(BLANK);
  const [unread, setUnread] = useState(0);
  const [since] = useState(() => new Date());
  const fresh = useRef(new Set());

  useEffect(() => {
    getReports().then(byNewest).then(setReports).catch((e) => setLoadErr(e.message));
  }, []);

  // The live queue. Postgres pushes the change, so a report filed from a phone
  // anywhere lands here whether or not the Express server is running.
  useEffect(() => {
    return subscribe({
      onInsert: (r) => {
        fresh.current.add(r.id);
        setReports((prev) => (prev.some((p) => p.id === r.id) ? prev : [r, ...prev]));
        setUnread((n) => n + 1);
      },
      onUpdate: (r) => {
        setReports((prev) => prev.map((p) => (p.id === r.id ? r : p)));
        setSel((s) => (s?.id === r.id ? r : s));
      },
      onStatus: setLive,
    });
  }, []);

  const open = (r) => {
    if (fresh.current.delete(r.id)) setUnread((n) => Math.max(0, n - 1));
    setSel(r);
  };

  const onStatusChange = async (id, status) => {
    // Optimistic, then corrected by whatever the database actually stored.
    setReports((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
    setSel((s) => (s?.id === id ? { ...s, status } : s));
    try {
      const saved = await setStatus(id, status);
      setReports((prev) => prev.map((p) => (p.id === id ? saved : p)));
      setSel((s) => (s?.id === id ? saved : s));
    } catch (e) {
      setLoadErr(`Could not save status: ${e.message}`);
    }
  };

  const categories = useMemo(
    () => [...new Set(reports.map((r) => r.category))].sort(),
    [reports]
  );
  const wards = useMemo(
    () => [...new Set(reports.map((r) => r.district).filter(Boolean))]
      .sort((a, b) => +wardOf(a) - +wardOf(b)),
    [reports]
  );

  const shown = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    return reports.filter((r) =>
      (f.sev === "all" || r.severity === f.sev) &&
      (f.status === "all" || (f.status === "open" ? r.status !== "resolved" : r.status === f.status)) &&
      (f.cat === "all" || r.category === f.cat) &&
      (f.dist === "all" || r.district === f.dist) &&
      (!q || `${r.location_text ?? ""} ${r.id} ${r.category} ${r.description ?? ""}`.toLowerCase().includes(q))
    );
  }, [reports, f]);

  const dirty = JSON.stringify(f) !== JSON.stringify(BLANK);

  // An empty filter is sometimes the finding, so say the nearest true thing
  // rather than a shrug.
  const nearest = () => {
    if (!reports.length) return "there are no reports on the board at all yet";
    if (f.dist !== "all") {
      const n = reports.filter((r) => r.district === f.dist).length;
      return n
        ? `${f.dist} has ${n} report${n === 1 ? "" : "s"}, but none matching the rest of these filters`
        : `${f.dist} has no reports at all, which is the kind of silence the coverage panel is about`;
    }
    if (f.sev !== "all") return `no reports are logged at "${SEV[f.sev].label}" right now`;
    return "nothing on the board matches this combination";
  };

  return (
    <div className="shell">
      <div className="topbar">
        <div className="brand">
          <Mark />
          <b>Repoth</b>
          <span>Halifax Public Works</span>
        </div>
        <div className="tabs">
          {[["Incidents", "list"], ["Coverage map", "map"], ["Coverage gap", "gap"]].map(([label, v]) => (
            <button key={v} className={view === v ? "on" : ""} onClick={() => setView(v)}>{label}</button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--color-neutral-700)" }}>
          <span className={`pip ${live ? "" : "off"}`} />
          {live ? "Live queue · connected" : configuredBackend ? "Live queue · connecting" : "Supabase not configured"}
        </div>
        <div className="who"><i>RM</i><span>R. MacKinnon</span></div>
      </div>

      <div className="body">
        {view === "list" && (
          <>
            <div className="filters">
              <div>
                <label className="lbl">Search</label>
                <input
                  className="input" style={{ width: 220 }} value={f.q}
                  placeholder="Street, reference, words…"
                  onChange={(e) => setF({ ...f, q: e.target.value })}
                />
              </div>
              <div>
                <label className="lbl">Severity</label>
                <div className="seg-row">
                  {SEV_FILTERS.map(([label, v]) => (
                    <button key={v} className={f.sev === v ? "on" : ""} onClick={() => setF({ ...f, sev: v })}>
                      {v !== "all" && <span className="dot" style={{ width: 9, height: 9, background: SEV[v].c }} />}
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="lbl">Status</label>
                <div className="seg-row">
                  {STATUS_FILTERS.map(([label, v]) => (
                    <button key={v} className={f.status === v ? "on" : ""} onClick={() => setF({ ...f, status: v })}>{label}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="lbl">Category</label>
                <select className="input" style={{ width: 160, height: 34 }} value={f.cat} onChange={(e) => setF({ ...f, cat: e.target.value })}>
                  <option value="all">All categories</option>
                  {categories.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c] ?? c}</option>)}
                </select>
              </div>
              <div>
                <label className="lbl">District</label>
                <select className="input" style={{ width: 210, height: 34 }} value={f.dist} onChange={(e) => setF({ ...f, dist: e.target.value })}>
                  <option value="all">All districts</option>
                  {wards.map((d) => (
                    <option key={d} value={d}>{d}{DISTRICT_NAMES[wardOf(d)] ? ` · ${DISTRICT_NAMES[wardOf(d)]}` : ""}</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1 }} />
              <button className="btn btn-secondary" disabled={!dirty} onClick={() => setF(BLANK)}
                      style={{ fontFamily: "var(--font-heading)" }}>Clear filters</button>
            </div>

            <div className="strip">
              <span className="count">
                {dirty ? `${shown.length} of ${reports.length} reports match` : `${reports.length} reports · all time`}
              </span>
              {unread > 0 && (
                <button className="unread" onClick={() => { fresh.current.clear(); setUnread(0); }}>
                  <i />{unread} new since {clock(since.toISOString())}
                </button>
              )}
              <div style={{ flex: 1 }} />
              <span className="disclosure">
                <span className="tag tag-outline">Live data</span>
                Reports are real and arrive from Supabase. Seed rows marked HRM are real service requests from the city's feed.
              </span>
            </div>

            <div className="tablewrap">
              {loadErr && (
                <div className="empty">
                  <Mark w={34} />
                  <h3>The board could not load</h3>
                  <p style={{ color: "var(--sev-high)" }}>{loadErr}</p>
                </div>
              )}
              {!loadErr && (
                <table className="table" style={{ width: "100%" }}>
                  <thead>
                    <tr>
                      <th style={{ paddingLeft: 24, width: 118 }}>Received</th>
                      <th>Location</th>
                      <th style={{ width: 120 }}>Category</th>
                      <th style={{ width: 150 }}>Severity</th>
                      <th style={{ width: 132 }}>Status</th>
                      <th style={{ width: 64 }}>Photo</th>
                      <th style={{ width: 70, paddingRight: 24 }}>Ward</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((r) => {
                      const sv = SEV[r.severity] ?? SEV.medium;
                      const st = STATUS[r.status] ?? STATUS.new;
                      return (
                        <tr key={r.id} onClick={() => open(r)}
                            className={`${sel?.id === r.id ? "sel" : ""} ${fresh.current.has(r.id) ? "fresh" : ""}`}>
                          <td>
                            <div style={{ fontVariantNumeric: "tabular-nums", fontSize: 13 }}>{clock(r.created_at)}</div>
                            <div style={{ fontSize: 11, color: "var(--color-neutral-600)" }}>{ago(r.created_at)}</div>
                          </td>
                          <td>
                            <div style={{ fontSize: 14 }}>{r.location_text ?? "Location not given"}</div>
                            <div style={{ fontSize: 11, color: "var(--color-neutral-600)", fontVariantNumeric: "tabular-nums" }}>{r.id}</div>
                          </td>
                          <td style={{ fontSize: 13 }}>{CATEGORY_LABELS[r.category] ?? r.category}</td>
                          <td>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                              <span className="dot" style={{ width: 10, height: 10, background: sv.c }} />{sv.label}
                            </span>
                          </td>
                          <td><span className="pill" style={{ color: st.c }}>{st.label}</span></td>
                          <td style={{ fontSize: 13, color: r.photo ? "var(--color-text)" : "var(--color-neutral-500)" }}>
                            {r.photo ? "●" : "—"}
                          </td>
                          <td style={{ fontSize: 12.5, fontVariantNumeric: "tabular-nums", color: "var(--color-neutral-700)" }}>
                            {wardOf(r.district) || "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              {!loadErr && shown.length === 0 && (
                <div className="empty">
                  <Mark w={34} />
                  <h3>No reports match these filters</h3>
                  <p>
                    The nearest thing: {nearest()}. Dropping the district filter usually explains a gap like
                    this, and if it does not, that silence is worth a look on the coverage panel.
                  </p>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button className="btn btn-primary" style={{ fontFamily: "var(--font-heading)" }} onClick={() => setF(BLANK)}>Clear filters</button>
                    <button className="btn btn-secondary" style={{ fontFamily: "var(--font-heading)" }} onClick={() => setView("gap")}>Open coverage gap</button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {view === "map" && <MapView reports={reports} selected={sel} onSelect={open} />}
        {view === "gap" && <Coverage />}

        {sel && <Detail report={sel} onClose={() => setSel(null)} onStatus={onStatusChange} />}
      </div>
    </div>
  );
}
