import { districts as D, DISTRICT_NAMES, wardOf } from "../api";

/**
 * The coverage gap panel. This is the argument, not an appendix.
 *
 * It departs from the prototype in one important way. The design's model scales
 * each district's expected rate by a road-condition index, and discloses that
 * both the counts and that index are invented. Our counts are real, pulled from
 * HRM's live Cityworks feed. The road index is not available to us at all: it
 * would come from the city's pavement-condition survey. So rather than invent
 * one to match the design, the expected rate here is the municipal average, and
 * the panel says so. Everything else about the chart is as designed.
 */
export default function Coverage() {
  if (!D?.districts?.length) {
    return <div className="gap"><div className="inner"><p>Coverage data is missing. Run <code>npm run pull-data</code>.</p></div></div>;
  }

  const rows = D.districts.map((d) => {
    const rate = d.per_1000;
    // No road-condition index available, so every district is held to the same
    // municipal average rather than to a fabricated one.
    const expected = D.median_per_1000;
    const missing = Math.round(((expected - rate) * d.population) / 1000);
    return { ...d, rate, expected, missing, ward: wardOf(d.district), name: DISTRICT_NAMES[wardOf(d.district)] ?? d.district };
  }).sort((a, b) => b.missing - a.missing);

  const top = Math.max(...rows.map((r) => Math.max(r.rate, r.expected)));
  const scale = Math.ceil(top / 50) * 50;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(scale * t));
  const worst = rows[0];
  const flaggedAt = 500;   // reports a year. Below this the gap is noise.

  const fmt = (n) => n.toLocaleString("en-CA");

  return (
    <div className="gap">
      <div className="inner">
        <div className="kicker" style={{ marginBottom: 12 }}>Coverage gap · reports per 1,000 residents</div>
        <h1>Which parts of Halifax aren't telling us anything?</h1>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "28px 40px", alignItems: "flex-start", marginBottom: 26 }}>
          <p className="method">
            A district that reports less than its population predicts is not necessarily a district with fewer
            problems. It may be one the city is not hearing from. The solid bar is what each district actually
            reported over the trailing year; the hatched stretch is what it would have reported at the municipal
            median rate. The hatching is the silence. Council districts are drawn to near population parity by
            electoral boundary law, so the spread below is not explained by district size.
          </p>
          <div style={{ flex: "0 1 320px", borderLeft: "2px solid var(--sev-high)", paddingLeft: 18 }}>
            <div style={{ font: "600 10px/1 var(--font-body)", letterSpacing: ".14em", textTransform: "uppercase", color: "var(--sev-high)", marginBottom: 9 }}>
              The one to look at
            </div>
            <div style={{ font: "600 19px/1.25 var(--font-heading)", marginBottom: 8 }}>
              {worst.district} · {worst.name}
            </div>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.58, color: "var(--color-neutral-800)" }}>
              {worst.rate} reports per 1,000 residents against a municipal median of {worst.expected}. That is about{" "}
              <strong style={{ fontWeight: 600 }}>{fmt(worst.missing)} reports a year</strong> the city never hears
              from this district.
            </p>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "272px 1fr 176px", gap: "0 18px", alignItems: "center", paddingBottom: 8, borderBottom: "1px solid var(--color-text)" }}>
          <div className="lbl" style={{ marginBottom: 0 }}>District · sorted by gap</div>
          <div style={{ position: "relative", height: 14 }}>
            {ticks.map((t, i) => (
              <span key={t} style={{
                position: "absolute", left: `${(i / (ticks.length - 1)) * 100}%`,
                transform: i === ticks.length - 1 ? "translateX(-100%)" : i === 0 ? "none" : "translateX(-50%)",
                font: "600 9.5px/1 var(--font-body)", letterSpacing: ".1em",
                color: "var(--color-neutral-600)", fontVariantNumeric: "tabular-nums",
              }}>{t}</span>
            ))}
          </div>
          <div className="lbl" style={{ marginBottom: 0, textAlign: "right" }}>Reports never made</div>
        </div>

        {rows.map((d) => {
          const flagged = d.missing > flaggedAt;
          const aw = Math.max(0, Math.min(100, (d.rate / scale) * 100));
          const ew = Math.max(0, Math.min(100, (d.expected / scale) * 100));
          return (
            <div key={d.district} className={`gaprow ${flagged ? "flagged" : ""}`}>
              <div style={{ minWidth: 0, paddingRight: 10 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{ font: "600 10px/1 var(--font-body)", fontVariantNumeric: "tabular-nums", color: "var(--color-neutral-600)", flex: "none" }}>
                    {d.ward}
                  </span>
                  <span style={{
                    font: `${flagged ? 600 : 400} 13.5px/1.25 var(--font-heading)`,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>{d.name}</span>
                </div>
                <div style={{ fontSize: 11, color: "var(--color-neutral-600)", marginTop: 3 }}>
                  {fmt(d.reports)} reports · {fmt(d.population)} residents
                </div>
              </div>
              <div className="bar">
                <div className="grid" />
                <div className="actual" style={{ width: `${aw}%` }} />
                {d.missing > 0 && <div className="deficit" style={{ left: `${aw}%`, width: `${Math.max(0, ew - aw)}%` }} />}
                <div className="tick" style={{ left: `${ew}%` }} />
              </div>
              <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                <div style={{ font: `600 ${flagged ? 15 : 13}px/1 var(--font-heading)`, color: d.missing > 0 ? "var(--sev-high)" : "var(--color-neutral-600)" }}>
                  {d.missing > 0 ? `−${fmt(d.missing)} / yr` : "at or above"}
                </div>
                <div style={{ fontSize: 11, color: "var(--color-neutral-600)", marginTop: 3 }}>
                  {d.rate} of {d.expected} per 1,000
                </div>
              </div>
            </div>
          );
        })}

        <div className="legend">
          <span><span style={{ width: 26, height: 11, background: "var(--color-neutral-500)" }} />Reported</span>
          <span><span style={{ width: 26, height: 11, background: "repeating-linear-gradient(135deg,var(--sev-high) 0 2px,transparent 2px 5px)", border: "1px solid var(--sev-high)" }} />Expected but never reported</span>
          <span><span style={{ width: 2, height: 16, background: "var(--color-text)" }} />Municipal median rate</span>
        </div>

        <div className="realbox">
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <span className="tag tag-outline" style={{ fontSize: 9.5, letterSpacing: ".1em", textTransform: "uppercase" }}>
              What's real on this page
            </span>
          </div>
          <div className="realgrid">
            <div>
              <strong>Real.</strong> Every request count comes from HRM's live Cityworks service request feed:{" "}
              {fmt(D.total_requests_all_time)} records all time, {fmt(D.total_requests_in_window)} in the window{" "}
              {D.window_start} to {String(D.feed_latest_record).slice(0, 10)}. Nothing here is synthetic.
            </div>
            <div>
              <strong>A correction to the brief.</strong> The brief states HRM 311 data ends December 2024. That is
              true of the published 311 extract. The operational feed used here is current to{" "}
              {String(D.feed_latest_record).slice(0, 10)}.
            </div>
            <div>
              <strong>Approximated.</strong> {D.population_basis}
            </div>
            <div>
              <strong>Not available.</strong> A road-condition index. The city's pavement-condition survey would let
              the expected rate scale with how bad each district's roads actually are. Without it, every district is
              held to the municipal median instead.
            </div>
            <div>
              <strong>Not claimed.</strong> Nothing here says a quiet district has fewer problems. It says the city
              has not heard from it, nobody has checked whether that silence is real, and the city's response
              follows the record. That is the finding.
            </div>
            <div>
              <strong>Who opens a request.</strong> Only {D.resident_originated_share}% of all service requests begin
              with a resident. The rest are opened internally by city staff.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
