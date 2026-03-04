import { useState, useEffect, useCallback, useRef } from "react";

const PROXY = "/api/v2";
const DB_ID  = 2;
const REFRESH_INTERVAL = 3600; // seconds

// ── Country codes ─────────────────────────────────────────────────────────────
const CC = { US:"United States",GB:"United Kingdom",AU:"Australia",CA:"Canada",DE:"Germany",FR:"France",IT:"Italy",CH:"Switzerland",JP:"Japan",ES:"Spain",NL:"Netherlands",NZ:"New Zealand",MX:"Mexico",AT:"Austria",SE:"Sweden",SG:"Singapore",AE:"UAE",HK:"Hong Kong",BE:"Belgium",DK:"Denmark",FI:"Finland",NO:"Norway",PT:"Portugal",IE:"Ireland",PL:"Poland",ZA:"South Africa",BR:"Brazil",IN:"India",CN:"China",KR:"South Korea",TH:"Thailand",MY:"Malaysia",PH:"Philippines" };
const countryName = c => CC[c] || c || "Unknown";

// ── Themes ────────────────────────────────────────────────────────────────────
const THEMES = {
  void: {
    label:"Void", swatch:"#0d1526", dark:true,
    bg:"#070b14", cardBg:"#0d1526", border:"#1a2540", headerBg:"#070b14",
    p:"#eef2ff", s:"#c7d2fe", t3:"#818cf8", mu:"#4f5d9a", di:"#2d3a6a", fa:"#1a2445",
    sk:"#1a2540", rh:"#111e36",
  },
  carbon: {
    label:"Carbon", swatch:"#18181b", dark:true,
    bg:"#09090b", cardBg:"#18181b", border:"#3f3f46", headerBg:"#09090b",
    p:"#fafafa", s:"#e4e4e7", t3:"#a1a1aa", mu:"#71717a", di:"#52525b", fa:"#3f3f46",
    sk:"#27272a", rh:"#1c1c1e",
  },
  cloud: {
    label:"Cloud", swatch:"#f8fafc", dark:false,
    bg:"#f1f5f9", cardBg:"#ffffff", border:"#e2e8f0", headerBg:"#ffffff",
    p:"#0f172a", s:"#1e293b", t3:"#475569", mu:"#64748b", di:"#94a3b8", fa:"#cbd5e1",
    sk:"#f1f5f9", rh:"#f8fafc",
  },
  dusk: {
    label:"Dusk", swatch:"#fffcf8", dark:false,
    bg:"#fef7ee", cardBg:"#fffcf8", border:"#f5d6a8", headerBg:"#fffcf8",
    p:"#1c1208", s:"#3d2b12", t3:"#6b4226", mu:"#9a6232", di:"#b07840", fa:"#e8c38a",
    sk:"#fde8c5", rh:"#fef4e6",
  },
};
const THEME_KEYS = Object.keys(THEMES);

// ── Date helpers ──────────────────────────────────────────────────────────────
const toDateStr = d => d.toISOString().slice(0, 10);
const defaultRange = () => {
  const end = new Date(), start = new Date();
  start.setDate(start.getDate() - 30);
  return { start: toDateStr(start), end: toDateStr(end) };
};
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAY_NAMES   = ["Su","Mo","Tu","We","Th","Fr","Sa"];

// ── Queries ───────────────────────────────────────────────────────────────────
const REV  = `CASE WHEN iscancelled=1 THEN 0 ELSE CASE WHEN final_charge_updated=0 THEN advanceamount ELSE totalamount END END`;
const ACTF = `all_status NOT IN ('SHIPMENT_CREATED','SHIPMENT_UNDER_CREATION')`;

