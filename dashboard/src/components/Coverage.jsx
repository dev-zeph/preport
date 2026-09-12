import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer, Cell,
} from "recharts";

const GAP_COLOR = { below: "#FF5A5A", near: "#8D99AB", above: "#39C07F" };

export default function Coverage({ data }) {
  if (!data) return <div className="pane"><p className="muted">Loading coverage data.</p></div>;

  const rows = [...data.districts].sort((a, b) => a.per_1000 - b.per_1000);
  const quiet = rows.filter((d) => d.gap === "below");
  const lowest = rows[0];
  const highest = rows[rows.length - 1];
  const spread = (highest.per_1000 / lowest.per_1000).toFixed(1);

  return (
    <div className="pane">
      <h2>Coverage gap</h2>
      <p className="muted">
        Service requests per 1,000 residents, by council district, over the trailing 12 months.
      </p>

      <div className="stats">
        <div className="stat">
          <b>{spread}x</b>
          <small>between the quietest and loudest district</small>
        </div>
        <div className="stat">
          <b>{data.resident_originated_share}%</b>
          <small>of all requests start with a resident, not staff</small>
        </div>
        <div className="stat">
          <b>{quiet.length}</b>
          <small>districts reporting below the municipal median</small>
        </div>
        <div className="stat">
          <b>{data.total_requests_in_window.toLocaleString()}</b>
          <small>requests in the window ({data.total_requests_all_time.toLocaleString()} all time)</small>
        </div>
      </div>

      <h3>Reports per 1,000 residents per year</h3>
      <div className="card" style={{ height: 360 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 16, bottom: 40, left: 4 }}>
            <XAxis
              dataKey="district" stroke="#8D99AB" fontSize={11}
              angle={-45} textAnchor="end" interval={0}
              tickFormatter={(d) => d.replace("District ", "D")}
            />
            <YAxis stroke="#8D99AB" fontSize={11} />
            <Tooltip
              contentStyle={{ background: "#171C24", border: "1px solid #252C38", borderRadius: 8 }}
              labelStyle={{ color: "#F2F5F9" }}
              formatter={(v, _n, p) => [
                `${v} per 1,000  (${p.payload.reports.toLocaleString()} requests)`,
                p.payload.gap === "below" ? "Below median" :
                p.payload.gap === "above" ? "Above median" : "Near median",
              ]}
            />
            <ReferenceLine
              y={data.median_per_1000} stroke="#4C8DFF" strokeDasharray="4 4"
              label={{ value: `median ${data.median_per_1000}`, fill: "#4C8DFF", fontSize: 11, position: "right" }}
            />
            <Bar dataKey="per_1000" radius={[4, 4, 0, 0]}>
              {rows.map((d) => <Cell key={d.district} fill={GAP_COLOR[d.gap]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <h3>What this does and does not show</h3>
      <div className="note">
        <p style={{ marginTop: 0 }}>
          Low reports per capita is <b>not</b> proof of unmet need. It could mean fewer problems,
          or different problems, or a district that phones instead of clicking.
        </p>
        <p style={{ marginBottom: 0 }}>
          What the data supports is narrower, and harder to argue with: {quiet.map((d) => d.district.replace("District ", "D")).join(", ")} are
          quiet in the record. The city's response follows the record. Nobody has checked whether
          the quiet is real. {lowest.district} logs {lowest.per_1000} requests per 1,000 residents
          against {highest.district}'s {highest.per_1000}, and council districts are drawn to roughly
          equal population, so that {spread}x gap is not explained by district size.
        </p>
      </div>

      <h3>Source and method</h3>
      <dl className="kv">
        <dt>Dataset</dt>
        <dd>
          HRM <code>Cityworks_Service_Requests</code>, live ArcGIS feed.{" "}
          <a href={data.source_url} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>
            endpoint
          </a>
        </dd>
        <dt>Window</dt>
        <dd>{data.window_start} to {data.feed_latest_record.slice(0, 10)} ({data.window_days} days)</dd>
        <dt>Latest record</dt>
        <dd>
          {data.feed_latest_record.slice(0, 10)}. The widely published HRM 311 extract ends
          December 2024; this live operational feed is current.
        </dd>
        <dt>Population</dt>
        <dd className="muted">{data.population_basis}</dd>
        <dt>Pulled</dt>
        <dd className="muted">{new Date(data.pulled_at).toLocaleString()}</dd>
      </dl>

      <h3>How requests reach the city</h3>
      <dl className="kv">
        {data.channels.map((c) => (
          <Fragmentish key={c.channel} channel={c.channel} n={c.n} total={data.total_requests_all_time} />
        ))}
      </dl>
      <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
        "INTERNAL" means staff opened the request. Only {data.resident_originated_share}% begin
        with a resident, which is the channel this project is trying to widen.
      </p>
    </div>
  );
}

function Fragmentish({ channel, n, total }) {
  return (
    <>
      <dt>{channel}</dt>
      <dd>{n.toLocaleString()} <span className="muted">({((n / total) * 100).toFixed(1)}%)</span></dd>
    </>
  );
}
