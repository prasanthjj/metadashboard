import { useState, useEffect, useCallback, useRef } from "react";

const PROXY = "https://metaconnect.railway.app";
const DB_ID = 2;
const REFRESH_INTERVAL = 30000;

const QUERIES = {
  kpis: `SELECT COUNT(*) as total_orders, SUM(totalamount) as total_revenue, AVG(totalamount) as avg_order_value, COUNT(DISTINCT customerid) as unique_customers FROM orders WHERE createdat >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
  ordersByStatus: `SELECT status, COUNT(*) as count FROM orders WHERE createdat >= DATE_SUB(NOW(), INTERVAL 30 DAY) GROUP BY status ORDER BY count DESC LIMIT 10`,
  dailyRevenue: `SELECT DATE(createdat) as day, COUNT(*) as orders, SUM(totalamount) as revenue FROM orders WHERE createdat >= DATE_SUB(NOW(), INTERVAL 30 DAY) GROUP BY DATE(createdat) ORDER BY day ASC`,
  recentOrders: `SELECT o.id, o.createdat, o.totalamount, o.status, COALESCE(c.name, c.email, CONCAT('Customer #', o.customerid)) as customer_name FROM orders o LEFT JOIN customers c ON o.customerid = c.id ORDER BY o.createdat DESC LIMIT 8`,
  topProducts: `SELECT p.name as product_name, SUM(oli.quantity * oli.unitprice) as revenue FROM orderlineitems oli JOIN products p ON oli.productid = p.id WHERE oli.createdat >= DATE_SUB(NOW(), INTERVAL 30 DAY) GROUP BY p.id, p.name ORDER BY revenue DESC LIMIT 6`,
  trackingStatus: `SELECT status, COUNT(*) as count FROM ordertracking WHERE createdat >= DATE_SUB(NOW(), INTERVAL 30 DAY) GROUP BY status ORDER BY count DESC`,
};

async function runQuery(sql) {
  const res = await fetch(`${PROXY}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ database: DB_ID, native: { query: sql } }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const rows = data?.data?.rows || [];
  const cols = data?.data?.cols?.map((c) => c.name || c.display_name) || [];
  return rows.map((row) => Object.fromEntries(cols.map((c, i) => [c, row[i]])));
}

const fmt = {
  currency: (n) => { if (!n && n !== 0) return "—"; const num = parseFloat(n); if (num >= 1e6) return `₹${(num/1e6).toFixed(2)}M`; if (num >= 1000) return `₹${(num/1000).toFixed(1)}K`; return `₹${num.toFixed(2)}`; },
  number: (n) => (!n && n !== 0) ? "—" : parseFloat(n).toLocaleString("en-IN"),
  date: (d) => !d ? "—" : new Date(d).toLocaleDateString("en-IN", { day:"2-digit", month:"short" }),
  datetime: (d) => !d ? "—" : new Date(d).toLocaleString("en-IN", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" }),
};

const statusColor = (s) => { if (!s) return "#6b7280"; const sl = s.toLowerCase(); if (["delivered","complete","completed","success"].includes(sl)) return "#10b981"; if (["shipped","dispatched","in_transit","processing"].includes(sl)) return "#3b82f6"; if (["pending","placed","confirmed"].includes(sl)) return "#f59e0b"; if (["cancelled","canceled","failed","refunded"].includes(sl)) return "#ef4444"; return "#8b5cf6"; };

function Sparkline({ data, color = "#3b82f6" }) {
  if (!data || data.length < 2) return null;
  const vals = data.map((d) => parseFloat(d) || 0);
  const min = Math.min(...vals), max = Math.max(...vals), range = max - min || 1;
  const w = 110, h = 36;
  const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * w},${h - ((v - min) / range) * (h - 4) - 2}`);
  return (
    <svg width={w} height={h} style={{ overflow: "visible" }}>
      <defs><linearGradient id={`sg${color.replace("#","")}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.25"/><stop offset="100%" stopColor={color} stopOpacity="0"/></linearGradient></defs>
      <path d={`M${pts.join(" L")} L${w},${h} L0,${h} Z`} fill={`url(#sg${color.replace("#","")})`}/>
      <path d={`M${pts.join(" L")}`} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function BarChart({ data, xKey, yKey, color = "#3b82f6", height = 130 }) {
  if (!data?.length) return <div style={{height, display:"flex", alignItems:"center", justifyContent:"center", color:"#374151", fontSize:12}}>No data</div>;
  const vals = data.map((d) => parseFloat(d[yKey]) || 0);
  const max = Math.max(...vals, 1);
  return (
    <div style={{ display:"flex", alignItems:"flex-end", gap:2, height, width:"100%" }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", height:"100%" }}>
          <div style={{ flex:1, width:"100%", display:"flex", alignItems:"flex-end" }}>
            <div style={{ width:"100%", background:`${color}22`, borderRadius:"2px 2px 0 0", height:`${(vals[i]/max)*100}%`, minHeight: vals[i]>0?2:0, position:"relative" }}>
              <div style={{ position:"absolute", bottom:0, left:0, right:0, height:2, background:color, borderRadius:1 }}/>
            </div>
          </div>
          <span style={{ fontSize:8, color:"#4b5563", marginTop:2, writingMode:"vertical-rl", transform:"rotate(180deg)", maxHeight:28, overflow:"hidden" }}>{fmt.date(d[xKey])}</span>
        </div>
      ))}
    </div>
  );
}