function makeQueries(start, end) {
  const df  = `created_on>='${start}' AND created_on<DATE_ADD('${end}',INTERVAL 1 DAY)`;
  const odf = `o.created_on>='${start}' AND o.created_on<DATE_ADD('${end}',INTERVAL 1 DAY)`;
  return {
    kpis:          `SELECT COUNT(CASE WHEN iscancelled=0 THEN id END) as total_orders, SUM(${REV}) as total_revenue, ROUND(SUM(${REV})/NULLIF(COUNT(CASE WHEN iscancelled=0 THEN id END),0),2) as avg_order_value, COUNT(DISTINCT CASE WHEN iscancelled=0 THEN customerid END) as unique_customers FROM orders WHERE ${df} AND ${ACTF}`,
    ordersByStatus:`SELECT status,COUNT(*) as count FROM orders WHERE ${df} AND iscancelled=0 AND ${ACTF} GROUP BY status ORDER BY count DESC LIMIT 10`,
    dailyRevenue:  `SELECT DATE(created_on) as day,COUNT(CASE WHEN iscancelled=0 THEN id END) as orders,SUM(${REV}) as revenue FROM orders WHERE ${df} AND ${ACTF} GROUP BY DATE(created_on) ORDER BY day ASC`,
    topCountries:  `SELECT destination_country,COUNT(*) as count FROM orders WHERE ${df} AND iscancelled=0 AND ${ACTF} GROUP BY destination_country ORDER BY count DESC LIMIT 15`,
    topCustomers:  `SELECT COALESCE(c.contact_name,c.email,CONCAT('Customer #',o.customerid)) as customer_name,COUNT(CASE WHEN o.iscancelled=0 THEN o.id END) as orders,SUM(${REV}) as revenue FROM orders o LEFT JOIN customers c ON o.customerid=c.id WHERE ${odf} AND o.${ACTF} GROUP BY o.customerid,c.contact_name,c.email ORDER BY revenue DESC LIMIT 10`,
    trackingStatus:`SELECT ot.status,COUNT(*) as count FROM ordertracking ot INNER JOIN orders o ON ot.orderid=o.id WHERE ${odf} GROUP BY ot.status ORDER BY count DESC`,
  };
}

// ── API ───────────────────────────────────────────────────────────────────────
async function runQuery(sql) {
  const res = await fetch(`${PROXY}/query`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ database:DB_ID, sql }) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const rows = data?.data?.rows || [];
  const cols = data?.data?.cols?.map(c => c.name || c.display_name) || [];
  return rows.map(row => Object.fromEntries(cols.map((c,i) => [c, row[i]])));
}

// ── Formatters ────────────────────────────────────────────────────────────────
const fmt = {
  currency: n => { if (!n && n!==0) return "—"; const v=parseFloat(n); if(v>=1e7) return `₹${(v/1e7).toFixed(2)}Cr`; if(v>=1e5) return `₹${(v/1e5).toFixed(1)}L`; if(v>=1000) return `₹${(v/1000).toFixed(1)}K`; return `₹${v.toFixed(0)}`; },
  number:   n => (!n && n!==0) ? "—" : parseFloat(n).toLocaleString("en-IN"),
  date:     d => !d ? "—" : new Date(d).toLocaleDateString("en-IN",{day:"2-digit",month:"short"}),
  countdown:s => `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`,
};

const statusColor = s => {
  if (!s) return "#6b7280";
  const sl = s.toLowerCase();
  if (["delivered","complete","completed","success"].includes(sl)) return "#10b981";
  if (["shipped","dispatched","in_transit","processing"].includes(sl)) return "#3b82f6";
  if (["pending","placed","confirmed"].includes(sl)) return "#f59e0b";
  if (["cancelled","canceled","failed","refunded"].includes(sl)) return "#ef4444";
  return "#8b5cf6";
};

