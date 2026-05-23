import { useEffect, useMemo, useState } from "react";

const NAV_ITEMS = [
  "Command Center",
  "Understand",
  "Prioritize",
  "ROI Simulator",
  "Model",
  "Profile Test",
  "Manager Brief",
];

const PRIORITY_ORDER = ["Hot Lead", "Warm Lead", "Low Priority"];
const PRIORITY_COLORS = {
  "Hot Lead": "#0f766e",
  "Warm Lead": "#b45309",
  "Low Priority": "#64748b",
};

const MONTH_ORDER = ["mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function formatNumber(value, digits = 0) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatPercent(value, digits = 1) {
  return `${((Number.isFinite(value) ? value : 0) * 100).toFixed(digits)}%`;
}

function svgTooltipStyle(x, y, width, height) {
  return {
    left: `${(x / width) * 100}%`,
    top: `${(y / height) * 100}%`,
  };
}

function polarToCartesian(cx, cy, radius, angleInDegrees) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(angleInRadians),
    y: cy + radius * Math.sin(angleInRadians),
  };
}

function donutSegmentPath(cx, cy, outerRadius, innerRadius, startAngle, endAngle) {
  const outerStart = polarToCartesian(cx, cy, outerRadius, endAngle);
  const outerEnd = polarToCartesian(cx, cy, outerRadius, startAngle);
  const innerStart = polarToCartesian(cx, cy, innerRadius, startAngle);
  const innerEnd = polarToCartesian(cx, cy, innerRadius, endAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 0 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerStart.x} ${innerStart.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 1 ${innerEnd.x} ${innerEnd.y}`,
    "Z",
  ].join(" ");
}

function rowDetail(row, valueKey, valueFormatter) {
  const details = [`Value: ${valueFormatter(row[valueKey])}`];
  if (Number.isFinite(row.contacts)) details.push(`Contacts: ${formatNumber(row.contacts)}`);
  if (Number.isFinite(row.subscriptions)) details.push(`Subscriptions: ${formatNumber(row.subscriptions)}`);
  if (Number.isFinite(row.customers)) details.push(`Customers: ${formatNumber(row.customers)}`);
  if (Number.isFinite(row.actualSubscribers)) details.push(`Actual subscribers: ${formatNumber(row.actualSubscribers)}`);
  return details;
}

function recommendedThreshold(goal) {
  if (goal === "Reduce Wasted Calls") return 0.7;
  if (goal === "Maximize Conversions") return 0.3;
  return 0.5;
}

function recommendedPage(goal) {
  return goal === "Maximize Profit" ? "ROI Simulator" : "Prioritize";
}

function priorityForScore(score) {
  if (score >= 0.6) return "Hot Lead";
  if (score >= 0.3) return "Warm Lead";
  return "Low Priority";
}

function simulateRoi(leads, threshold, callCost, revenue) {
  const selected = leads.filter((lead) => lead.score >= threshold);
  const expectedConversions = selected.reduce((sum, lead) => sum + lead.score, 0);
  const campaignCost = selected.length * callCost;
  const estimatedRevenue = expectedConversions * revenue;
  const estimatedProfit = estimatedRevenue - campaignCost;

  return {
    selected,
    totalCustomers: leads.length,
    customersContacted: selected.length,
    callsSaved: leads.length - selected.length,
    expectedConversions,
    conversionRate: selected.length ? expectedConversions / selected.length : 0,
    campaignCost,
    estimatedRevenue,
    estimatedProfit,
    estimatedCostSaved: (leads.length - selected.length) * callCost,
  };
}

function buildCurve(leads, callCost, revenue) {
  return Array.from({ length: 19 }, (_, index) => Number((0.05 + index * 0.05).toFixed(2))).map(
    (threshold) => ({
      threshold,
      ...simulateRoi(leads, threshold, callCost, revenue),
    }),
  );
}

function downloadCsv(filename, rows) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((header) => {
          const value = row[header] ?? "";
          const escaped = String(value).replaceAll('"', '""');
          return `"${escaped}"`;
        })
        .join(","),
    ),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function Metric({ label, value, detail }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </div>
  );
}

function Hero({ title, eyebrow, copy, metrics }) {
  return (
    <section className="hero">
      <div className="hero-copy">
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{copy}</p>
      </div>
      <div className="hero-metrics">
        {metrics.map((metric) => (
          <Metric key={metric.label} {...metric} />
        ))}
      </div>
    </section>
  );
}

function Sidebar({ page, setPage }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">STX</div>
        <div>
          <strong>Strategix</strong>
          <span>Campaign Intelligence</span>
        </div>
      </div>

      <nav>
        {NAV_ITEMS.map((item, index) => (
          <button
            className={page === item ? "nav-item active" : "nav-item"}
            key={item}
            onClick={() => setPage(item)}
            type="button"
          >
            <span>{String(index + 1).padStart(2, "0")}</span>
            {item}
          </button>
        ))}
      </nav>

      <div className="sidebar-note">
        <strong>Pre-call model</strong>
        <p>Call duration is excluded so scores are usable before outreach begins.</p>
      </div>
    </aside>
  );
}

function Topbar({ data, goal, setGoal, callCost, setCallCost, revenue, setRevenue }) {
  return (
    <header className="topbar">
      <div>
        <span className="status-dot" />
        <span className="topbar-title">Live campaign workspace</span>
      </div>
      <div className="topbar-controls">
        <label>
          Goal
          <select value={goal} onChange={(event) => setGoal(event.target.value)}>
            {data.goals.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          Call cost
          <input
            min="0"
            type="number"
            value={callCost}
            onChange={(event) => setCallCost(Number(event.target.value))}
          />
        </label>
        <label>
          Revenue
          <input
            min="0"
            type="number"
            value={revenue}
            onChange={(event) => setRevenue(Number(event.target.value))}
          />
        </label>
      </div>
    </header>
  );
}

function DonutChart({ items, center, label }) {
  const [hovered, setHovered] = useState(null);
  const total = items.reduce((sum, item) => sum + item.value, 0) || 1;
  let current = 0;
  const segments = items.map((item) => {
    const start = current;
    const end = current + (item.value / total) * 360;
    current = end;
    return { ...item, start, end };
  });

  return (
    <div className="donut-wrap">
      <div className="donut">
        <svg viewBox="0 0 220 220" aria-label="Lead priority donut chart">
          {segments.map((item) => (
            <path
              className="donut-slice"
              d={donutSegmentPath(110, 110, 104, 66, item.start, item.end)}
              fill={item.color}
              key={item.label}
              onMouseEnter={() => setHovered(item)}
              onMouseLeave={() => setHovered(null)}
            >
              <title>
                {item.label}: {formatNumber(item.value)} customers, {formatPercent(item.value / total)}
              </title>
            </path>
          ))}
        </svg>
        <div className="donut-center">
          <strong>{center}</strong>
          <span>{label}</span>
        </div>
      </div>
      {hovered ? (
        <div className="chart-hover-card donut-hover">
          <strong>{hovered.label}</strong>
          <span>{formatNumber(hovered.value)} customers</span>
          <span>{formatPercent(hovered.value / total)} of total</span>
        </div>
      ) : null}
      <div className="legend">
        {items.map((item) => (
          <span key={item.label}>
            <i style={{ background: item.color }} />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function BarList({ rows, labelKey = "name", valueKey, valueFormatter = formatPercent, limit = 10 }) {
  const visible = rows.slice(0, limit);
  const max = Math.max(...visible.map((row) => row[valueKey]), 0.01);

  return (
    <div className="bar-list">
      {visible.map((row) => (
        <div className="bar-row" key={`${row[labelKey]}-${row[valueKey]}`}>
          <span>{row[labelKey]}</span>
          <div className="bar-track">
            <i style={{ width: `${Math.max(4, (row[valueKey] / max) * 100)}%` }} />
          </div>
          <strong>{valueFormatter(row[valueKey])}</strong>
          <div className="chart-hover-card row-hover">
            <b>{row[labelKey]}</b>
            {rowDetail(row, valueKey, valueFormatter).map((detail) => (
              <em key={detail}>{detail}</em>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function LineChart({ rows, xKey, yKey, formatY = formatPercent }) {
  const [hovered, setHovered] = useState(null);
  const width = 720;
  const height = 280;
  const pad = 28;
  const values = rows.map((row) => row[yKey]);
  const max = Math.max(...values, 0.01);
  const min = Math.min(...values, 0);
  const range = max - min || 1;

  const points = rows.map((row, index) => {
    const x = pad + (index / Math.max(1, rows.length - 1)) * (width - pad * 2);
    const y = height - pad - ((row[yKey] - min) / range) * (height - pad * 2);
    return { x, y, row };
  });

  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");

  return (
    <div className="svg-card">
      <svg viewBox={`0 0 ${width} ${height}`} role="img">
        <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} />
        <line x1={pad} y1={pad} x2={pad} y2={height - pad} />
        <path d={path} className="line-path" />
        {points.map((point) => (
          <g
            className="interactive-point"
            key={point.row[xKey]}
            onMouseEnter={() => setHovered(point)}
            onMouseLeave={() => setHovered(null)}
          >
            <title>
              {point.row[xKey]}: {formatY(point.row[yKey])}
              {Number.isFinite(point.row.contacts) ? `, ${formatNumber(point.row.contacts)} contacts` : ""}
            </title>
            <circle cx={point.x} cy={point.y} r="5" />
            <text x={point.x} y={height - 8} textAnchor="middle">
              {point.row[xKey]}
            </text>
            <text x={point.x} y={point.y - 11} textAnchor="middle" className="point-label">
              {formatY(point.row[yKey])}
            </text>
          </g>
        ))}
      </svg>
      {hovered ? (
        <div className="chart-hover-card svg-tooltip" style={svgTooltipStyle(hovered.x, hovered.y, width, height)}>
          <strong>{hovered.row[xKey]}</strong>
          <span>{formatY(hovered.row[yKey])}</span>
          {Number.isFinite(hovered.row.contacts) ? <span>{formatNumber(hovered.row.contacts)} contacts</span> : null}
          {Number.isFinite(hovered.row.subscriptions) ? (
            <span>{formatNumber(hovered.row.subscriptions)} subscriptions</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Histogram({ leads, threshold }) {
  const bins = Array.from({ length: 20 }, (_, index) => ({
    start: index / 20,
    end: (index + 1) / 20,
    count: 0,
  }));

  leads.forEach((lead) => {
    const index = Math.min(19, Math.floor(lead.score * 20));
    bins[index].count += 1;
  });

  const max = Math.max(...bins.map((bin) => bin.count), 1);

  return (
    <div className="histogram">
      {bins.map((bin) => (
        <div className="histogram-bin" key={bin.start}>
          <i
            className={bin.end >= threshold ? "selected" : ""}
            style={{ height: `${Math.max(3, (bin.count / max) * 100)}%` }}
          >
            <span className="chart-hover-card histogram-hover">
              <b>
                {formatPercent(bin.start, 0)} - {formatPercent(bin.end, 0)}
              </b>
              <em>{formatNumber(bin.count)} customers</em>
              <em>{bin.end >= threshold ? "Included by threshold" : "Below threshold"}</em>
            </span>
          </i>
        </div>
      ))}
    </div>
  );
}

function SensitivityChart({ curve }) {
  const [hovered, setHovered] = useState(null);
  const width = 760;
  const height = 320;
  const pad = 36;
  const profits = curve.map((point) => point.estimatedProfit);
  const minProfit = Math.min(...profits, 0);
  const maxProfit = Math.max(...profits, 1);
  const profitRange = maxProfit - minProfit || 1;
  const maxReach = Math.max(...curve.map((point) => point.customersContacted), 1);

  const points = curve.map((point, index) => {
    const x = pad + (index / Math.max(1, curve.length - 1)) * (width - pad * 2);
    const y = height - pad - ((point.estimatedProfit - minProfit) / profitRange) * (height - pad * 2);
    return { x, y, point };
  });

  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");

  return (
    <div className="svg-card sensitivity">
      <svg viewBox={`0 0 ${width} ${height}`} role="img">
        <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} />
        <line x1={pad} y1={pad} x2={pad} y2={height - pad} />
        {curve.map((point, index) => {
          const barWidth = (width - pad * 2) / curve.length - 5;
          const barHeight = (point.customersContacted / maxReach) * (height - pad * 2);
          const x = pad + index * ((width - pad * 2) / curve.length) + 2;
          return (
            <rect
              key={point.threshold}
              className="reach-bar"
              x={x}
              y={height - pad - barHeight}
              width={barWidth}
              height={barHeight}
              onMouseEnter={() =>
                setHovered({
                  x: x + barWidth / 2,
                  y: height - pad - barHeight,
                  point,
                  kind: "Reach",
                })
              }
              onMouseLeave={() => setHovered(null)}
            />
          );
        })}
        <path d={path} className="line-path" />
        {points.map(({ x, y, point }) => (
          <circle
            className="interactive-point"
            key={point.threshold}
            cx={x}
            cy={y}
            r="4"
            onMouseEnter={() => setHovered({ x, y, point, kind: "Profit" })}
            onMouseLeave={() => setHovered(null)}
          >
            <title>
              Threshold {formatPercent(point.threshold, 0)}: {formatCurrency(point.estimatedProfit)} profit,{" "}
              {formatNumber(point.customersContacted)} contacted
            </title>
          </circle>
        ))}
        <text x={pad} y={18} className="chart-note">
          Profit line with contacted volume bars
        </text>
      </svg>
      {hovered ? (
        <div className="chart-hover-card svg-tooltip" style={svgTooltipStyle(hovered.x, hovered.y, width, height)}>
          <strong>
            {hovered.kind} at {formatPercent(hovered.point.threshold, 0)}
          </strong>
          <span>{formatCurrency(hovered.point.estimatedProfit)} profit</span>
          <span>{formatNumber(hovered.point.customersContacted)} customers contacted</span>
          <span>{formatNumber(hovered.point.expectedConversions, 1)} expected conversions</span>
        </div>
      ) : null}
    </div>
  );
}

function EconomicsBars({ targeted, traditional }) {
  const rows = [
    { name: "Call Everyone", value: traditional.estimatedProfit, color: "#64748b" },
    { name: "Strategix", value: targeted.estimatedProfit, color: "#0f766e" },
  ];
  const max = Math.max(...rows.map((row) => Math.abs(row.value)), 1);

  return (
    <div className="economics-bars">
      {rows.map((row) => (
        <div key={row.name} className="economics-row">
          <span>{row.name}</span>
          <div className="economics-track">
            <i style={{ width: `${Math.max(6, (Math.abs(row.value) / max) * 100)}%`, background: row.color }} />
          </div>
          <strong>{formatCurrency(row.value)}</strong>
          <div className="chart-hover-card row-hover">
            <b>{row.name}</b>
            <em>Estimated profit: {formatCurrency(row.value)}</em>
            <em>{row.name === "Strategix" ? "Model-targeted outreach" : "Baseline campaign"}</em>
          </div>
        </div>
      ))}
    </div>
  );
}

function LeadTable({ leads, limit = 50 }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Score</th>
            <th>Priority</th>
            <th>Age</th>
            <th>Job</th>
            <th>Education</th>
            <th>Month</th>
            <th>Campaign</th>
            <th>Previous</th>
          </tr>
        </thead>
        <tbody>
          {leads.slice(0, limit).map((lead) => (
            <tr
              key={lead.rank}
              title={`Rank ${lead.rank} | ${formatPercent(lead.score)} score | ${lead.priority} | ${lead.job}, ${lead.education}`}
            >
              <td>{lead.rank}</td>
              <td>
                <div className="score-pill">
                  <span style={{ width: `${lead.score * 100}%` }} />
                  <b>{formatPercent(lead.score)}</b>
                </div>
              </td>
              <td>
                <span className={`priority ${lead.priority.toLowerCase().replaceAll(" ", "-")}`}>{lead.priority}</span>
              </td>
              <td>{lead.age}</td>
              <td>{lead.job}</td>
              <td>{lead.education}</td>
              <td>{lead.month}</td>
              <td>{lead.campaign}</td>
              <td>{lead.poutcome}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CommandCenter({ data, goal, callCost, revenue, threshold, setThreshold, setPage }) {
  const roi = useMemo(() => simulateRoi(data.leads, threshold, callCost, revenue), [data.leads, threshold, callCost, revenue]);
  const recPage = recommendedPage(goal);
  const priorityItems = PRIORITY_ORDER.map((priority) => ({
    label: priority,
    value: data.overview.priorityCounts[priority] || 0,
    color: PRIORITY_COLORS[priority],
  }));
  const topJobs = data.segments.job.slice(0, 8);

  return (
    <>
      <Hero
        title="Strategix"
        eyebrow="Command Center"
        copy="Turn bank campaign data into better call lists, clearer ROI, and faster decisions."
        metrics={[
          { label: "Customers", value: formatNumber(data.overview.totalCustomers) },
          { label: "Historical conversion", value: formatPercent(data.overview.conversionRate) },
          { label: "Target list", value: formatNumber(roi.customersContacted) },
          { label: "Profit preview", value: formatCurrency(roi.estimatedProfit) },
        ]}
      />

      <section className="decision-band">
        <div>
          <span>Recommended next move</span>
          <strong>{recPage}</strong>
          <p>
            For {goal}, use a {formatPercent(recommendedThreshold(goal), 0)} starting threshold and refine it with live ROI.
          </p>
        </div>
        <button className="primary-button" type="button" onClick={() => setPage(recPage)}>
          Open {recPage}
        </button>
      </section>

      <section className="control-strip">
        <label className="range-label">
          Planning threshold
          <strong>{formatPercent(threshold, 0)}</strong>
          <input
            type="range"
            min="0.05"
            max="0.95"
            step="0.05"
            value={threshold}
            onChange={(event) => setThreshold(Number(event.target.value))}
          />
        </label>
        <Metric label="Expected conversions" value={formatNumber(roi.expectedConversions, 1)} />
        <Metric label="Calls saved" value={formatNumber(roi.callsSaved)} />
        <Metric label="Estimated revenue" value={formatCurrency(roi.estimatedRevenue)} />
      </section>

      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-head">
            <span>Lead mix</span>
            <strong>Priority distribution</strong>
          </div>
          <DonutChart items={priorityItems} center={formatNumber(data.overview.totalCustomers)} label="customers" />
        </section>

        <section className="panel">
          <div className="panel-head">
            <span>Segments</span>
            <strong>Best job profiles</strong>
          </div>
          <BarList rows={topJobs} valueKey="conversionRate" limit={8} />
        </section>

        <section className="panel wide">
          <div className="panel-head">
            <span>Economics</span>
            <strong>Revenue, cost, and profit</strong>
          </div>
          <div className="finance-stack">
            <Metric label="Revenue" value={formatCurrency(roi.estimatedRevenue)} />
            <Metric label="Calling cost" value={formatCurrency(roi.campaignCost)} />
            <Metric label="Profit" value={formatCurrency(roi.estimatedProfit)} />
          </div>
          <Histogram leads={data.leads} threshold={threshold} />
        </section>
      </div>

      <section className="workflow-grid">
        {[
          ["Understand", "Audit historical conversion by audience and timing.", data.overview.conversionRate, "conversion"],
          ["Prioritize", "Filter and export a ranked call queue.", roi.customersContacted, "targeted customers"],
          ["ROI Simulator", "Compare threshold strategies and campaign profit.", roi.estimatedProfit, "profit"],
          ["Profile Test", "Score a custom customer profile through the API.", data.metrics.rocAuc, "ROC-AUC"],
        ].map(([title, copy, value, label]) => (
          <button className="workflow-tile" key={title} type="button" onClick={() => setPage(title)}>
            <span>{label}</span>
            <strong>
              {label === "profit"
                ? formatCurrency(value)
                : label === "conversion" || label === "ROC-AUC"
                  ? formatPercent(value)
                  : formatNumber(value)}
            </strong>
            <p>{copy}</p>
          </button>
        ))}
      </section>
    </>
  );
}

function UnderstandPage({ data }) {
  const [segment, setSegment] = useState("job");
  const [minimum, setMinimum] = useState(150);
  const rows = useMemo(
    () => (data.segments[segment] || []).filter((row) => row.contacts >= minimum),
    [data.segments, segment, minimum],
  );
  const monthRows = useMemo(
    () => [...(data.segments.month || [])].sort((a, b) => MONTH_ORDER.indexOf(a.name) - MONTH_ORDER.indexOf(b.name)),
    [data.segments],
  );

  return (
    <>
      <Hero
        title="Understand Campaign"
        eyebrow="Historical performance"
        copy="Inspect how the original marketing campaign converted across audiences, months, and previous outcomes."
        metrics={[
          { label: "Contacts", value: formatNumber(data.overview.totalCustomers) },
          { label: "Subscribers", value: formatNumber(data.overview.subscribers) },
          { label: "Non-subscribers", value: formatNumber(data.overview.nonSubscribers) },
          { label: "Average age", value: formatNumber(data.overview.avgAge, 1) },
        ]}
      />

      <div className="split-grid">
        <section className="panel">
          <div className="panel-head">
            <span>Funnel</span>
            <strong>Contacted to subscribed</strong>
          </div>
          <div className="funnel">
            <div style={{ width: "100%" }}>
              <span>Contacted</span>
              <strong>{formatNumber(data.overview.totalCustomers)}</strong>
            </div>
            <div style={{ width: `${Math.max(12, data.overview.conversionRate * 100)}%` }}>
              <span>Subscribed</span>
              <strong>{formatNumber(data.overview.subscribers)}</strong>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <span>Seasonality</span>
            <strong>Conversion by month</strong>
          </div>
          <LineChart rows={monthRows} xKey="name" yKey="conversionRate" />
        </section>
      </div>

      <section className="panel">
        <div className="panel-head with-controls">
          <div>
            <span>Segment radar</span>
            <strong>Conversion by dimension</strong>
          </div>
          <div className="inline-controls">
            <label>
              Segment
              <select value={segment} onChange={(event) => setSegment(event.target.value)}>
                {Object.keys(data.segments).map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label>
              Minimum contacts
              <input min="0" step="50" type="number" value={minimum} onChange={(event) => setMinimum(Number(event.target.value))} />
            </label>
          </div>
        </div>
        <BarList rows={rows} valueKey="conversionRate" limit={14} />
      </section>
    </>
  );
}

function PrioritizePage({ data, goal, threshold, setThreshold }) {
  const [job, setJob] = useState("All");
  const [rows, setRows] = useState(75);
  const [ageMin, setAgeMin] = useState(data.ranges.age.min);
  const [ageMax, setAgeMax] = useState(data.ranges.age.max);
  const [priorities, setPriorities] = useState(PRIORITY_ORDER);

  const filtered = useMemo(
    () =>
      data.leads.filter((lead) => {
        const priorityMatch = priorities.includes(lead.priority);
        const jobMatch = job === "All" || lead.job === job;
        return lead.score >= threshold && priorityMatch && jobMatch && lead.age >= ageMin && lead.age <= ageMax;
      }),
    [data.leads, threshold, priorities, job, ageMin, ageMax],
  );

  const expected = filtered.reduce((sum, lead) => sum + lead.score, 0);

  function togglePriority(priority) {
    setPriorities((current) =>
      current.includes(priority) ? current.filter((item) => item !== priority) : [...current, priority],
    );
  }

  return (
    <>
      <Hero
        title="Prioritize Leads"
        eyebrow="Ranked call queue"
        copy="Focus outreach on customers with the strongest subscription probability and export the exact list."
        metrics={[
          { label: "Hot leads", value: formatNumber(data.overview.priorityCounts["Hot Lead"]) },
          { label: "Warm leads", value: formatNumber(data.overview.priorityCounts["Warm Lead"]) },
          { label: "Highest score", value: formatPercent(data.overview.highestScore) },
          { label: "Goal", value: goal },
        ]}
      />

      <section className="filter-panel">
        <label className="range-label">
          Minimum score
          <strong>{formatPercent(threshold, 0)}</strong>
          <input type="range" min="0.05" max="0.95" step="0.05" value={threshold} onChange={(event) => setThreshold(Number(event.target.value))} />
        </label>
        <label>
          Job
          <select value={job} onChange={(event) => setJob(event.target.value)}>
            <option>All</option>
            {data.options.job.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          Age min
          <input type="number" value={ageMin} onChange={(event) => setAgeMin(Number(event.target.value))} />
        </label>
        <label>
          Age max
          <input type="number" value={ageMax} onChange={(event) => setAgeMax(Number(event.target.value))} />
        </label>
      </section>

      <div className="priority-toggle">
        {PRIORITY_ORDER.map((priority) => (
          <button
            className={priorities.includes(priority) ? "active" : ""}
            key={priority}
            type="button"
            onClick={() => togglePriority(priority)}
          >
            <span style={{ background: PRIORITY_COLORS[priority] }} />
            {priority}
          </button>
        ))}
      </div>

      <section className="control-strip">
        <Metric label="Queued customers" value={formatNumber(filtered.length)} />
        <Metric label="Expected conversions" value={formatNumber(expected, 1)} />
        <Metric label="Average score" value={formatPercent(filtered.length ? expected / filtered.length : 0)} />
        <Metric label="Calls avoided" value={formatNumber(data.leads.length - filtered.length)} />
      </section>

      <div className="split-grid">
        <section className="panel">
          <div className="panel-head">
            <span>Distribution</span>
            <strong>Score threshold impact</strong>
          </div>
          <Histogram leads={data.leads} threshold={threshold} />
        </section>
        <section className="panel">
          <div className="panel-head">
            <span>Export</span>
            <strong>Filtered call list</strong>
          </div>
          <label>
            Rows shown
            <input type="range" min="10" max="250" step="5" value={rows} onChange={(event) => setRows(Number(event.target.value))} />
          </label>
          <button className="primary-button full" type="button" onClick={() => downloadCsv("strategix_filtered_leads.csv", filtered)}>
            Download filtered leads
          </button>
        </section>
      </div>

      <LeadTable leads={filtered} limit={rows} />
    </>
  );
}

function RoiPage({ data, callCost, revenue, threshold, setThreshold }) {
  const [strategy, setStrategy] = useState("Balanced");
  const roi = useMemo(() => simulateRoi(data.leads, threshold, callCost, revenue), [data.leads, threshold, callCost, revenue]);
  const curve = useMemo(() => buildCurve(data.leads, callCost, revenue), [data.leads, callCost, revenue]);
  const traditionalConversions = data.leads.reduce((sum, lead) => sum + lead.score, 0);
  const traditional = {
    estimatedProfit: traditionalConversions * revenue - data.leads.length * callCost,
  };
  const best = curve.reduce((winner, point) => (point.estimatedProfit > winner.estimatedProfit ? point : winner), curve[0]);

  function chooseStrategy(name) {
    setStrategy(name);
    setThreshold(data.strategies[name]);
  }

  return (
    <>
      <Hero
        title="ROI Simulator"
        eyebrow="Campaign economics"
        copy="Tune score thresholds and compare targeted outreach with calling every customer in the historical base."
        metrics={[
          { label: "Current strategy", value: strategy },
          { label: "Best tested threshold", value: formatPercent(best.threshold, 0) },
          { label: "Best tested profit", value: formatCurrency(best.estimatedProfit) },
          { label: "Calls saved", value: formatNumber(roi.callsSaved) },
        ]}
      />

      <section className="strategy-row">
        {Object.keys(data.strategies).map((name) => (
          <button className={strategy === name ? "active" : ""} key={name} type="button" onClick={() => chooseStrategy(name)}>
            <span>{name}</span>
            <strong>{formatPercent(data.strategies[name], 0)}</strong>
          </button>
        ))}
      </section>

      <section className="control-strip">
        <label className="range-label">
          Probability threshold
          <strong>{formatPercent(threshold, 0)}</strong>
          <input type="range" min="0.05" max="0.95" step="0.05" value={threshold} onChange={(event) => setThreshold(Number(event.target.value))} />
        </label>
        <Metric label="Customers contacted" value={formatNumber(roi.customersContacted)} />
        <Metric label="Expected conversions" value={formatNumber(roi.expectedConversions, 1)} />
        <Metric label="Estimated profit" value={formatCurrency(roi.estimatedProfit)} />
      </section>

      <div className="split-grid">
        <section className="panel">
          <div className="panel-head">
            <span>Comparison</span>
            <strong>Profit by approach</strong>
          </div>
          <EconomicsBars targeted={roi} traditional={traditional} />
        </section>
        <section className="panel">
          <div className="panel-head">
            <span>Campaign P&L</span>
            <strong>Revenue minus calling cost</strong>
          </div>
          <div className="finance-stack vertical">
            <Metric label="Revenue" value={formatCurrency(roi.estimatedRevenue)} />
            <Metric label="Calling cost" value={formatCurrency(roi.campaignCost)} />
            <Metric label="Profit" value={formatCurrency(roi.estimatedProfit)} />
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel-head">
          <span>Sensitivity</span>
          <strong>Profit and reach by threshold</strong>
        </div>
        <SensitivityChart curve={curve} />
      </section>
    </>
  );
}

function ModelPage({ data }) {
  const [featureCount, setFeatureCount] = useState(18);
  const features = data.featureImportance.slice(0, featureCount);
  const bandRows = [...data.scoreBands].reverse();

  return (
    <>
      <Hero
        title="Model Intelligence"
        eyebrow="Explainability"
        copy="Review performance, feature importance, and how score bands compare with actual conversion."
        metrics={[
          { label: "Precision", value: data.metrics.precision.toFixed(3) },
          { label: "Recall", value: data.metrics.recall.toFixed(3) },
          { label: "PR-AUC", value: data.metrics.prAuc.toFixed(3) },
          { label: "ROC-AUC", value: data.metrics.rocAuc.toFixed(3) },
        ]}
      />

      <div className="split-grid">
        <section className="panel">
          <div className="panel-head with-controls">
            <div>
              <span>Drivers</span>
              <strong>Top model features</strong>
            </div>
            <label>
              Count
              <input min="5" max="30" type="number" value={featureCount} onChange={(event) => setFeatureCount(Number(event.target.value))} />
            </label>
          </div>
          <BarList rows={features} labelKey="feature" valueKey="importance" valueFormatter={(value) => value.toFixed(3)} limit={featureCount} />
        </section>

        <section className="panel">
          <div className="panel-head">
            <span>Validation</span>
            <strong>Score bands vs actuals</strong>
          </div>
          <BarList rows={bandRows} labelKey="band" valueKey="actualConversion" valueFormatter={formatPercent} limit={10} />
        </section>
      </div>
    </>
  );
}

function ProfilePage({ data }) {
  const [profile, setProfile] = useState(data.defaultProfile);
  const [prediction, setPrediction] = useState(null);
  const [busy, setBusy] = useState(false);
  const fields = Object.keys(data.defaultProfile);

  useEffect(() => {
    const controller = new AbortController();
    setBusy(true);
    const timeout = window.setTimeout(() => {
      fetch("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile }),
        signal: controller.signal,
      })
        .then((response) => {
          if (!response.ok) throw new Error("Prediction failed");
          return response.json();
        })
        .then((payload) => setPrediction(payload))
        .catch((error) => {
          if (error.name !== "AbortError") setPrediction({ error: error.message });
        })
        .finally(() => setBusy(false));
    }, 350);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [profile]);

  function setPreset(name) {
    if (name === "high") setProfile(data.presetProfiles.high);
    else if (name === "low") setProfile(data.presetProfiles.low);
    else setProfile(data.defaultProfile);
  }

  function updateField(field, value) {
    setProfile((current) => ({ ...current, [field]: value }));
  }

  return (
    <>
      <Hero
        title="Profile Test"
        eyebrow="Live API scoring"
        copy="Change customer attributes and the React interface requests a fresh subscription probability from the FastAPI model service."
        metrics={[
          { label: "Fields", value: fields.length },
          { label: "Hot threshold", value: "60%" },
          { label: "Warm threshold", value: "30%" },
          { label: "Status", value: busy ? "Scoring" : "Ready" },
        ]}
      />

      <section className="strategy-row compact">
        <button type="button" onClick={() => setPreset("typical")}>Typical</button>
        <button type="button" onClick={() => setPreset("high")}>High Potential</button>
        <button type="button" onClick={() => setPreset("low")}>Low Priority</button>
      </section>

      <div className="profile-layout">
        <section className="profile-form">
          {fields.map((field) => {
            if (data.options[field]) {
              return (
                <label key={field}>
                  {field}
                  <select value={profile[field]} onChange={(event) => updateField(field, event.target.value)}>
                    {data.options[field].map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                </label>
              );
            }

            const range = data.ranges[field];
            return (
              <label key={field}>
                {field}
                <strong>{formatNumber(Number(profile[field]), range.integer ? 0 : 2)}</strong>
                <input
                  type="range"
                  min={range.min}
                  max={range.max}
                  step={range.integer ? 1 : 0.01}
                  value={profile[field]}
                  onChange={(event) => updateField(field, Number(event.target.value))}
                />
              </label>
            );
          })}
        </section>

        <aside className="score-panel">
          {prediction?.error ? (
            <p className="error-text">{prediction.error}</p>
          ) : (
            <>
              <span>Subscription probability</span>
              <strong>{prediction ? formatPercent(prediction.probability) : "..."}</strong>
              <div className="score-meter">
                <i style={{ width: `${(prediction?.probability || 0) * 100}%` }} />
              </div>
              <p>
                {prediction?.priority || "Waiting"} - {prediction?.action || "adjust a field"}
              </p>
              <div className="signal-list">
                {(prediction?.signals || []).map((signal) => (
                  <div key={`${signal.signal}-${signal.value}`}>
                    <span>{signal.signal}</span>
                    <strong>{signal.value}</strong>
                    <small>{formatPercent(signal.conversionRate)} historical conversion</small>
                  </div>
                ))}
              </div>
            </>
          )}
        </aside>
      </div>
    </>
  );
}

function BriefPage({ data, goal, callCost, revenue, threshold }) {
  const roi = useMemo(() => simulateRoi(data.leads, threshold, callCost, revenue), [data.leads, threshold, callCost, revenue]);
  const generated = `Strategix recommends a targeted term-deposit campaign for ${goal}. At a ${formatPercent(
    threshold,
    0,
  )} score threshold, the bank should contact ${formatNumber(roi.customersContacted)} of ${formatNumber(
    roi.totalCustomers,
  )} customers. This avoids ${formatNumber(roi.callsSaved)} lower-priority calls, saves roughly ${formatCurrency(
    roi.estimatedCostSaved,
  )} in calling cost, and is expected to generate ${formatNumber(roi.expectedConversions, 1)} subscriptions with estimated profit of ${formatCurrency(
    roi.estimatedProfit,
  )}.`;
  const [brief, setBrief] = useState(generated);

  useEffect(() => {
    setBrief(generated);
  }, [generated]);

  return (
    <>
      <Hero
        title="Manager Brief"
        eyebrow="Recommendation"
        copy="A business-ready campaign summary with the selected call list ready for export."
        metrics={[
          { label: "Goal", value: goal },
          { label: "Threshold", value: formatPercent(threshold, 0) },
          { label: "Calls saved", value: formatNumber(roi.callsSaved) },
          { label: "Profit", value: formatCurrency(roi.estimatedProfit) },
        ]}
      />

      <section className="brief-panel">
        <textarea value={brief} onChange={(event) => setBrief(event.target.value)} />
        <div className="brief-actions">
          <Metric label="Customers contacted" value={formatNumber(roi.customersContacted)} />
          <Metric label="Expected conversions" value={formatNumber(roi.expectedConversions, 1)} />
          <button className="primary-button full" type="button" onClick={() => downloadCsv("strategix_recommended_call_list.csv", roi.selected)}>
            Download recommended call list
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <span>Execution plan</span>
          <strong>Recommended operating steps</strong>
        </div>
        <div className="action-plan">
          {[
            ["Call Hot Leads first", "Marketing Ops", "Ready"],
            ["Use Warm Leads if budget remains", "Branch Team", "Ready"],
            ["Hold Low Priority customers", "Campaign Manager", "Ready"],
            ["Review threshold after early results", "Analytics", "Monitor"],
            ["Keep duration excluded from pre-call scoring", "Analytics", "Required"],
          ].map(([step, owner, status]) => (
            <div key={step}>
              <strong>{step}</strong>
              <span>{owner}</span>
              <b>{status}</b>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function LoadingView() {
  return (
    <main className="loading-screen">
      <div className="loader" />
      <h1>Preparing Strategix</h1>
      <p>Training the model and scoring the customer base.</p>
    </main>
  );
}

function ErrorView({ message }) {
  return (
    <main className="loading-screen">
      <h1>Strategix could not start</h1>
      <p>{message}</p>
      <p>Make sure the FastAPI server is running on port 8000.</p>
    </main>
  );
}

export default function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [page, setPage] = useState("Command Center");
  const [goal, setGoal] = useState("Maximize Profit");
  const [callCost, setCallCost] = useState(5);
  const [revenue, setRevenue] = useState(100);
  const [threshold, setThreshold] = useState(0.5);

  useEffect(() => {
    fetch("/api/bootstrap")
      .then((response) => {
        if (!response.ok) throw new Error("API returned an error");
        return response.json();
      })
      .then((payload) => setData(payload))
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    setThreshold(recommendedThreshold(goal));
  }, [goal]);

  if (error) return <ErrorView message={error} />;
  if (!data) return <LoadingView />;

  const pages = {
    "Command Center": (
      <CommandCenter
        data={data}
        goal={goal}
        callCost={callCost}
        revenue={revenue}
        threshold={threshold}
        setThreshold={setThreshold}
        setPage={setPage}
      />
    ),
    Understand: <UnderstandPage data={data} />,
    Prioritize: <PrioritizePage data={data} goal={goal} threshold={threshold} setThreshold={setThreshold} />,
    "ROI Simulator": (
      <RoiPage data={data} callCost={callCost} revenue={revenue} threshold={threshold} setThreshold={setThreshold} />
    ),
    Model: <ModelPage data={data} />,
    "Profile Test": <ProfilePage data={data} />,
    "Manager Brief": <BriefPage data={data} goal={goal} callCost={callCost} revenue={revenue} threshold={threshold} />,
  };

  return (
    <div className="app-shell">
      <Sidebar page={page} setPage={setPage} />
      <main className="workspace">
        <Topbar
          data={data}
          goal={goal}
          setGoal={setGoal}
          callCost={callCost}
          setCallCost={setCallCost}
          revenue={revenue}
          setRevenue={setRevenue}
        />
        {pages[page]}
      </main>
    </div>
  );
}