function DonutChart({ data, labelKey, valueKey }) {
  if (!data?.length) return null;
  const COLORS = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#f97316"];
  const total = data.reduce((s, d) => s + (parseFloat(d[valueKey]) || 0), 0);
  let ca = -Math.PI / 2;
  const size = 120, r = 46, cx = 60, cy = 60, ir = r * 0.62;
  const slices = data.map((d, i) => {
    const val = parseFloat(d[valueKey]) || 0, angle = (val / total) * 2 * Math.PI;
    const x1 = cx + r*Math.cos(ca), y1 = cy + r*Math.sin(ca);
    ca += angle;
    const x2 = cx + r*Math.cos(ca), y2 = cy + r*Math.sin(ca);
    const ix1 = cx + ir*Math.cos(ca-angle), iy1 = cy + ir*Math.sin(ca-angle);
    const ix2 = cx + ir*Math.cos(ca), iy2 = cy + ir*Math.sin(ca);
    const large = angle > Math.PI ? 1 : 0;
    return { path:`M${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2} L${ix2},${iy2} A${ir},${ir} 0 ${large},0 ${ix1},${iy1} Z`, color:COLORS[i%COLORS.length], label:d[labelKey], pct:((val/total)*100).toFixed(1) };
  });
  return (
    <div style={{ display:"flex", gap:16, alignItems:"center" }}>
      <svg width={size} height={size}>{slices.map((s,i) => <path key={i} d={s.path} fill={s.color} opacity={0.85}/>)}</svg>
      <div style={{ display:"flex", flexDirection:"column", gap:5, flex:1 }}>
        {slices.slice(0,7).map((s,i) => (
          <div key={i} style={{ display:"flex", alignItems:"center", gap:6 }}>
            <div style={{ width:8, height:8, borderRadius:2, background:s.color, flexShrink:0 }}/>
            <span style={{ fontSize:11, color:"#9ca3af", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{s.label||"Unknown"}</span>
            <span style={{ fontSize:11, color:"#e5e7eb", fontFamily:"monospace" }}>{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function KPICard({ label, value, sub, sparkData, color="#3b82f6", loading }) {
  return (
    <div style={{ background:"#111827", border:"1px solid #1f2937", borderRadius:12, padding:"18px 22px", display:"flex", flexDirection:"column", gap:8, position:"relative", overflow:"hidden" }}>
      <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:`linear-gradient(90deg,transparent,${color}77,transparent)` }}/>
      <span style={{ fontSize:10, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.1em", fontFamily:"monospace" }}>{label}</span>
      {loading
        ? <div style={{ height:32, background:"#1f2937", borderRadius:6, animation:"pulse 1.5s infinite" }}/>
        : <span style={{ fontSize:26, fontWeight:700, color:"#f9fafb", lineHeight:1 }}>{value}</span>}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end" }}>
        <span style={{ fontSize:11, color:"#4b5563" }}>{sub}</span>
        {sparkData && <Sparkline data={sparkData} color={color}/>}
      </div>
    </div>
  );
}

function Card({ title, children, accent="#3b82f6", style={} }) {
  return (
    <div style={{ background:"#111827", border:"1px solid #1f2937", borderRadius:12, overflow:"hidden", ...style }}>
      <div style={{ padding:"12px 18px", borderBottom:"1px solid #1f2937", display:"flex", alignItems:"center", gap:8 }}>
        <div style={{ width:3, height:13, background:accent, borderRadius:2 }}/>
        <span style={{ fontSize:12, fontWeight:600, color:"#e5e7eb", letterSpacing:"0.02em" }}>{title}</span>
      </div>
      <div style={{ padding:"14px 18px" }}>{children}</div>
    </div>
  );
}

function Badge({ status }) {
  const c = statusColor(status);
  return <span style={{ fontSize:10, fontWeight:600, padding:"2px 7px", borderRadius:4, background:`${c}18`, color:c, border:`1px solid ${c}33`, textTransform:"uppercase", letterSpacing:"0.06em", fontFamily:"monospace", whiteSpace:"nowrap" }}>{status||"—"}</span>;
}

export default function Dashboard() {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [countdown, setCountdown] = useState(30);

  const fetchAll = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const results = await Promise.allSettled(Object.entries(QUERIES).map(([k, sql]) => runQuery(sql).then(r => [k, r])));
      const newData = {};
      results.forEach(r => { if (r.status === "fulfilled") { const [k, v] = r.value; newData[k] = v; } });
      setData(newData); setLastRefresh(new Date());
    } catch(e) { setError(e.message); }
    finally { setLoading(false); setCountdown(30); }
  }, []);

  useEffect(() => { fetchAll(); const iv = setInterval(fetchAll, REFRESH_INTERVAL); return () => clearInterval(iv); }, [fetchAll]);
  useEffect(() => { const iv = setInterval(() => setCountdown(c => c <= 1 ? 30 : c - 1), 1000); return () => clearInterval(iv); }, []);

  const kpis = data.kpis?.[0] || {};
  const revSpark = (data.dailyRevenue || []).map(d => d.revenue);
  const ordSpark = (data.dailyRevenue || []).map(d => d.orders);

  return (
    <div style={{ minHeight:"100vh", background:"#0a0f1a", fontFamily:"'DM Sans',system-ui,sans-serif", color:"#e5e7eb", fontSize:14 }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}} @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}} .fade{animation:fadeIn .4s ease forwards} tr.rh:hover td{background:#161f2e}`}</style>

      {/* Header */}
      <div style={{ borderBottom:"1px solid #1f2937", padding:"14px 28px", display:"flex", alignItems:"center", justifyContent:"space-between", background:"#0a0f1a", position:"sticky", top:0, zIndex:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:30, height:30, borderRadius:8, background:"linear-gradient(135deg,#3b82f6,#8b5cf6)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>◈</div>
          <div>
            <div style={{ fontSize:15, fontWeight:700, color:"#f9fafb" }}>Operations Dashboard</div>
            <div style={{ fontSize:10, color:"#4b5563", fontFamily:"monospace" }}>Production · 30-day window</div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          {error && <span style={{ fontSize:11, color:"#ef4444", background:"#ef444415", padding:"3px 9px", borderRadius:6 }}>⚠ {error}</span>}
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:loading?"#f59e0b":"#10b981", boxShadow:`0 0 7px ${loading?"#f59e0b":"#10b981"}` }}/>
            <span style={{ fontSize:10, color:"#6b7280", fontFamily:"monospace" }}>{loading ? "Syncing…" : `Refreshes in ${countdown}s`}</span>
          </div>
          <button onClick={fetchAll} style={{ background:"#1f2937", border:"1px solid #374151", color:"#9ca3af", borderRadius:7, padding:"5px 12px", fontSize:11, cursor:"pointer", fontFamily:"monospace" }}>↻ Refresh</button>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding:"20px 28px", maxWidth:1400, margin:"0 auto" }} className="fade">

        {/* KPIs */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:18 }}>
          <KPICard label="Total Revenue" loading={loading} value={fmt.currency(kpis.total_revenue)} sub="Last 30 days" sparkData={revSpark} color="#3b82f6"/>
          <KPICard label="Total Orders" loading={loading} value={fmt.number(kpis.total_orders)} sub="Last 30 days" sparkData={ordSpark} color="#10b981"/>
          <KPICard label="Avg Order Value" loading={loading} value={fmt.currency(kpis.avg_order_value)} sub="Per transaction" color="#f59e0b"/>
          <KPICard label="Unique Customers" loading={loading} value={fmt.number(kpis.unique_customers)} sub="Active buyers" color="#8b5cf6"/>
        </div>

        {/* Charts row */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:18 }}>
          <Card title="Daily Revenue — 30 Days" accent="#3b82f6">
            {loading ? <div style={{ height:150, background:"#1f2937", borderRadius:8, animation:"pulse 1.5s infinite" }}/> : <BarChart data={data.dailyRevenue||[]} xKey="day" yKey="revenue" color="#3b82f6" height={140}/>}
          </Card>
          <Card title="Orders by Status" accent="#10b981">
            {loading ? <div style={{ height:140, background:"#1f2937", borderRadius:8, animation:"pulse 1.5s infinite" }}/> : <DonutChart data={data.ordersByStatus||[]} labelKey="status" valueKey="count"/>}
          </Card>
        </div>

        {/* Bottom row */}
        <div style={{ display:"grid", gridTemplateColumns:"1.6fr 1fr", gap:14 }}>
          <Card title="Recent Orders" accent="#3b82f6">
            {loading ? (
              <div style={{ display:"flex", flexDirection:"column", gap:7 }}>{[...Array(6)].map((_,i) => <div key={i} style={{ height:28, background:"#1f2937", borderRadius:5, animation:"pulse 1.5s infinite", animationDelay:`${i*.1}s` }}/>)}</div>
            ) : (
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead>
                  <tr>{["Order ID","Date","Customer","Amount","Status"].map(h => <th key={h} style={{ textAlign:"left", fontSize:10, color:"#4b5563", fontWeight:500, paddingBottom:7, fontFamily:"monospace", textTransform:"uppercase", letterSpacing:"0.07em" }}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {(data.recentOrders||[]).map((o,i) => (
                    <tr key={i} className="rh" style={{ borderTop:"1px solid #1f2937" }}>
                      <td style={{ padding:"7px 0", fontSize:12, color:"#6366f1", fontFamily:"monospace" }}>#{o.id}</td>
                      <td style={{ padding:"7px 8px", fontSize:11, color:"#9ca3af", fontFamily:"monospace" }}>{fmt.datetime(o.createdat)}</td>
                      <td style={{ padding:"7px 8px", fontSize:12, color:"#d1d5db", maxWidth:130, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{o.customer_name||"—"}</td>
                      <td style={{ padding:"7px 8px", fontSize:12, color:"#f9fafb", fontFamily:"monospace", fontWeight:500 }}>{fmt.currency(o.totalamount)}</td>
                      <td style={{ padding:"7px 0" }}><Badge status={o.status}/></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <Card title="Top Products (30d)" accent="#f59e0b">
              {loading ? <div style={{ height:110, background:"#1f2937", borderRadius:8, animation:"pulse 1.5s infinite" }}/> : (
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {(data.topProducts||[]).slice(0,5).map((p,i) => {
                    const maxRev = Math.max(...(data.topProducts||[]).map(x => parseFloat(x.revenue)||0), 1);
                    const pct = ((parseFloat(p.revenue)||0)/maxRev)*100;
                    return (
                      <div key={i}>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                          <span style={{ fontSize:11, color:"#d1d5db", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1, marginRight:8 }}>{p.product_name||"—"}</span>
                          <span style={{ fontSize:11, color:"#f59e0b", fontFamily:"monospace", flexShrink:0 }}>{fmt.currency(p.revenue)}</span>
                        </div>
                        <div style={{ height:3, background:"#1f2937", borderRadius:2 }}>
                          <div style={{ height:"100%", width:`${pct}%`, background:"#f59e0b44", borderRadius:2, position:"relative" }}>
                            <div style={{ position:"absolute", right:0, top:0, bottom:0, width:2, background:"#f59e0b", borderRadius:1 }}/>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            <Card title="Tracking Status" accent="#06b6d4">
              {loading ? <div style={{ height:90, background:"#1f2937", borderRadius:8, animation:"pulse 1.5s infinite" }}/> : (
                <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
                  {(data.trackingStatus||[]).slice(0,6).map((t,i) => {
                    const total = (data.trackingStatus||[]).reduce((s,x) => s+(parseFloat(x.count)||0),0)||1;
                    const pct = ((parseFloat(t.count)||0)/total)*100, c = statusColor(t.status);
                    return (
                      <div key={i} style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <div style={{ width:3, height:18, borderRadius:2, background:c, flexShrink:0 }}/>
                        <span style={{ fontSize:11, color:"#9ca3af", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{t.status||"Unknown"}</span>
                        <span style={{ fontSize:11, color:c, fontFamily:"monospace", flexShrink:0 }}>{fmt.number(t.count)}</span>
                        <div style={{ width:44, height:3, background:"#1f2937", borderRadius:2 }}>
                          <div style={{ width:`${pct}%`, height:"100%", background:`${c}55`, borderRadius:2 }}/>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        </div>

        <div style={{ marginTop:16, display:"flex", justifyContent:"space-between" }}>
          <span style={{ fontSize:10, color:"#374151", fontFamily:"monospace" }}>Production DB · {lastRefresh ? `Updated ${lastRefresh.toLocaleTimeString("en-IN")}` : "Loading…"}</span>
          <span style={{ fontSize:10, color:"#374151", fontFamily:"monospace" }}>Auto-refresh 30s · metaconnect.railway.app</span>
        </div>
      </div>
    </div>
  );
}