// ── DateRangePicker ───────────────────────────────────────────────────────────
function DateRangePicker({ value, onChange, t }) {
  const [open, setOpen]         = useState(false);
  const [phase, setPhase]       = useState(0);       // 0=idle 1=picking-end
  const [draft, setDraft]       = useState(value);
  const [hover, setHover]       = useState(null);
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date(value.start); d.setDate(1); return d;
  });
  const ref = useRef(null);

  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setPhase(0); setDraft(value); } }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [value]);

  function openPicker() { setDraft(value); setPhase(0); setHover(null); setOpen(true); }

  function clickDay(ds) {
    if (phase === 0) {
      setDraft({ start: ds, end: ds }); setPhase(1);
    } else {
      const [s, e] = ds < draft.start ? [ds, draft.start] : [draft.start, ds];
      onChange({ start: s, end: e });
      setOpen(false); setPhase(0);
    }
  }

  function prevMonth() { setViewDate(d => new Date(d.getFullYear(), d.getMonth()-1, 1)); }
  function nextMonth() { setViewDate(d => new Date(d.getFullYear(), d.getMonth()+1, 1)); }

  const months = [viewDate, new Date(viewDate.getFullYear(), viewDate.getMonth()+1, 1)];
  const todayStr = toDateStr(new Date());

  function renderMonth(base) {
    const y = base.getFullYear(), m = base.getMonth();
    const firstDow = new Date(y, m, 1).getDay();
    const days = new Date(y, m+1, 0).getDate();
    const cells = Array(firstDow).fill(null);
    for (let d=1; d<=days; d++) cells.push(new Date(y,m,d));

    return (
      <div key={`${y}-${m}`} style={{ width: 196 }}>
        <div style={{ textAlign:"center", fontSize:12, fontWeight:600, color:t.p, marginBottom:8 }}>
          {MONTH_NAMES[m]} {y}
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:1 }}>
          {DAY_NAMES.map(d => <div key={d} style={{ textAlign:"center", fontSize:9, color:t.mu, fontFamily:"monospace", padding:"2px 0" }}>{d}</div>)}
          {cells.map((date, i) => {
            if (!date) return <div key={`e${i}`} />;
            const ds = toDateStr(date);
            const isDisabled = ds > todayStr;
            const isStart = ds === draft.start;
            const isEnd   = ds === draft.end;
            const effectiveEnd = phase===1 && hover ? hover : draft.end;
            const [rs, re] = draft.start <= effectiveEnd ? [draft.start, effectiveEnd] : [effectiveEnd, draft.start];
            const inRange = ds > rs && ds < re;
            const isEdge  = ds === rs || ds === re;
            return (
              <div key={ds}
                onClick={() => !isDisabled && clickDay(ds)}
                onMouseEnter={() => phase===1 && setHover(ds)}
                style={{
                  textAlign:"center", fontSize:11, padding:"5px 0", borderRadius:4,
                  cursor: isDisabled ? "default" : "pointer",
                  background: isEdge ? "#3b82f6" : inRange ? "#3b82f622" : "transparent",
                  color: isEdge ? "#fff" : isDisabled ? t.fa : t.s,
                  fontFamily:"monospace",
                  opacity: isDisabled ? 0.35 : 1,
                  fontWeight: isEdge ? 700 : 400,
                }}>
                {date.getDate()}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const btnStyle = { background:t.cardBg, border:`1px solid ${t.border}`, color:t.p, borderRadius:7, padding:"5px 14px", fontSize:12, cursor:"pointer", fontFamily:"monospace", whiteSpace:"nowrap" };

  return (
    <div ref={ref} style={{ position:"relative" }}>
      <button onClick={openPicker} style={btnStyle}>
        📅 {value.start} → {value.end}
      </button>
      {open && (
        <div style={{ position:"absolute", top:"calc(100% + 8px)", left:0, zIndex:200, background:t.cardBg, border:`1px solid ${t.border}`, borderRadius:12, padding:16, boxShadow:"0 12px 40px #00000055", userSelect:"none" }}
          onMouseLeave={() => phase===1 && setHover(null)}>
          <div style={{ display:"flex", alignItems:"flex-start", gap:16 }}>
            <button onClick={prevMonth} style={{ ...btnStyle, padding:"4px 10px", alignSelf:"center" }}>‹</button>
            {months.map(renderMonth)}
            <button onClick={nextMonth} style={{ ...btnStyle, padding:"4px 10px", alignSelf:"center" }}>›</button>
          </div>
          {phase===1 && <div style={{ textAlign:"center", fontSize:11, color:t.mu, fontFamily:"monospace", marginTop:10 }}>Now click an end date</div>}
        </div>
      )}
    </div>
  );
}

// ── Sparkline ─────────────────────────────────────────────────────────────────
function Sparkline({ data, color="#3b82f6" }) {
  if (!data || data.length < 2) return null;
  const vals = data.map(d => parseFloat(d) || 0);
  const min = Math.min(...vals), max = Math.max(...vals), range = max - min || 1;
  const w = 110, h = 36;
  const pts = vals.map((v,i) => `${(i/(vals.length-1))*w},${h-((v-min)/range)*(h-4)-2}`);
  const gid = `sg${color.replace("#","")}`;
  return (
    <svg width={w} height={h} style={{ overflow:"visible" }}>
      <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.25"/><stop offset="100%" stopColor={color} stopOpacity="0"/></linearGradient></defs>
      <path d={`M${pts.join(" L")} L${w},${h} L0,${h} Z`} fill={`url(#${gid})`}/>
      <path d={`M${pts.join(" L")}`} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ── BarChart ──────────────────────────────────────────────────────────────────
function BarChart({ data, xKey, yKey, fmtTooltip, color="#3b82f6", height=130, t }) {
  const [tip, setTip] = useState(null); // { i, x, y }
  if (!data?.length) return <div style={{ height, display:"flex", alignItems:"center", justifyContent:"center", color:t.mu, fontSize:12 }}>No data</div>;
  const vals = data.map(d => parseFloat(d[yKey]) || 0);
  const max = Math.max(...vals, 1);
  return (
    <div style={{ position:"relative" }}>
      <div style={{ display:"flex", alignItems:"flex-end", gap:2, height, width:"100%" }}>
        {data.map((d,i) => (
          <div key={i}
            style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", height:"100%", cursor:"default" }}
            onMouseEnter={e => setTip({ i, rect: e.currentTarget.getBoundingClientRect() })}
            onMouseLeave={() => setTip(null)}>
            <div style={{ flex:1, width:"100%", display:"flex", alignItems:"flex-end" }}>
              <div style={{ width:"100%", background: tip?.i===i ? `${color}44` : `${color}22`, borderRadius:"2px 2px 0 0", height:`${(vals[i]/max)*100}%`, minHeight:vals[i]>0?2:0, position:"relative", transition:"background 0.1s" }}>
                <div style={{ position:"absolute", bottom:0, left:0, right:0, height:2, background:color, borderRadius:1 }}/>
              </div>
            </div>
            <span style={{ fontSize:8, color:t.di, marginTop:2, writingMode:"vertical-rl", transform:"rotate(180deg)", maxHeight:28, overflow:"hidden" }}>{fmt.date(d[xKey])}</span>
          </div>
        ))}
      </div>
      {tip !== null && (() => {
        const d = data[tip.i];
        return (
          <div style={{ position:"fixed", left: tip.rect.left + tip.rect.width/2, top: tip.rect.top - 8, transform:"translate(-50%,-100%)", zIndex:300, pointerEvents:"none",
            background: t.cardBg, border:`1px solid ${t.border}`, borderRadius:7, padding:"6px 10px", boxShadow:"0 4px 16px #00000044", whiteSpace:"nowrap" }}>
            <div style={{ fontSize:11, color:t.mu, fontFamily:"monospace", marginBottom:2 }}>{fmt.date(d[xKey])}</div>
            <div style={{ fontSize:13, fontWeight:700, color:t.p, fontFamily:"monospace" }}>{fmtTooltip ? fmtTooltip(d) : fmt.currency(vals[tip.i])}</div>
            {d.orders !== undefined && <div style={{ fontSize:10, color:t.t3, fontFamily:"monospace" }}>{fmt.number(d.orders)} shipments</div>}
          </div>
        );
      })()}
    </div>
  );
}

// ── HorizontalBar ─────────────────────────────────────────────────────────────
function HorizontalBar({ data, labelKey, valueKey, color="#3b82f6", fmtVal, maxItems=12, t }) {
  if (!data?.length) return <div style={{ color:t.mu, fontSize:12, padding:"12px 0" }}>No data</div>;
  const items = data.slice(0, maxItems);
  const max = Math.max(...items.map(d => parseFloat(d[valueKey]) || 0), 1);
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
      {items.map((d,i) => {
        const val = parseFloat(d[valueKey]) || 0;
        const pct = (val / max) * 100;
        return (
          <div key={i} style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:11, color:t.t3, width:16, textAlign:"right", fontFamily:"monospace", flexShrink:0 }}>{i+1}</span>
            <span style={{ fontSize:11, color:t.s, flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", minWidth:0 }}>{d[labelKey] || "—"}</span>
            <div style={{ width:100, height:4, background:t.sk, borderRadius:2, flexShrink:0 }}>
              <div style={{ width:`${pct}%`, height:"100%", background:`${color}bb`, borderRadius:2 }}/>
            </div>
            <span style={{ fontSize:11, color:t.p, fontFamily:"monospace", flexShrink:0, width:64, textAlign:"right" }}>{fmtVal ? fmtVal(val) : fmt.number(val)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── DonutChart ────────────────────────────────────────────────────────────────
function DonutChart({ data, labelKey, valueKey, t }) {
  if (!data?.length) return null;
  const COLORS = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#f97316"];
  const total = data.reduce((s,d) => s + (parseFloat(d[valueKey])||0), 0);
  let ca = -Math.PI/2;
  const sz=120, r=46, cx=60, cy=60, ir=r*0.62;
  const slices = data.map((d,i) => {
    const val = parseFloat(d[valueKey])||0, angle=(val/total)*2*Math.PI;
    const x1=cx+r*Math.cos(ca), y1=cy+r*Math.sin(ca); ca+=angle;
    const x2=cx+r*Math.cos(ca), y2=cy+r*Math.sin(ca);
    const ix1=cx+ir*Math.cos(ca-angle), iy1=cy+ir*Math.sin(ca-angle);
    const ix2=cx+ir*Math.cos(ca),       iy2=cy+ir*Math.sin(ca);
    const lg = angle>Math.PI?1:0;
    return { path:`M${x1},${y1} A${r},${r} 0 ${lg},1 ${x2},${y2} L${ix2},${iy2} A${ir},${ir} 0 ${lg},0 ${ix1},${iy1} Z`, color:COLORS[i%COLORS.length], label:d[labelKey], pct:((val/total)*100).toFixed(1) };
  });
  return (
    <div style={{ display:"flex", gap:16, alignItems:"center" }}>
      <svg width={sz} height={sz}>{slices.map((s,i) => <path key={i} d={s.path} fill={s.color} opacity={0.85}/>)}</svg>
      <div style={{ display:"flex", flexDirection:"column", gap:5, flex:1 }}>
        {slices.slice(0,7).map((s,i) => (
          <div key={i} style={{ display:"flex", alignItems:"center", gap:6 }}>
            <div style={{ width:8, height:8, borderRadius:2, background:s.color, flexShrink:0 }}/>
            <span style={{ fontSize:11, color:t.t3, flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{s.label||"Unknown"}</span>
            <span style={{ fontSize:11, color:t.s, fontFamily:"monospace" }}>{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── KPICard ───────────────────────────────────────────────────────────────────
function KPICard({ label, value, sub, sparkData, color="#3b82f6", loading, t }) {
  return (
    <div style={{ background:t.cardBg, border:`1px solid ${t.border}`, borderRadius:12, padding:"18px 22px", display:"flex", flexDirection:"column", gap:8, position:"relative", overflow:"hidden" }}>
      <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:`linear-gradient(90deg,transparent,${color}77,transparent)` }}/>
      <span style={{ fontSize:10, color:t.mu, textTransform:"uppercase", letterSpacing:"0.1em", fontFamily:"monospace" }}>{label}</span>
      {loading
        ? <div style={{ height:32, background:t.sk, borderRadius:6, animation:"pulse 1.5s infinite" }}/>
        : <span style={{ fontSize:26, fontWeight:700, color:t.p, lineHeight:1 }}>{value}</span>}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end" }}>
        <span style={{ fontSize:11, color:t.di }}>{sub}</span>
        {sparkData && <Sparkline data={sparkData} color={color}/>}
      </div>
    </div>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────
function Card({ title, children, accent="#3b82f6", style={}, t }) {
  return (
    <div style={{ background:t.cardBg, border:`1px solid ${t.border}`, borderRadius:12, overflow:"hidden", ...style }}>
      <div style={{ padding:"12px 18px", borderBottom:`1px solid ${t.border}`, display:"flex", alignItems:"center", gap:8 }}>
        <div style={{ width:3, height:13, background:accent, borderRadius:2 }}/>
        <span style={{ fontSize:12, fontWeight:600, color:t.s, letterSpacing:"0.02em" }}>{title}</span>
      </div>
      <div style={{ padding:"14px 18px" }}>{children}</div>
    </div>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────────
function Badge({ status }) {
  const c = statusColor(status);
  return <span style={{ fontSize:10, fontWeight:600, padding:"2px 7px", borderRadius:4, background:`${c}18`, color:c, border:`1px solid ${c}33`, textTransform:"uppercase", letterSpacing:"0.06em", fontFamily:"monospace", whiteSpace:"nowrap" }}>{status||"—"}</span>;
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [data,        setData]        = useState({});
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [countdown,   setCountdown]   = useState(REFRESH_INTERVAL);
  const [dateRange,   setDateRange]   = useState(defaultRange);
  const [themeKey,    setThemeKey]    = useState(() => THEME_KEYS.includes(localStorage.getItem("theme")) ? localStorage.getItem("theme") : "void");
  const t = THEMES[themeKey];

  const fetchAll = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const queries = makeQueries(dateRange.start, dateRange.end);
      const results = await Promise.allSettled(
        Object.entries(queries).map(([k,sql]) => runQuery(sql).then(r => [k,r]))
      );
      const d = {};
      results.forEach(r => { if (r.status==="fulfilled") { const [k,v]=r.value; d[k]=v; } });
      setData(d); setLastRefresh(new Date());
    } catch(e) { setError(e.message); }
    finally { setLoading(false); setCountdown(REFRESH_INTERVAL); }
  }, [dateRange]);

  useEffect(() => {
    fetchAll();
    const iv = setInterval(fetchAll, REFRESH_INTERVAL * 1000);
    return () => clearInterval(iv);
  }, [fetchAll]);

  useEffect(() => {
    const iv = setInterval(() => setCountdown(c => c<=1 ? REFRESH_INTERVAL : c-1), 1000);
    return () => clearInterval(iv);
  }, []);

  const kpis     = data.kpis?.[0] || {};
  const revSpark = (data.dailyRevenue||[]).map(d => d.revenue);
  const ordSpark = (data.dailyRevenue||[]).map(d => d.orders);

  const countriesData = (data.topCountries||[]).map(r => ({ ...r, label: countryName(r.destination_country) }));

  // ── Insights ────────────────────────────────────────────────────────────────
  const insights = (() => {
    if (loading || !data.kpis) return [];
    const rev  = data.dailyRevenue || [];
    const list = [];

    // Revenue trend: first half vs second half
    if (rev.length >= 4) {
      const mid  = Math.floor(rev.length / 2);
      const fh   = rev.slice(0, mid).reduce((s,d) => s + (parseFloat(d.revenue)||0), 0);
      const sh   = rev.slice(mid).reduce((s,d) => s + (parseFloat(d.revenue)||0), 0);
      const pct  = fh > 0 ? ((sh - fh) / fh * 100) : null;
      if (pct !== null) list.push({
        icon: pct >= 0 ? "▲" : "▼", positive: pct >= 0,
        label: "Revenue Trend",
        value: `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`,
        sub: `second half vs first half`,
        spark: revSpark, sparkColor: pct >= 0 ? "#10b981" : "#ef4444",
      });
    }

    // Peak revenue day
    if (rev.length) {
      const peak = rev.reduce((b,d) => (parseFloat(d.revenue)||0) > (parseFloat(b.revenue)||0) ? d : b, rev[0]);
      list.push({ icon: "◆", positive: true, label: "Peak Day", value: fmt.currency(peak.revenue), sub: fmt.date(peak.day), spark: revSpark, sparkColor: "#3b82f6" });
    }

    // Top destination
    const ctries = data.topCountries || [];
    if (ctries.length) {
      const total = ctries.reduce((s,c) => s + (parseFloat(c.count)||0), 0);
      const top   = ctries[0];
      const pct   = total > 0 ? ((parseFloat(top.count)/total)*100).toFixed(0) : 0;
      list.push({ icon: "◉", positive: true, label: "Top Market", value: countryName(top.destination_country), sub: `${pct}% of shipments`, spark: ordSpark, sparkColor: "#06b6d4" });
    }

    // Top customer revenue share
    const custs = data.topCustomers || [];
    if (custs.length && parseFloat(kpis.total_revenue) > 0) {
      const top  = custs[0];
      const pct  = ((parseFloat(top.revenue)||0) / parseFloat(kpis.total_revenue) * 100).toFixed(1);
      const name = top.customer_name?.split(" ").slice(0,2).join(" ") || "—";
      list.push({ icon: "★", positive: true, label: "Top Customer", value: name, sub: `${pct}% of revenue`, spark: revSpark, sparkColor: "#f59e0b" });
    }

    // Daily averages
    if (rev.length && kpis.total_orders) {
      const days    = rev.length;
      const avgShip = Math.round(parseFloat(kpis.total_orders) / days);
      const avgRev  = parseFloat(kpis.total_revenue) / days;
      list.push({ icon: "≈", positive: true, label: "Daily Average", value: `${fmt.number(avgShip)} ships`, sub: `${fmt.currency(avgRev)} revenue/day`, spark: ordSpark, sparkColor: "#8b5cf6" });
    }

    return list;
  })();

  return (
    <div style={{ minHeight:"100vh", background:t.bg, fontFamily:"'DM Sans',system-ui,sans-serif", color:t.s, fontSize:14 }}>
      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        .fade{animation:fadeIn .4s ease forwards}
        tr.rh:hover td{background:${t.rh} !important}
        *{box-sizing:border-box}

        .dash-header{display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:11px 24px;position:sticky;top:0;z-index:10;border-bottom:1px solid ${t.border};background:${t.headerBg}}
        .dash-content{padding:20px 28px;max-width:1400px;margin:0 auto}
        .grid-kpi{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:14px}
        .grid-insights{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:18px}
        .grid-2col{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:18px}
        .grid-countries{display:grid;grid-template-columns:1.5fr 1fr;gap:14px;margin-bottom:18px}
        .grid-customers{display:grid;grid-template-columns:1fr 1fr;gap:6px 32px}
        .header-right{display:flex;align-items:center;gap:10px}
        .header-datepicker{flex:1}

        @media(max-width:1100px){
          .grid-insights{grid-template-columns:repeat(3,1fr)}
        }
        @media(max-width:900px){
          .grid-kpi{grid-template-columns:repeat(2,1fr)}
          .grid-2col{grid-template-columns:1fr}
          .grid-countries{grid-template-columns:1fr}
          .grid-insights{grid-template-columns:repeat(2,1fr)}
        }
        @media(max-width:640px){
          .dash-header{flex-direction:column;align-items:stretch;gap:10px;padding:12px 16px}
          .dash-content{padding:14px 16px}
          .header-datepicker{width:100%}
          .header-right{justify-content:space-between}
          .grid-kpi{grid-template-columns:repeat(2,1fr);gap:10px}
          .grid-2col{gap:10px}
          .grid-countries{gap:10px}
          .grid-insights{grid-template-columns:repeat(2,1fr);gap:8px}
          .grid-customers{grid-template-columns:1fr}
        }
      `}</style>

      {/* ── Header ── */}
      <div className="dash-header">
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:30, height:30, borderRadius:8, background:"linear-gradient(135deg,#3b82f6,#8b5cf6)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>◈</div>
          <div>
            <div style={{ fontSize:15, fontWeight:700, color:t.p }}>Operations Dashboard</div>
            <div style={{ fontSize:10, color:t.di, fontFamily:"monospace" }}>Production</div>
          </div>
        </div>

        <div className="header-datepicker">
          <DateRangePicker value={dateRange} onChange={setDateRange} t={t}/>
        </div>

        <div className="header-right">
          <div style={{ display:"flex", alignItems:"center", gap:5 }}>
            {THEME_KEYS.map(key => (
              <button key={key} title={THEMES[key].label} onClick={() => { setThemeKey(key); localStorage.setItem("theme", key); }}
                style={{
                  width:20, height:20, borderRadius:"50%",
                  background: THEMES[key].swatch,
                  border: `2px solid ${themeKey===key ? "#3b82f6" : (THEMES[key].dark ? "#ffffff33" : "#00000033")}`,
                  boxShadow: themeKey===key ? "0 0 0 2px #3b82f655" : "none",
                  cursor:"pointer", padding:0, transition:"box-shadow 0.15s",
                  outline: THEMES[key].swatch==="#f8fafc" ? `1px solid ${t.border}` : "none",
                }}/>
            ))}
          </div>
          {error && <span style={{ fontSize:11, color:"#ef4444", background:"#ef444415", padding:"3px 9px", borderRadius:6 }}>⚠ {error}</span>}
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:loading?"#f59e0b":"#10b981", boxShadow:`0 0 7px ${loading?"#f59e0b":"#10b981"}` }}/>
            <span style={{ fontSize:10, color:t.mu, fontFamily:"monospace" }}>{loading ? "Syncing…" : `↻ ${fmt.countdown(countdown)}`}</span>
          </div>
          <button onClick={fetchAll}
            style={{ background:t.cardBg, border:`1px solid ${t.border}`, color:t.t3, borderRadius:7, padding:"5px 12px", fontSize:11, cursor:"pointer", fontFamily:"monospace" }}>
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="dash-content fade">

        {/* KPIs */}
        <div className="grid-kpi">
          <KPICard label="Total Revenue"    loading={loading} value={fmt.currency(kpis.total_revenue)}   sub={`${dateRange.start} → ${dateRange.end}`} sparkData={revSpark} color="#3b82f6" t={t}/>
          <KPICard label="Total Shipments"  loading={loading} value={fmt.number(kpis.total_orders)}      sub={`${dateRange.start} → ${dateRange.end}`} sparkData={ordSpark} color="#10b981" t={t}/>
          <KPICard label="Avg Shipment Value" loading={loading} value={fmt.currency(kpis.avg_order_value)} sub="Per shipment" color="#f59e0b" t={t}/>
          <KPICard label="Unique Customers" loading={loading} value={fmt.number(kpis.unique_customers)}  sub="Active shippers" color="#8b5cf6" t={t}/>
        </div>

        {/* Insights */}
        {insights.length > 0 && (
          <div className="grid-insights">
            {insights.map((ins, i) => (
              <div key={i} style={{ background:t.cardBg, border:`1px solid ${t.border}`, borderRadius:10, padding:"12px 16px", position:"relative", overflow:"hidden" }}>
                <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:`linear-gradient(90deg,transparent,${ins.sparkColor}77,transparent)` }}/>
                <div style={{ fontSize:10, color:t.mu, textTransform:"uppercase", letterSpacing:"0.08em", fontFamily:"monospace", marginBottom:4 }}>
                  <span style={{ color: ins.positive ? "#10b981" : "#ef4444", marginRight:5 }}>{ins.icon}</span>{ins.label}
                </div>
                <div style={{ fontSize:15, fontWeight:700, color: ins.positive ? t.p : "#ef4444", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", marginBottom:2 }}>{ins.value}</div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end" }}>
                  <span style={{ fontSize:11, color:t.di }}>{ins.sub}</span>
                  {ins.spark && <Sparkline data={ins.spark} color={ins.sparkColor}/>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Row 2: charts */}
        <div className="grid-2col">
          <Card title="Daily Revenue" accent="#3b82f6" t={t}>
            {loading
              ? <div style={{ height:150, background:t.sk, borderRadius:8, animation:"pulse 1.5s infinite" }}/>
              : <BarChart data={data.dailyRevenue||[]} xKey="day" yKey="revenue" color="#3b82f6" height={140} t={t}/>}
          </Card>
          <Card title="Shipments by Status" accent="#10b981" t={t}>
            {loading
              ? <div style={{ height:140, background:t.sk, borderRadius:8, animation:"pulse 1.5s infinite" }}/>
              : <DonutChart data={data.ordersByStatus||[]} labelKey="status" valueKey="count" t={t}/>}
          </Card>
        </div>

        {/* Row 3: countries + tracking */}
        <div className="grid-countries">
          <Card title="Shipments by Destination Country" accent="#06b6d4" t={t}>
            {loading
              ? <div style={{ height:200, background:t.sk, borderRadius:8, animation:"pulse 1.5s infinite" }}/>
              : <HorizontalBar data={countriesData} labelKey="label" valueKey="count" color="#06b6d4" maxItems={12} t={t}/>}
          </Card>
          <Card title="Tracking Status" accent="#8b5cf6" t={t}>
            {loading
              ? <div style={{ height:200, background:t.sk, borderRadius:8, animation:"pulse 1.5s infinite" }}/>
              : (
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {(data.trackingStatus||[]).slice(0,8).map((trk,i) => {
                    const total = (data.trackingStatus||[]).reduce((s,x)=>s+(parseFloat(x.count)||0),0)||1;
                    const pct = ((parseFloat(trk.count)||0)/total)*100, c=statusColor(trk.status);
                    return (
                      <div key={i} style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <div style={{ width:3, height:16, borderRadius:2, background:c, flexShrink:0 }}/>
                        <span style={{ fontSize:10, color:t.t3, flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", fontFamily:"monospace" }}>{trk.status||"Unknown"}</span>
                        <span style={{ fontSize:11, color:c, fontFamily:"monospace", flexShrink:0 }}>{fmt.number(trk.count)}</span>
                        <div style={{ width:36, height:3, background:t.sk, borderRadius:2 }}>
                          <div style={{ width:`${pct}%`, height:"100%", background:`${c}66`, borderRadius:2 }}/>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
          </Card>
        </div>

        {/* Row 4: top customers */}
        <Card title="Top Customers by Revenue" accent="#f59e0b" t={t}>
          {loading
            ? <div style={{ height:180, background:t.sk, borderRadius:8, animation:"pulse 1.5s infinite" }}/>
            : (
              <div className="grid-customers">
                {(data.topCustomers||[]).map((c,i) => {
                  const maxRev = Math.max(...(data.topCustomers||[]).map(x=>parseFloat(x.revenue)||0),1);
                  const pct = ((parseFloat(c.revenue)||0)/maxRev)*100;
                  return (
                    <div key={i} style={{ display:"flex", alignItems:"center", gap:10 }}>
                      <span style={{ fontSize:11, color:t.mu, fontFamily:"monospace", width:16, flexShrink:0, textAlign:"right" }}>{i+1}</span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                          <span style={{ fontSize:12, color:t.s, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1, marginRight:8 }}>{c.customer_name||"—"}</span>
                          <span style={{ fontSize:11, color:"#f59e0b", fontFamily:"monospace", flexShrink:0 }}>{fmt.currency(c.revenue)}</span>
                        </div>
                        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                          <div style={{ flex:1, height:3, background:t.sk, borderRadius:2 }}>
                            <div style={{ width:`${pct}%`, height:"100%", background:"#f59e0b88", borderRadius:2 }}/>
                          </div>
                          <span style={{ fontSize:10, color:t.mu, fontFamily:"monospace", flexShrink:0 }}>{fmt.number(c.orders)} ships</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
        </Card>

        <div style={{ marginTop:16, display:"flex", justifyContent:"space-between" }}>
          <span style={{ fontSize:10, color:t.fa, fontFamily:"monospace" }}>Production DB · {lastRefresh ? `Updated ${lastRefresh.toLocaleTimeString("en-IN")}` : "Loading…"}</span>
          <span style={{ fontSize:10, color:t.fa, fontFamily:"monospace" }}>Auto-refresh 1h · metaconnect.up.railway.app</span>
        </div>
      </div>
    </div>
  );
}
