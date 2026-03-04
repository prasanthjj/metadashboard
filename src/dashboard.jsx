import { useState, useEffect, useCallback } from "react";

const PROXY = "/api/v2";
const DB_ID = 2;
const REFRESH_INTERVAL = 3600; // seconds (1 hour)

// ── Themes ────────────────────────────────────────────────────────────────────
const THEMES = {
  dark: {
    label: "Dark", swatch: "#111827",
    bg: "#0a0f1a", cardBg: "#111827", border: "#1f2937", headerBg: "#0a0f1a",
    p: "#f9fafb", s: "#e5e7eb", t3: "#9ca3af", mu: "#6b7280", di: "#4b5563", fa: "#374151",
    sk: "#1f2937", rh: "#161f2e", inputScheme: "dark",
  },
  light: {
    label: "Light", swatch: "#ffffff",
    bg: "#f3f4f6", cardBg: "#ffffff", border: "#e5e7eb", headerBg: "#ffffff",
    p: "#111827", s: "#1f2937", t3: "#374151", mu: "#6b7280", di: "#9ca3af", fa: "#d1d5db",
    sk: "#e5e7eb", rh: "#f9fafb", inputScheme: "light",
  },
  midnight: {
    label: "Midnight", swatch: "#0f1729",
    bg: "#090d18", cardBg: "#0f1729", border: "#1a2340", headerBg: "#090d18",
    p: "#e8eeff", s: "#c5d0f0", t3: "#8090c0", mu: "#5060a0", di: "#303870", fa: "#202550",
    sk: "#1a2340", rh: "#131c35", inputScheme: "dark",
  },
  slate: {
    label: "Slate", swatch: "#1e293b",
    bg: "#0f172a", cardBg: "#1e293b", border: "#334155", headerBg: "#0f172a",
    p: "#f1f5f9", s: "#e2e8f0", t3: "#94a3b8", mu: "#64748b", di: "#475569", fa: "#334155",
    sk: "#334155", rh: "#263348", inputScheme: "dark",
  },
};
const THEME_KEYS = Object.keys(THEMES);

// ── Date helpers ──────────────────────────────────────────────────────────────
function toDateStr(d) { return d.toISOString().slice(0, 10); }
function defaultRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return { start: toDateStr(start), end: toDateStr(end) };
}

// ── Queries ───────────────────────────────────────────────────────────────────
const REVENUE_EXPR = `CASE WHEN iscancelled = 1 THEN 0 ELSE CASE WHEN final_charge_updated = 0 THEN advanceamount ELSE totalamount END END`;
const ACTIVE_FILTER = `all_status NOT IN ('SHIPMENT_CREATED','SHIPMENT_UNDER_CREATION')`;

function makeQueries(start, end) {
  const df  = `created_on >= '${start}' AND created_on < DATE_ADD('${end}', INTERVAL 1 DAY)`;
  const odf = `o.created_on >= '${start}' AND o.created_on < DATE_ADD('${end}', INTERVAL 1 DAY)`;
  return {
    kpis: `SELECT COUNT(CASE WHEN iscancelled = 0 THEN id END) as total_orders, SUM(${REVENUE_EXPR}) as total_revenue, ROUND(SUM(${REVENUE_EXPR}) / NULLIF(COUNT(CASE WHEN iscancelled = 0 THEN id END), 0), 2) as avg_order_value, COUNT(DISTINCT CASE WHEN iscancelled = 0 THEN customerid END) as unique_customers FROM orders WHERE ${df} AND ${ACTIVE_FILTER}`,
    ordersByStatus: `SELECT status, COUNT(*) as count FROM orders WHERE ${df} AND iscancelled = 0 AND ${ACTIVE_FILTER} GROUP BY status ORDER BY count DESC LIMIT 10`,
    dailyRevenue: `SELECT DATE(created_on) as day, COUNT(CASE WHEN iscancelled = 0 THEN id END) as orders, SUM(${REVENUE_EXPR}) as revenue FROM orders WHERE ${df} AND ${ACTIVE_FILTER} GROUP BY DATE(created_on) ORDER BY day ASC`,
    recentOrders: `SELECT o.id, o.created_on as created_at, CASE WHEN o.final_charge_updated = 0 THEN o.advanceamount ELSE o.totalamount END as total_amount, o.status, COALESCE(c.contact_name, c.email, CONCAT('Customer #', o.customerid)) as customer_name FROM orders o LEFT JOIN customers c ON o.customerid = c.id WHERE o.${ACTIVE_FILTER} ORDER BY o.created_on DESC LIMIT 8`,
    trackingStatus: `SELECT ot.status, COUNT(*) as count FROM ordertracking ot INNER JOIN orders o ON ot.orderid = o.id WHERE ${odf} GROUP BY ot.status ORDER BY count DESC`,
  };
}

