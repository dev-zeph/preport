import { CATEGORY_LABELS, STATUSES, SEV_COLOR, setStatus, API, ago } from "../api";

export default function Detail({ report, onStatus }) {
  if (!report) {
    return <div className="pane"><p className="muted">Select a report to open it.</p></div>;
  }
  const r = report;
  const change = async (s) => onStatus(await setStatus(r.id, s));

  return (
    <div className="pane">
      <h2>{CATEGORY_LABELS[r.category] ?? r.category}</h2>
      <p className="muted">
        {r.location_text ?? "Location not given"} {r.landmark ? `(${r.landmark})` : ""} · {ago(r.created_at)}
      </p>

      <div className="statusbar">
        {STATUSES.map((s) => (
          <button key={s} className={r.status === s ? "on" : ""} onClick={() => change(s)}>{s}</button>
        ))}
      </div>

      {r.photo && <img className="photo" src={`${API}${r.photo}`} alt="Resident photo" />}

      <h3>Detail</h3>
      <div className="card">
        <p style={{ margin: 0 }}>{r.description}</p>
      </div>

      <h3>Structured</h3>
      <dl className="kv">
        <dt>Severity</dt>
        <dd><span style={{ color: SEV_COLOR[r.severity] }}>●</span> {r.severity}</dd>
        <dt>Safety risk</dt>
        <dd>{r.safety_risk ? <span className="tag risk">Yes</span> : "No"}</dd>
        <dt>District</dt>
        <dd>{r.district ?? <span className="muted">Location not mapped</span>}</dd>
        <dt>Coordinates</dt>
        <dd className="muted">
          {r.lat ? `${r.lat.toFixed(5)}, ${r.lng.toFixed(5)} (${r.geocode_method})` : "none"}
        </dd>
        <dt>Language</dt><dd>{r.language}</dd>
        <dt>Channel</dt><dd>{r.source}</dd>
        <dt>Reference</dt><dd style={{ fontFamily: "ui-monospace,monospace" }}>{r.id}</dd>
      </dl>

      {/* The honesty feature: staff can check what the resident actually said
          when the structured summary looks wrong. */}
      {r.transcript?.length > 0 && (
        <details open>
          <summary>Original transcript ({r.transcript.length} turns)</summary>
          <div style={{ marginTop: 8 }}>
            {r.transcript.map((t, i) => (
              <div className="turn" key={i}>
                <b>{t.role === "user" ? "Resident" : "Repoth"}</b>
                <div>{t.text}</div>
              </div>
            ))}
          </div>
        </details>
      )}
      {r.source === "hrm_import" && (
        <p className="muted" style={{ marginTop: 18, fontSize: 12 }}>
          Imported from HRM open data. Not a Repoth voice report, so there is no transcript.
        </p>
      )}
    </div>
  );
}