// ── API ───────────────────────────────────────────────────────────────────────
async function runQuery(sql) {
  const res = await fetch(`${PROXY}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ database: DB_ID, sql }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const rows = data?.data?.rows || [];
  const cols = data?.data?.cols?.map((c) => c.name || c.display_name) || [];
  return rows.map((row) => Object.fromEntries(cols.map((c, i) => [c, row[i]])));
}

// ── Formatters ────────────────────────────────────────────────────────────────
const fmt = {
  currency: (n) => { if (!n && n !== 0) return "—"; const num = parseFloat(n); if (num >= 1e6) return `₹${(num / 1e6).toFixed(2)}M`; if (num >= 1000) return `₹${(num / 1000).toFixed(1)}K`; return `₹${num.toFixed(2)}`; },
  number:   (n) => (!n && n !== 0) ? "—" : parseFloat(n).toLocaleString("en-IN"),
  date:     (d) => !d ? "—" : new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
  datetime: (d) => !d ? "—" : new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }),
  countdown:(s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`,
};

const statusColor = (s) => {
  if (!s) return "#6b7280";
  const sl = s.toLowerCase();
  if (["delivered", "complete", "completed", "success"].includes(sl)) return "#10b981";
  if (["shipped", "dispatched", "in_transit", "processing"].includes(sl)) return "#3b82f6";
  if (["pending", "placed", "confirmed"].includes(sl)) return "#f59e0b";
  if (["cancelled", "canceled", "failed", "refunded"].includes(sl)) return "#ef4444";
  return "#8b5cf6";
};

// ── Sparkline ─────────────────────────────────────────────────────────────────
function Sparkline({ data, color = "#3b82f6" }) {
  if (!data || data.length < 2) return null;
  const vals = data.map((d) => parseFloat(d) || 0);
  const min = Math.min(...vals), max = Math.max(...vals), range = max - min || 1;
  const w = 110, h = 36;
  const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * w},${h - ((v - min) / range) * (h - 4) - 2}`);
  const gid = `sg${color.replace("#", "")}`;
  return (
    <svg width={w} height={h} style={{ overflow: "visible" }}>
      <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.25" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <path d={`M${pts.join(" L")} L${w},${h} L0,${h} Z`} fill={`url(#${gid})`} />
      <path d={`M${pts.join(" L")}`} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── BarChart ──────────────────────────────────────────────────────────────────
function BarChart({ data, xKey, yKey, color = "#3b82f6", height = 130, t }) {
  if (!data?.length) return <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", color: t.mu, fontSize: 12 }}>No data</div>;
  const vals = data.map((d) => parseFloat(d[yKey]) || 0);
  const max = Math.max(...vals, 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height, width: "100%" }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%" }}>
          <div style={{ flex: 1, width: "100%", display: "flex", alignItems: "flex-end" }}>
            <div style={{ width: "100%", background: `${color}22`, borderRadius: "2px 2px 0 0", height: `${(vals[i] / max) * 100}%`, minHeight: vals[i] > 0 ? 2 : 0, position: "relative" }}>
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: color, borderRadius: 1 }} />
            </div>
          </div>
          <span style={{ fontSize: 8, color: t.di, marginTop: 2, writingMode: "vertical-rl", transform: "rotate(180deg)", maxHeight: 28, overflow: "hidden" }}>{fmt.date(d[xKey])}</span>
        </div>
      ))}
    </div>
  );
}

// ── DonutChart ────────────────────────────────────────────────────────────────
function DonutChart({ data, labelKey, valueKey, t }) {
  if (!data?.length) return null;
  const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316"];
  const total = data.reduce((s, d) => s + (parseFloat(d[valueKey]) || 0), 0);
  let ca = -Math.PI / 2;
  const size = 120, r = 46, cx = 60, cy = 60, ir = r * 0.62;
  const slices = data.map((d, i) => {
    const val = parseFloat(d[valueKey]) || 0, angle = (val / total) * 2 * Math.PI;
    const x1 = cx + r * Math.cos(ca), y1 = cy + r * Math.sin(ca);
    ca += angle;
    const x2 = cx + r * Math.cos(ca), y2 = cy + r * Math.sin(ca);
    const ix1 = cx + ir * Math.cos(ca - angle), iy1 = cy + ir * Math.sin(ca - angle);
    const ix2 = cx + ir * Math.cos(ca), iy2 = cy + ir * Math.sin(ca);
    const large = angle > Math.PI ? 1 : 0;
    return { path: `M${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2} L${ix2},${iy2} A${ir},${ir} 0 ${large},0 ${ix1},${iy1} Z`, color: COLORS[i % COLORS.length], label: d[labelKey], pct: ((val / total) * 100).toFixed(1) };
  });
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
      <svg width={size} height={size}>{slices.map((s, i) => <path key={i} d={s.path} fill={s.color} opacity={0.85} />)}</svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 5, flex: 1 }}>
        {slices.slice(0, 7).map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: t.t3, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.label || "Unknown"}</span>
            <span style={{ fontSize: 11, color: t.s, fontFamily: "monospace" }}>{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── KPICard ───────────────────────────────────────────────────────────────────
function KPICard({ label, value, sub, sparkData, color = "#3b82f6", loading, t }) {
  return (
    <div style={{ background: t.cardBg, border: `1px solid ${t.border}`, borderRadius: 12, padding: "18px 22px", display: "flex", flexDirection: "column", gap: 8, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,transparent,${color}77,transparent)` }} />
      <span style={{ fontSize: 10, color: t.mu, textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "monospace" }}>{label}</span>
      {loading
        ? <div style={{ height: 32, background: t.sk, borderRadius: 6, animation: "pulse 1.5s infinite" }} />
        : <span style={{ fontSize: 26, fontWeight: 700, color: t.p, lineHeight: 1 }}>{value}</span>}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <span style={{ fontSize: 11, color: t.di }}>{sub}</span>
        {sparkData && <Sparkline data={sparkData} color={color} />}
      </div>
    </div>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────
function Card({ title, children, accent = "#3b82f6", style = {}, t }) {
  return (
    <div style={{ background: t.cardBg, border: `1px solid ${t.border}`, borderRadius: 12, overflow: "hidden", ...style }}>
      <div style={{ padding: "12px 18px", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 3, height: 13, background: accent, borderRadius: 2 }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: t.s, letterSpacing: "0.02em" }}>{title}</span>
      </div>
      <div style={{ padding: "14px 18px" }}>{children}</div>
    </div>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────────
function Badge({ status }) {
  const c = statusColor(status);
  return <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 4, background: `${c}18`, color: c, border: `1px solid ${c}33`, textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "monospace", whiteSpace: "nowrap" }}>{status || "—"}</span>;
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [data, setData]           = useState({});
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  const [dateRange, setDateRange] = useState(defaultRange);
  const [pending, setPending]     = useState(defaultRange);
  const [themeKey, setThemeKey]   = useState("dark");
  const t = THEMES[themeKey];

  const fetchAll = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const queries = makeQueries(dateRange.start, dateRange.end);
      const results = await Promise.allSettled(
        Object.entries(queries).map(([k, sql]) => runQuery(sql).then(r => [k, r]))
      );
      const newData = {};
      results.forEach(r => { if (r.status === "fulfilled") { const [k, v] = r.value; newData[k] = v; } });
      setData(newData); setLastRefresh(new Date());
    } catch (e) { setError(e.message); }
    finally { setLoading(false); setCountdown(REFRESH_INTERVAL); }
  }, [dateRange]);

  useEffect(() => {
    fetchAll();
    const iv = setInterval(fetchAll, REFRESH_INTERVAL * 1000);
    return () => clearInterval(iv);
  }, [fetchAll]);

  useEffect(() => {
    const iv = setInterval(() => setCountdown(c => c <= 1 ? REFRESH_INTERVAL : c - 1), 1000);
    return () => clearInterval(iv);
  }, []);

  function applyRange() {
    if (pending.start && pending.end) setDateRange(pending);
  }

  const kpis    = data.kpis?.[0] || {};
  const revSpark = (data.dailyRevenue || []).map(d => d.revenue);
  const ordSpark = (data.dailyRevenue || []).map(d => d.orders);

  const inputStyle = {
    background: t.cardBg, border: `1px solid ${t.border}`, color: t.p,
    borderRadius: 6, padding: "4px 8px", fontSize: 12, fontFamily: "monospace",
    outline: "none", colorScheme: t.inputScheme,
  };

  return (
    <div style={{ minHeight: "100vh", background: t.bg, fontFamily: "'DM Sans',system-ui,sans-serif", color: t.s, fontSize: 14 }}>
      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        .fade{animation:fadeIn .4s ease forwards}
        tr.rh:hover td{background:${t.rh} !important}
      `}</style>

      {/* ── Header ── */}
      <div style={{ borderBottom: `1px solid ${t.border}`, padding: "12px 24px", display: "flex", alignItems: "center", gap: 16, background: t.headerBg, position: "sticky", top: 0, zIndex: 10, flexWrap: "wrap" }}>

        {/* Logo + title */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginRight: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg,#3b82f6,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>◈</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: t.p }}>Operations Dashboard</div>
            <div style={{ fontSize: 10, color: t.di, fontFamily: "monospace" }}>Production</div>
          </div>
        </div>

        {/* Date range */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
          <span style={{ fontSize: 11, color: t.mu, fontFamily: "monospace" }}>From</span>
          <input type="date" value={pending.start} max={pending.end}
            onChange={e => setPending(r => ({ ...r, start: e.target.value }))}
            style={inputStyle} />
          <span style={{ fontSize: 11, color: t.mu, fontFamily: "monospace" }}>to</span>
          <input type="date" value={pending.end} min={pending.start} max={toDateStr(new Date())}
            onChange={e => setPending(r => ({ ...r, end: e.target.value }))}
            style={inputStyle} />
          <button onClick={applyRange}
            style={{ background: "#3b82f6", border: "none", color: "#fff", borderRadius: 6, padding: "5px 14px", fontSize: 11, cursor: "pointer", fontFamily: "monospace", fontWeight: 600 }}>
            Apply
          </button>
        </div>

        {/* Theme swatches */}
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          {THEME_KEYS.map(key => (
            <button key={key} title={THEMES[key].label} onClick={() => setThemeKey(key)}
              style={{
                width: 20, height: 20, borderRadius: "50%", background: THEMES[key].swatch,
                border: `2px solid ${themeKey === key ? "#3b82f6" : t.border}`,
                boxShadow: themeKey === key ? "0 0 0 2px #3b82f655" : "none",
                cursor: "pointer", padding: 0, transition: "box-shadow 0.15s",
              }} />
          ))}
        </div>

        {/* Status + refresh */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {error && <span style={{ fontSize: 11, color: "#ef4444", background: "#ef444415", padding: "3px 9px", borderRadius: 6 }}>⚠ {error}</span>}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: loading ? "#f59e0b" : "#10b981", boxShadow: `0 0 7px ${loading ? "#f59e0b" : "#10b981"}` }} />
            <span style={{ fontSize: 10, color: t.mu, fontFamily: "monospace" }}>
              {loading ? "Syncing…" : `↻ ${fmt.countdown(countdown)}`}
            </span>
          </div>
          <button onClick={fetchAll}
            style={{ background: t.cardBg, border: `1px solid ${t.border}`, color: t.t3, borderRadius: 7, padding: "5px 12px", fontSize: 11, cursor: "pointer", fontFamily: "monospace" }}>
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ padding: "20px 28px", maxWidth: 1400, margin: "0 auto" }} className="fade">

        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 18 }}>
          <KPICard label="Total Revenue"     loading={loading} value={fmt.currency(kpis.total_revenue)}    sub={`${dateRange.start} → ${dateRange.end}`} sparkData={revSpark} color="#3b82f6" t={t} />
          <KPICard label="Total Orders"      loading={loading} value={fmt.number(kpis.total_orders)}       sub={`${dateRange.start} → ${dateRange.end}`} sparkData={ordSpark} color="#10b981" t={t} />
          <KPICard label="Avg Order Value"   loading={loading} value={fmt.currency(kpis.avg_order_value)}  sub="Per transaction" color="#f59e0b" t={t} />
          <KPICard label="Unique Customers"  loading={loading} value={fmt.number(kpis.unique_customers)}   sub="Active buyers"   color="#8b5cf6" t={t} />
        </div>

        {/* Charts row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
          <Card title="Daily Revenue" accent="#3b82f6" t={t}>
            {loading
              ? <div style={{ height: 150, background: t.sk, borderRadius: 8, animation: "pulse 1.5s infinite" }} />
              : <BarChart data={data.dailyRevenue || []} xKey="day" yKey="revenue" color="#3b82f6" height={140} t={t} />}
          </Card>
          <Card title="Orders by Status" accent="#10b981" t={t}>
            {loading
              ? <div style={{ height: 140, background: t.sk, borderRadius: 8, animation: "pulse 1.5s infinite" }} />
              : <DonutChart data={data.ordersByStatus || []} labelKey="status" valueKey="count" t={t} />}
          </Card>
        </div>

        {/* Bottom row */}
        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 14 }}>
          <Card title="Recent Orders" accent="#3b82f6" t={t}>
            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {[...Array(6)].map((_, i) => <div key={i} style={{ height: 28, background: t.sk, borderRadius: 5, animation: "pulse 1.5s infinite", animationDelay: `${i * 0.1}s` }} />)}
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>{["Order ID", "Date", "Customer", "Amount", "Status"].map(h =>
                    <th key={h} style={{ textAlign: "left", fontSize: 10, color: t.di, fontWeight: 500, paddingBottom: 7, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.07em" }}>{h}</th>
                  )}</tr>
                </thead>
                <tbody>
                  {(data.recentOrders || []).map((o, i) => (
                    <tr key={i} className="rh" style={{ borderTop: `1px solid ${t.border}` }}>
                      <td style={{ padding: "7px 0", fontSize: 12, color: "#6366f1", fontFamily: "monospace" }}>#{o.id}</td>
                      <td style={{ padding: "7px 8px", fontSize: 11, color: t.t3, fontFamily: "monospace" }}>{fmt.datetime(o.created_at)}</td>
                      <td style={{ padding: "7px 8px", fontSize: 12, color: t.s, maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.customer_name || "—"}</td>
                      <td style={{ padding: "7px 8px", fontSize: 12, color: t.p, fontFamily: "monospace", fontWeight: 500 }}>{fmt.currency(o.total_amount)}</td>
                      <td style={{ padding: "7px 0" }}><Badge status={o.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <Card title="Tracking Status" accent="#06b6d4" t={t}>
            {loading
              ? <div style={{ height: 90, background: t.sk, borderRadius: 8, animation: "pulse 1.5s infinite" }} />
              : (
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {(data.trackingStatus || []).slice(0, 6).map((trk, i) => {
                    const total = (data.trackingStatus || []).reduce((s, x) => s + (parseFloat(x.count) || 0), 0) || 1;
                    const pct = ((parseFloat(trk.count) || 0) / total) * 100;
                    const c = statusColor(trk.status);
                    return (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 3, height: 18, borderRadius: 2, background: c, flexShrink: 0 }} />
                        <span style={{ fontSize: 11, color: t.t3, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{trk.status || "Unknown"}</span>
                        <span style={{ fontSize: 11, color: c, fontFamily: "monospace", flexShrink: 0 }}>{fmt.number(trk.count)}</span>
                        <div style={{ width: 44, height: 3, background: t.border, borderRadius: 2 }}>
                          <div style={{ width: `${pct}%`, height: "100%", background: `${c}55`, borderRadius: 2 }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
          </Card>
        </div>

        <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 10, color: t.fa, fontFamily: "monospace" }}>
            Production DB · {lastRefresh ? `Updated ${lastRefresh.toLocaleTimeString("en-IN")}` : "Loading…"}
          </span>
          <span style={{ fontSize: 10, color: t.fa, fontFamily: "monospace" }}>Auto-refresh 1h · metaconnect.up.railway.app</span>
        </div>
      </div>
    </div>
  );
}
