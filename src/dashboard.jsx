import { useState, useEffect, useCallback, useRef } from "react";

const PROXY = "/api/v2";
const DB_ID  = 2;
const REFRESH_INTERVAL = 10800; // seconds

// ── Service codes ─────────────────────────────────────────────────────────────
const SC = { XL:"Lite", AN:"Commercial", AP:"Premium", AE:"XPress", IP:"ITPS",  IE:"EMS" };
const serviceName = s => SC[s] || s || "Unknown";


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
  forest: {
    label:"Forest", swatch:"#0a1e12", dark:true,
    bg:"#060e08", cardBg:"#0a1e12", border:"#163d22", headerBg:"#060e08",
    p:"#d1fae5", s:"#a7f3d0", t3:"#6ee7b7", mu:"#4ade80", di:"#166534", fa:"#14532d",
    sk:"#163d22", rh:"#0d2619",
  },
  ocean: {
    label:"Ocean", swatch:"#0a1929", dark:true,
    bg:"#050d1a", cardBg:"#0a1929", border:"#132f4c", headerBg:"#050d1a",
    p:"#e3f2fd", s:"#90caf9", t3:"#64b5f6", mu:"#42a5f5", di:"#1565c0", fa:"#0a3060",
    sk:"#132f4c", rh:"#0a1929",
  },
  midnight: {
    label:"Midnight", swatch:"#130527", dark:true,
    bg:"#0a0217", cardBg:"#130527", border:"#2d0a5e", headerBg:"#0a0217",
    p:"#f3e8ff", s:"#e9d5ff", t3:"#d8b4fe", mu:"#c084fc", di:"#6b21a8", fa:"#4a044e",
    sk:"#2d0a5e", rh:"#1e0a3a",
  },
  rose: {
    label:"Rose", swatch:"#fff0f2", dark:false,
    bg:"#fff0f2", cardBg:"#ffffff", border:"#fecdd3", headerBg:"#ffffff",
    p:"#1a0609", s:"#5b1a23", t3:"#9f2d3a", mu:"#b05a64", di:"#e9a0a9", fa:"#fecdd3",
    sk:"#ffe4e6", rh:"#fff0f2",
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

// ── IndiaPost status labels ────────────────────────────────────────────────────
const IP_STATUS = { SHIPMENT_CREATED:"Created", SHIPMENT_READY_FOR_PICKUP:"Ready for Pickup", SHIPMENT_PICKUP_REATTEMPT:"Pickup Reattempt", SHIPMENT_ACCEPTED_AT_PICKUP_LOCATION:"Accepted at Pickup", SHIPMENT_RECIEVED_AT_HUB:"Received at Hub", SHIPMENT_ACCEPTED_AT_HUB:"Accepted at Hub", SHIPMENT_CONNECTED_TO_HUB:"Connected to Hub", SHIPMENT_AT_ORIGIN_CUSTOMS:"At Origin Customs", SHIPMENT_ON_HOLD_AT_ORIGIN_CUSTOMS:"On Hold at Customs", SHIPMENT_INJECTED_TO_INDIA_POST:"Injected to IndiaPost", SHIPMENT_INTRANSIT:"In Transit", INTRANSIT_001:"In Transit", INTRANSIT_002:"In Transit 2", INTRANSIT_003:"In Transit 3", SHIPMENT_CONNECTED_TO_GATEWAY_COUNTRY:"At Gateway Country", SHIPMENT_ARRIVED_AT_DESTINATION_COUNTRY:"Arrived Destination", SHIPMENT_CLEARED_AT_DESTINATION_CUSTOMS:"Cleared Customs", SHIPMENT_ON_HOLD_AT_DESTINATION_CUSTOMS:"On Hold Dest Customs", SHIPMENT_INTRANSIT_TO_LAST_MILE:"In Transit to LM", SHIPMENT_RECIEVED_AT_LAST_MILE_HUB:"At LM Hub", SHIPMENT_OUT_FOR_DELIVERY:"Out for Delivery", SHIPMENT_DELIVERY_ATTEMPTED:"Delivery Attempted", SHIPMENT_READY_FOR_CUSTOMER_COLLECTION:"Ready for Collection", SHIPMENT_DELIVERED:"Delivered", SHIPMENT_CANCELLED:"Cancelled" };
const ipStatusLabel = s => IP_STATUS[s] || (s?.replace(/^SHIPMENT_/,"").replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase())) || "Unknown";

// ── Queries ───────────────────────────────────────────────────────────────────
const REV    = `CASE WHEN iscancelled=1 THEN 0 ELSE CASE WHEN final_charge_updated=0 THEN advanceamount ELSE totalamount END END`;
const WEIGHT = `CASE WHEN iscancelled=1 THEN 0 ELSE CASE WHEN final_charge_updated=0 THEN chargeableweight ELSE final_chargeable_weight END END`;
const ACTF   = `all_status NOT IN ('SHIPMENT_CREATED','SHIPMENT_UNDER_CREATION')`;

function makeQueries(start, end) {
  const df  = `created_on>='${start}' AND created_on<DATE_ADD('${end}',INTERVAL 1 DAY)`;
  const odf = `o.created_on>='${start}' AND o.created_on<DATE_ADD('${end}',INTERVAL 1 DAY)`;
  return {
    kpis:              `SELECT COUNT(CASE WHEN iscancelled=0 THEN id END) as total_orders, SUM(${REV}) as total_revenue, ROUND(SUM(${REV})/NULLIF(COUNT(CASE WHEN iscancelled=0 THEN id END),0),2) as avg_order_value, COUNT(DISTINCT CASE WHEN iscancelled=0 THEN customerid END) as unique_customers, COUNT(CASE WHEN iscancelled=1 THEN id END) as cancelled_orders FROM orders WHERE ${df} AND ${ACTF}`,
    ordersByStatus:    `SELECT status,COUNT(*) as count FROM orders WHERE ${df} AND iscancelled=0 AND ${ACTF} GROUP BY status ORDER BY count DESC LIMIT 10`,
    dailyRevenue:      `SELECT DATE(created_on) as day,COUNT(CASE WHEN iscancelled=0 THEN id END) as orders,SUM(${REV}) as revenue,SUM(${WEIGHT}) as daily_load FROM orders WHERE ${df} AND ${ACTF} GROUP BY DATE(created_on) ORDER BY day ASC`,
    topCountries:      `SELECT destination_country,SUM(${REV}) as revenue,COUNT(CASE WHEN iscancelled=0 THEN id END) as count FROM orders WHERE ${df} AND ${ACTF} GROUP BY destination_country ORDER BY revenue DESC LIMIT 12`,
    topCustomers:      `SELECT o.customerid,COALESCE(c.company,c.email,CONCAT('Customer #',o.customerid)) as customer_name,COUNT(CASE WHEN o.iscancelled=0 THEN o.id END) as orders,SUM(${REV}) as revenue FROM orders o LEFT JOIN customers c ON o.customerid=c.id WHERE ${odf} AND o.${ACTF} GROUP BY o.customerid,c.company,c.email ORDER BY revenue DESC LIMIT 10`,
    trackingStatus:    `SELECT ot.status,COUNT(*) as count FROM ordertracking ot INNER JOIN orders o ON ot.orderid=o.id WHERE ${odf} GROUP BY ot.status ORDER BY count DESC`,
    shipmentsByService:`SELECT shippingmethod as service,COUNT(CASE WHEN iscancelled=0 THEN id END) as count,SUM(${REV}) as revenue FROM orders WHERE ${df} AND ${ACTF} AND shippingmethod IS NOT NULL AND shippingmethod!='' GROUP BY shippingmethod ORDER BY revenue DESC`,
    carrierPerformance:`SELECT lmcarrier,lmshippingmethod,COUNT(*) as total,SUM(CASE WHEN status='SHIPMENT_DELIVERED' THEN 1 ELSE 0 END) as delivered,ROUND(SUM(CASE WHEN status='SHIPMENT_DELIVERED' THEN 1 ELSE 0 END)*100.0/NULLIF(COUNT(*),0),1) as delivery_rate,ROUND(AVG(CASE WHEN delivereddate IS NOT NULL AND readyforpickupdate IS NOT NULL THEN DATEDIFF(delivereddate,readyforpickupdate) END),1) as avg_tat FROM orders WHERE ${df} AND iscancelled=0 AND ${ACTF} AND lmcarrier IS NOT NULL AND lmcarrier!='' GROUP BY lmcarrier,lmshippingmethod ORDER BY total DESC LIMIT 15`,
    commercialCustomers:`SELECT o.customerid,COALESCE(c.company,c.email,CONCAT('Customer #',o.customerid)) as customer_name, COUNT(o.id) as order_count, SUM(CASE WHEN o.final_charge_updated=0 THEN o.advanceamount ELSE o.totalamount END) as revenue FROM orders o LEFT JOIN customers c ON o.customerid=c.id WHERE ${odf} AND o.iscancelled=0 AND o.all_status NOT IN ('SHIPMENT_CREATED','SHIPMENT_UNDER_CREATION') AND o.lmcarrier NOT LIKE '%indiapost%' AND o.paymentstatus='completed' AND o.shippingmethod NOT IN ('AN','IP','IE') GROUP BY o.customerid,c.company,c.email ORDER BY revenue DESC LIMIT 15`,
    tatDistribution:   `SELECT CASE WHEN DATEDIFF(delivereddate,readyforpickupdate)<=7 THEN '1–7d' WHEN DATEDIFF(delivereddate,readyforpickupdate)<=14 THEN '8–14d' WHEN DATEDIFF(delivereddate,readyforpickupdate)<=21 THEN '15–21d' WHEN DATEDIFF(delivereddate,readyforpickupdate)<=28 THEN '22–28d' ELSE '29+d' END as bucket, CASE WHEN DATEDIFF(delivereddate,readyforpickupdate)<=7 THEN 1 WHEN DATEDIFF(delivereddate,readyforpickupdate)<=14 THEN 2 WHEN DATEDIFF(delivereddate,readyforpickupdate)<=21 THEN 3 WHEN DATEDIFF(delivereddate,readyforpickupdate)<=28 THEN 4 ELSE 5 END as sort_order, COUNT(*) as shipments FROM orders WHERE ${df} AND iscancelled=0 AND ${ACTF} AND status='SHIPMENT_DELIVERED' AND delivereddate IS NOT NULL AND readyforpickupdate IS NOT NULL GROUP BY bucket,sort_order ORDER BY sort_order`,
    ipKpis:            `SELECT COUNT(*) as total, SUM(CASE WHEN iscancelled=0 THEN 1 ELSE 0 END) as active, SUM(CASE WHEN status='SHIPMENT_DELIVERED' AND iscancelled=0 THEN 1 ELSE 0 END) as delivered, SUM(CASE WHEN iscancelled=1 THEN 1 ELSE 0 END) as cancelled, SUM(${REV}) as revenue FROM orders WHERE (scancode LIKE 'LP%' OR scancode LIKE 'EY%') AND ${df}`,
    ipStatusFlow:      `SELECT status, COUNT(*) as count FROM orders WHERE (scancode LIKE 'LP%' OR scancode LIKE 'EY%') AND ${df} AND iscancelled=0 GROUP BY status ORDER BY count DESC LIMIT 15`,
    ipDailyTrend:      `SELECT DATE(created_on) as day, COUNT(*) as shipments, SUM(${REV}) as revenue FROM orders WHERE (scancode LIKE 'LP%' OR scancode LIKE 'EY%') AND ${df} GROUP BY DATE(created_on) ORDER BY day ASC`,
    ipMailType:        `SELECT i.mail_type_cd, COUNT(*) as count FROM indiapost_shipments i INNER JOIN orders o ON i.shipment_id=o.id WHERE ${odf} AND o.iscancelled=0 GROUP BY i.mail_type_cd ORDER BY count DESC`,
    ipPendingCustoms:  `SELECT COUNT(*) as count FROM indiapost_shipments i INNER JOIN orders o ON i.shipment_id=o.id WHERE i.customs_query_response IS NOT NULL AND JSON_LENGTH(i.customs_query_response)>0 AND (i.query_submission_response IS NULL OR JSON_LENGTH(i.query_submission_response)=0) AND o.iscancelled=0`,
    ipOnHold:          `SELECT o.scancode, o.destination_country, DATE(o.created_on) as created, o.status FROM orders o WHERE (o.scancode LIKE 'LP%' OR o.scancode LIKE 'EY%') AND o.iscancelled=0 AND o.status IN ('SHIPMENT_ON_HOLD_AT_ORIGIN_CUSTOMS','SHIPMENT_ON_HOLD_AT_DESTINATION_CUSTOMS') ORDER BY o.created_on DESC LIMIT 100`,
    ipCountries:       `SELECT destination_country, COUNT(*) as count, SUM(${REV}) as revenue FROM orders WHERE (scancode LIKE 'LP%' OR scancode LIKE 'EY%') AND ${df} AND iscancelled=0 GROUP BY destination_country ORDER BY count DESC LIMIT 15`,
    ipCustomers:       `SELECT o.customerid,COALESCE(c.company,c.email,CONCAT('Customer #',o.customerid)) as customer_name, COUNT(*) as count, SUM(${REV}) as revenue FROM orders o LEFT JOIN customers c ON o.customerid=c.id WHERE (o.scancode LIKE 'LP%' OR o.scancode LIKE 'EY%') AND ${odf} AND o.iscancelled=0 GROUP BY o.customerid,c.company,c.email ORDER BY revenue DESC LIMIT 10`,
    ipTatDistribution: `SELECT CASE WHEN DATEDIFF(delivereddate,readyforpickupdate)<=7 THEN '1–7d' WHEN DATEDIFF(delivereddate,readyforpickupdate)<=14 THEN '8–14d' WHEN DATEDIFF(delivereddate,readyforpickupdate)<=21 THEN '15–21d' WHEN DATEDIFF(delivereddate,readyforpickupdate)<=28 THEN '22–28d' ELSE '29+d' END as bucket, CASE WHEN DATEDIFF(delivereddate,readyforpickupdate)<=7 THEN 1 WHEN DATEDIFF(delivereddate,readyforpickupdate)<=14 THEN 2 WHEN DATEDIFF(delivereddate,readyforpickupdate)<=21 THEN 3 WHEN DATEDIFF(delivereddate,readyforpickupdate)<=28 THEN 4 ELSE 5 END as sort_order, COUNT(*) as shipments FROM orders WHERE (scancode LIKE 'LP%' OR scancode LIKE 'EY%') AND ${df} AND iscancelled=0 AND status='SHIPMENT_DELIVERED' AND delivereddate IS NOT NULL AND readyforpickupdate IS NOT NULL GROUP BY bucket,sort_order ORDER BY sort_order`,
    networkRevenue:   `SELECT pointofentry as network, shippingmethod as service, COUNT(CASE WHEN iscancelled=0 THEN id END) as shipments, SUM(${REV}) as revenue FROM orders WHERE ${df} AND ${ACTF} AND iscancelled=0 AND pointofentry IS NOT NULL AND pointofentry!='' GROUP BY pointofentry,shippingmethod ORDER BY SUM(${REV}) DESC LIMIT 60`,
    clearanceRevenue: `SELECT TRIM(destination_clearance) as clearance, SUM(${REV}) as revenue, COUNT(CASE WHEN iscancelled=0 THEN id END) as shipments FROM orders WHERE ${df} AND ${ACTF} AND destination_clearance IS NOT NULL AND destination_clearance!='' GROUP BY TRIM(destination_clearance) ORDER BY revenue DESC`,
    weekOnWeek:       `SELECT YEARWEEK(created_on,1) as week_num, DATE_FORMAT(MIN(created_on),'%d %b') as week_start, COUNT(CASE WHEN iscancelled=0 THEN id END) as shipments, SUM(${REV}) as revenue FROM orders WHERE created_on>=DATE_SUB(CURDATE(),INTERVAL 13 WEEK) AND ${ACTF} GROUP BY YEARWEEK(created_on,1) ORDER BY week_num ASC`,
    kamRevenue:       `SELECT COALESCE(JSON_UNQUOTE(JSON_EXTRACT(c.kam_info,'$.name')),'Unassigned') as kam, COUNT(CASE WHEN o.iscancelled=0 THEN o.id END) as shipments, SUM(${REV}) as revenue FROM orders o LEFT JOIN customers c ON o.customerid=c.id WHERE ${odf} AND o.${ACTF} GROUP BY JSON_UNQUOTE(JSON_EXTRACT(c.kam_info,'$.name')) ORDER BY revenue DESC LIMIT 20`,
    customerTiers:    `SELECT CASE WHEN decile=1 THEN 'Top 10%' WHEN decile<=5 THEN 'Middle 40%' ELSE 'Last 50%' END as tier, COUNT(*) as customers, SUM(revenue) as total_revenue, SUM(shipments) as total_shipments FROM (SELECT customerid, SUM(${REV}) as revenue, COUNT(CASE WHEN iscancelled=0 THEN id END) as shipments, NTILE(10) OVER (ORDER BY SUM(${REV}) DESC) as decile FROM orders WHERE ${df} AND ${ACTF} GROUP BY customerid) t GROUP BY tier ORDER BY total_revenue DESC`,
    customerTierDetail:`SELECT o.customerid, COALESCE(c.company,c.email,CONCAT('Customer #',o.customerid)) as customer_name, SUM(${REV}) as revenue, COUNT(CASE WHEN o.iscancelled=0 THEN o.id END) as shipments, NTILE(10) OVER (ORDER BY SUM(${REV}) DESC) as decile FROM orders o LEFT JOIN customers c ON o.customerid=c.id WHERE ${odf} AND o.${ACTF} GROUP BY o.customerid,c.company,c.email ORDER BY decile ASC, revenue DESC`,
    pickupNodePerf:   `SELECT c.service_node, COALESCE(fm.fm_partner,'No FM') as fm_carrier, COUNT(o.id) as shipments, SUM(${REV}) as revenue FROM orders o LEFT JOIN customers c ON o.customerid=c.id LEFT JOIN fm_manifest fm ON o.fm_manifest_scancode=fm.scancode WHERE ${odf} AND o.iscancelled=0 AND o.${ACTF} AND c.service_node IS NOT NULL AND c.service_node!='' GROUP BY c.service_node,fm.fm_partner ORDER BY revenue DESC LIMIT 30`,
    livePickups:      `SELECT o.scancode, o.customerid, COALESCE(c.company,c.email,CONCAT('Customer #',o.customerid)) as customer_name, o.destination_country, o.shippingmethod, o.lmcarrier, DATE(o.created_on) as created_date, DATEDIFF(NOW(),o.created_on) as age_days, c.service_node FROM orders o LEFT JOIN customers c ON o.customerid=c.id WHERE o.all_status='OUT_FOR_PICKUP' AND o.iscancelled=0 AND (c.service_node IS NULL OR c.service_node NOT LIKE 'PPN%') ORDER BY c.service_node ASC, o.created_on ASC LIMIT 200`,
    newCustomers:     `SELECT o.customerid, COALESCE(c.company,c.email,CONCAT('Customer #',o.customerid)) as customer_name, DATE(MIN(o.created_on)) as first_order_ever, COUNT(o.id) as total_orders, c.service_node FROM orders o LEFT JOIN customers c ON o.customerid=c.id WHERE o.iscancelled=0 GROUP BY o.customerid,c.company,c.email,c.service_node HAVING DATE(MIN(o.created_on))>='${start}' AND DATE(MIN(o.created_on))<='${end}' ORDER BY first_order_ever DESC LIMIT 50`,
    reactivatedCustomers: `SELECT customerid,customer_name,DATE(first_in_range) as first_in_range,DATE(last_before_range) as last_before_range,DATEDIFF(first_in_range,last_before_range) as gap_days,orders_in_range,service_node FROM (SELECT o.customerid,COALESCE(c.company,c.email,CONCAT('Customer #',o.customerid)) as customer_name,MIN(CASE WHEN o.created_on>='${start}' AND o.created_on<DATE_ADD('${end}',INTERVAL 1 DAY) THEN o.created_on END) as first_in_range,MAX(CASE WHEN o.created_on<'${start}' THEN o.created_on END) as last_before_range,COUNT(DISTINCT CASE WHEN o.created_on>='${start}' THEN o.id END) as orders_in_range,c.service_node FROM orders o LEFT JOIN customers c ON o.customerid=c.id WHERE o.iscancelled=0 AND o.all_status NOT IN ('SHIPMENT_CREATED','SHIPMENT_UNDER_CREATION') AND o.created_on>=DATE_SUB('${start}',INTERVAL 180 DAY) AND o.created_on<DATE_ADD('${end}',INTERVAL 1 DAY) GROUP BY o.customerid,c.company,c.email,c.service_node) t WHERE first_in_range IS NOT NULL AND last_before_range IS NOT NULL AND DATEDIFF(first_in_range,last_before_range)>=15 ORDER BY gap_days DESC LIMIT 50`,
    exceptionShipments:   `SELECT o.scancode, o.customerid, COALESCE(c.company,c.email,CONCAT('Customer #',o.customerid)) as customer_name, o.destination_country, o.shippingmethod, o.lmcarrier, o.status, DATE(o.created_on) as created_date FROM orders o LEFT JOIN customers c ON o.customerid=c.id WHERE ${odf} AND o.iscancelled=0 AND o.all_status NOT IN ('SHIPMENT_CREATED','SHIPMENT_UNDER_CREATION') AND (o.status LIKE '%HOLD%' OR o.status LIKE '%EXCEPTION%' OR o.status LIKE '%FAILED%' OR o.status LIKE '%RETURN%' OR o.status LIKE '%REJECT%' OR o.status LIKE '%DAMAGE%') ORDER BY o.status, o.created_on DESC LIMIT 300`,
    staleShipments:       `SELECT o.scancode, o.customerid, COALESCE(c.company,c.email,CONCAT('Customer #',o.customerid)) as customer_name, o.destination_country, o.shippingmethod, o.lmcarrier, o.status, DATE(MAX(ot.created_on)) as last_update, DATEDIFF(NOW(),MAX(ot.created_on)) as days_stale FROM orders o INNER JOIN ordertracking ot ON ot.orderid=o.id LEFT JOIN customers c ON o.customerid=c.id WHERE ${odf} AND o.iscancelled=0 AND o.status NOT LIKE '%DELIVERED%' AND o.status NOT LIKE '%CANCELLED%' AND o.all_status NOT IN ('SHIPMENT_CREATED','SHIPMENT_UNDER_CREATION') GROUP BY o.id,o.scancode,c.company,c.email,o.customerid,o.destination_country,o.shippingmethod,o.lmcarrier,o.status HAVING DATEDIFF(NOW(),MAX(ot.created_on))>=3 ORDER BY days_stale DESC LIMIT 200`,
    staleBoxes:           `SELECT o.scancode, oli.id as box_id, DATE(MAX(olit.created_on)) as last_update, DATEDIFF(NOW(),MAX(olit.created_on)) as days_stale, MAX(olit.status) as box_status FROM orderlineitems oli INNER JOIN orderlineitemtracking olit ON olit.orderlineitemid=oli.id INNER JOIN orders o ON oli.orderid=o.id WHERE ${odf} AND o.iscancelled=0 AND o.status NOT LIKE '%DELIVERED%' AND o.status NOT LIKE '%CANCELLED%' GROUP BY oli.id,o.scancode HAVING DATEDIFF(NOW(),MAX(olit.created_on))>=3 ORDER BY days_stale DESC LIMIT 200`,
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
  countdown:s => `${String(Math.floor(s/3600)).padStart(2,"0")}:${String(Math.floor((s%3600)/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`,
};

const ShipLink = ({ scancode, style }) => !scancode ? <span>—</span> : (
  <a href={`https://one.xindus.net/erp/ops-shipment-edit.html?awb=${scancode}`} target="_blank" rel="noopener noreferrer"
    style={{ color:"#3b82f6", fontFamily:"monospace", textDecoration:"none", fontWeight:600, ...style }}>
    {scancode} <span style={{ fontSize:9, opacity:0.7 }}>↗</span>
  </a>
);

const CustLink = ({ id, name, style }) => !id || !name ? <span style={style}>{name||"—"}</span> : (
  <a href={`https://one.xindus.net/erp/ops-customer-edit.html?userId=${id}`} target="_blank" rel="noopener noreferrer"
    style={{ color:"inherit", textDecoration:"none", borderBottom:"1px dotted currentColor", ...style }}>
    {name}
  </a>
);

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
function BarChart({ data, xKey, yKey, fmtTooltip, fmtSecondary, fmtTertiary, color="#3b82f6", height=130, trendColor="#f59e0b", showTrend=false, t }) {
  const [tip, setTip] = useState(null);
  const containerRef = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(e => setWidth(e[0].contentRect.width));
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  if (!data?.length) return <div style={{ height, display:"flex", alignItems:"center", justifyContent:"center", color:t.mu, fontSize:12 }}>No data</div>;
  const vals = data.map(d => parseFloat(d[yKey]) || 0);
  const max = Math.max(...vals, 1);
  const barAreaH = height - 30; // leave room for date labels

  // linear regression trend line
  const trendLine = (() => {
    if (!showTrend || !width || vals.length < 2) return null;
    const n = vals.length;
    const xs = vals.map((_,i) => i), ys = vals;
    const sx = xs.reduce((a,b)=>a+b,0), sy = ys.reduce((a,b)=>a+b,0);
    const sxy = xs.reduce((a,i)=>a+i*ys[i],0), sxx = xs.reduce((a,x)=>a+x*x,0);
    const m = (n*sxy - sx*sy) / (n*sxx - sx*sx);
    const b = (sy - m*sx) / n;
    const barW = width / n;
    const toX = i => i * barW + barW / 2;
    const toY = v => barAreaH - (v / max) * barAreaH;
    return { x1: toX(0), y1: toY(b), x2: toX(n-1), y2: toY(m*(n-1)+b) };
  })();

  return (
    <div style={{ position:"relative" }} ref={containerRef}>
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
      {trendLine && (
        <svg style={{ position:"absolute", top:0, left:0, width:"100%", height:barAreaH, pointerEvents:"none", overflow:"visible" }}>
          <line x1={trendLine.x1} y1={trendLine.y1} x2={trendLine.x2} y2={trendLine.y2}
            stroke={trendColor} strokeWidth="1.5" strokeDasharray="4 3" opacity="0.8"/>
          <circle cx={trendLine.x2} cy={trendLine.y2} r="3" fill={trendColor} opacity="0.9"/>
        </svg>
      )}
      {tip !== null && (() => {
        const d = data[tip.i];
        return (
          <div style={{ position:"fixed", left: tip.rect.left + tip.rect.width/2, top: tip.rect.top - 8, transform:"translate(-50%,-100%)", zIndex:300, pointerEvents:"none",
            background: t.cardBg, border:`1px solid ${t.border}`, borderRadius:7, padding:"6px 10px", boxShadow:"0 4px 16px #00000044", whiteSpace:"nowrap" }}>
            <div style={{ fontSize:11, color:t.mu, fontFamily:"monospace", marginBottom:2 }}>{fmt.date(d[xKey])}</div>
            <div style={{ fontSize:13, fontWeight:700, color:t.p, fontFamily:"monospace" }}>{fmtTooltip ? fmtTooltip(d) : fmt.currency(vals[tip.i])}</div>
            {fmtSecondary
              ? <div style={{ fontSize:10, color:t.t3, fontFamily:"monospace" }}>{fmtSecondary(d)}</div>
              : d.orders !== undefined && <div style={{ fontSize:10, color:t.t3, fontFamily:"monospace" }}>{fmt.number(d.orders)} shipments</div>}
            {fmtTertiary && <div style={{ fontSize:10, color:t.mu, fontFamily:"monospace" }}>{fmtTertiary(d)}</div>}
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
function DonutChart({ data, labelKey, valueKey, fmtVal, t }) {
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
    return { path:`M${x1},${y1} A${r},${r} 0 ${lg},1 ${x2},${y2} L${ix2},${iy2} A${ir},${ir} 0 ${lg},0 ${ix1},${iy1} Z`, color:COLORS[i%COLORS.length], label:d[labelKey], val, pct:((val/total)*100).toFixed(1) };
  });
  const displayVal = s => fmtVal ? fmtVal(s.val) : fmt.number(s.val);
  return (
    <div style={{ display:"flex", gap:16, alignItems:"center" }}>
      <svg width={sz} height={sz}>{slices.map((s,i) => <path key={i} d={s.path} fill={s.color} opacity={0.85}/>)}</svg>
      <div style={{ display:"flex", flexDirection:"column", gap:5, flex:1 }}>
        {slices.slice(0,7).map((s,i) => (
          <div key={i} style={{ display:"flex", alignItems:"center", gap:6 }}>
            <div style={{ width:8, height:8, borderRadius:2, background:s.color, flexShrink:0 }}/>
            <span style={{ fontSize:11, color:t.t3, flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{s.label||"Unknown"}</span>
            <span style={{ fontSize:10, color:t.mu, fontFamily:"monospace" }}>{s.pct}%</span>
            <span style={{ fontSize:11, color:t.s, fontFamily:"monospace" }}>{displayVal(s)}</span>
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

// ── OnHoldList ────────────────────────────────────────────────────────────────
function OnHoldList({ rows, pendingCustoms, loading, t }) {
  const [page, setPage] = useState(0);
  const PAGE = 10;
  const pages = Math.ceil(rows.length / PAGE);
  const pageRows = rows.slice(page * PAGE, page * PAGE + PAGE);
  return (
    <Card title={`Customs Hold & Query Status${rows.length ? ` · ${rows.length} on hold` : ""}`} accent="#ef4444" t={t} style={{ marginBottom:14 }}>
      {loading
        ? <div style={{ height:120, background:t.sk, borderRadius:8, animation:"pulse 1.5s infinite" }}/>
        : (
          <>
            {pendingCustoms > 0 && (
              <div style={{ background:"#ef444415", border:"1px solid #ef444440", borderRadius:8, padding:"10px 14px", marginBottom:14, display:"flex", alignItems:"center", gap:10 }}>
                <span style={{ fontSize:20, flexShrink:0 }}>⚠</span>
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:"#ef4444" }}>{pendingCustoms} shipment{pendingCustoms!==1?"s":""} — customs query response pending submission</div>
                  <div style={{ fontSize:11, color:t.mu, marginTop:1 }}>Customs query received but query submission response not yet sent. Action required.</div>
                </div>
              </div>
            )}
            {rows.length === 0
              ? <div style={{ color:t.mu, fontSize:12 }}>No shipments currently on hold at customs</div>
              : (
            <>
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                  <thead>
                    <tr>{["AWB","Destination","Created","Status"].map(h => (
                      <th key={h} style={{ textAlign:"left", color:t.mu, fontWeight:500, padding:"4px 8px", fontFamily:"monospace", fontSize:10, borderBottom:`1px solid ${t.border}`, whiteSpace:"nowrap" }}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {pageRows.map((r,i) => (
                      <tr key={i} style={{ borderBottom:`1px solid ${t.border}40` }}>
                        <td style={{ padding:"7px 8px" }}>
                          <a href={`https://one.xindus.net/erp/ops-shipment-edit.html?awb=${r.scancode}`} target="_blank" rel="noopener noreferrer"
                            style={{ color:"#3b82f6", fontFamily:"monospace", fontSize:11, textDecoration:"none", fontWeight:600 }}>
                            {r.scancode} ↗
                          </a>
                        </td>
                        <td style={{ padding:"7px 8px", color:t.s }}>{countryName(r.destination_country)}</td>
                        <td style={{ padding:"7px 8px", color:t.mu, fontFamily:"monospace" }}>{fmt.date(r.created)}</td>
                        <td style={{ padding:"7px 8px" }}>
                          <span style={{ fontSize:10, color:"#ef4444", background:"#ef444415", border:"1px solid #ef444433", borderRadius:4, padding:"2px 6px", fontFamily:"monospace" }}>
                            {ipStatusLabel(r.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {pages > 1 && (
                <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:10, justifyContent:"flex-end" }}>
                  <button onClick={() => setPage(p => Math.max(0, p-1))} disabled={page===0}
                    style={{ padding:"3px 10px", fontSize:11, background:t.sk, border:`1px solid ${t.border}`, borderRadius:5, color:t.t3, cursor:page===0?"default":"pointer", opacity:page===0?0.4:1 }}>‹</button>
                  <span style={{ fontSize:11, color:t.mu, fontFamily:"monospace" }}>{page+1} / {pages}</span>
                  <button onClick={() => setPage(p => Math.min(pages-1, p+1))} disabled={page===pages-1}
                    style={{ padding:"3px 10px", fontSize:11, background:t.sk, border:`1px solid ${t.border}`, borderRadius:5, color:t.t3, cursor:page===pages-1?"default":"pointer", opacity:page===pages-1?0.4:1 }}>›</button>
                </div>
              )}
            </>
          )}
          </>
        )}
    </Card>
  );
}

// ── ThemeSelector ─────────────────────────────────────────────────────────────
function ThemeSelector({ themeKey, setThemeKey, t }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    function h(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const cur = THEMES[themeKey];
  return (
    <div ref={ref} style={{ position:"relative" }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ display:"flex", alignItems:"center", gap:6, background:t.cardBg, border:`1px solid ${t.border}`, color:t.s, borderRadius:7, padding:"5px 10px", fontSize:11, cursor:"pointer", fontFamily:"monospace", whiteSpace:"nowrap" }}>
        <div style={{ width:11, height:11, borderRadius:3, background:cur.swatch, border:`1px solid ${t.border}`, flexShrink:0 }}/>
        {cur.label}
        <span style={{ fontSize:9, color:t.mu, marginLeft:2 }}>▾</span>
      </button>
      {open && (
        <div style={{ position:"absolute", top:"calc(100% + 6px)", right:0, zIndex:300, background:t.cardBg, border:`1px solid ${t.border}`, borderRadius:9, padding:5, boxShadow:"0 8px 32px #00000055", minWidth:130 }}>
          {THEME_KEYS.map(key => {
            const th = THEMES[key];
            const active = key === themeKey;
            return (
              <button key={key} onClick={() => { setThemeKey(key); localStorage.setItem("theme", key); setOpen(false); }}
                style={{ display:"flex", alignItems:"center", gap:8, width:"100%", padding:"7px 10px", background: active ? `${t.border}` : "transparent", border:"none", borderRadius:6, color: active ? t.p : t.s, cursor:"pointer", fontSize:11, fontFamily:"monospace", textAlign:"left" }}>
                <div style={{ width:16, height:16, borderRadius:4, background:th.swatch, border:`1px solid ${th.dark ? "#ffffff22" : "#00000022"}`, flexShrink:0 }}/>
                <span style={{ flex:1 }}>{th.label}</span>
                {active && <span style={{ fontSize:9, color:"#3b82f6" }}>✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Shared alert table helpers ────────────────────────────────────────────────
const AlertTH = ({ children, t }) => (
  <th style={{ padding:"6px 10px", textAlign:"left", color:t.mu, fontFamily:"monospace", fontWeight:600, borderBottom:`1px solid ${t.border}`, whiteSpace:"nowrap" }}>{children}</th>
);
const AlertTD = ({ children, style, t }) => (
  <td style={{ padding:"6px 10px", borderBottom:`1px solid ${t.border}`, ...(style||{}) }}>{children}</td>
);
const exStatusColor = s => {
  if (!s) return "#6b7280";
  const sl = s.toLowerCase();
  if (sl.includes("hold"))   return "#f59e0b";
  if (sl.includes("return")) return "#8b5cf6";
  return "#ef4444";
};
const staleColor = d => parseInt(d) >= 7 ? "#ef4444" : parseInt(d) >= 5 ? "#f97316" : "#f59e0b";

// ── ExceptionShipmentsCard ────────────────────────────────────────────────────
function ExceptionShipmentsCard({ rows, loading, t }) {
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [search,         setSearch]         = useState("");

  const statusGroups = (() => {
    const map = {};
    (rows||[]).forEach(r => { const s = r.status||"Unknown"; if (!map[s]) map[s]=[]; map[s].push(r); });
    return Object.entries(map).sort((a,b) => b[1].length - a[1].length);
  })();

  const q        = search.trim().toLowerCase();
  const matchRow = r => !q || r.scancode?.toLowerCase().includes(q) || r.customer_name?.toLowerCase().includes(q);
  const filtered = (selectedStatus ? (rows||[]).filter(r=>r.status===selectedStatus) : (rows||[])).filter(matchRow);

  return (
    <Card title={`Exception Shipments  ·  ${(rows||[]).length} total`} accent="#f59e0b" t={t}>
      {loading
        ? <div style={{ height:260, background:t.sk, borderRadius:8, animation:"pulse 1.5s infinite" }}/>
        : <>
            {/* Status pills */}
            <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:10 }}>
              <button onClick={() => setSelectedStatus(null)}
                style={{ padding:"3px 10px", borderRadius:20, border:`1px solid ${t.border}`, fontSize:10, fontFamily:"monospace", cursor:"pointer",
                  background: selectedStatus===null ? "#f59e0b" : t.sk, color: selectedStatus===null ? "#fff" : t.mu }}>
                All · {(rows||[]).length}
              </button>
              {statusGroups.map(([status, srows]) => {
                const color  = exStatusColor(status);
                const active = selectedStatus === status;
                return (
                  <button key={status} onClick={() => setSelectedStatus(s => s===status ? null : status)}
                    style={{ padding:"3px 10px", borderRadius:20, border:`1px solid ${color}55`, fontSize:10, fontFamily:"monospace", cursor:"pointer",
                      background: active ? color : `${color}18`, color: active ? "#fff" : color }}>
                    {status.replace(/_/g," ")} · {srows.length}
                  </button>
                );
              })}
            </div>
            {/* Search */}
            <div style={{ display:"flex", gap:8, marginBottom:10, alignItems:"center" }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter by scancode or customer…"
                style={{ flex:1, background:t.sk, border:`1px solid ${t.border}`, borderRadius:6, padding:"5px 10px", fontSize:11, color:t.s, fontFamily:"monospace", outline:"none" }}/>
              {search && <button onClick={() => setSearch("")} style={{ background:"none", border:"none", color:t.mu, cursor:"pointer", fontSize:13 }}>✕</button>}
              <span style={{ fontSize:11, color:t.mu, fontFamily:"monospace", flexShrink:0 }}>{filtered.length} shown</span>
            </div>
            {/* Table */}
            <div style={{ maxHeight:280, overflowY:"auto", borderRadius:6, border:`1px solid ${t.border}` }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                <thead><tr style={{ background:t.sk, position:"sticky", top:0 }}>
                  {["Scancode","Customer","Country","Svc","Status","Created"].map(h => <AlertTH key={h} t={t}>{h}</AlertTH>)}
                </tr></thead>
                <tbody>
                  {filtered.length === 0
                    ? <tr><td colSpan={6} style={{ padding:20, textAlign:"center", color:t.mu }}>No results</td></tr>
                    : filtered.map((r,i) => {
                        const color = exStatusColor(r.status);
                        return (
                          <tr key={i} className="rh">
                            <AlertTD t={t} style={{ whiteSpace:"nowrap" }}><ShipLink scancode={r.scancode}/></AlertTD>
                            <AlertTD t={t} style={{ color:t.s, maxWidth:140, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}><CustLink id={r.customerid} name={r.customer_name}/></AlertTD>
                            <AlertTD t={t} style={{ color:t.s }}>{r.destination_country||"—"}</AlertTD>
                            <AlertTD t={t} style={{ fontFamily:"monospace", color:t.s }}>{r.shippingmethod||"—"}</AlertTD>
                            <AlertTD t={t}>
                              <span style={{ fontSize:10, color, background:`${color}18`, padding:"2px 6px", borderRadius:4, fontFamily:"monospace", whiteSpace:"nowrap" }}>
                                {(r.status||"—").replace(/_/g," ")}
                              </span>
                            </AlertTD>
                            <AlertTD t={t} style={{ fontFamily:"monospace", color:t.mu, whiteSpace:"nowrap" }}>{r.created_date||"—"}</AlertTD>
                          </tr>
                        );
                      })
                  }
                </tbody>
              </table>
            </div>
          </>
      }
    </Card>
  );
}

// ── StaleShipmentsCard ────────────────────────────────────────────────────────
const STALE_BUCKETS = [
  { label:"≤3d",   color:"#f59e0b", test: d => d <= 3 },
  { label:"3–5d",  color:"#f97316", test: d => d >  3 && d <= 5 },
  { label:"5–10d", color:"#ef4444", test: d => d >  5 && d <= 10 },
  { label:">10d",  color:"#dc2626", test: d => d >  10 },
];

function StaleShipmentsCard({ rows, boxRows, loading, t }) {
  const [search,      setSearch]      = useState("");
  const [bucketFilter,setBucketFilter]= useState(null);   // label string or null
  const [carrierFilter,setCarrierFilter]= useState(null);
  const [statusFilter, setStatusFilter] = useState(null);

  const all = rows||[];
  const total   = all.length;
  const avgDays = total > 0 ? Math.round(all.reduce((s,r)=>s+(parseInt(r.days_stale)||0),0)/total) : 0;

  // Unique values for filter pills (derived from full unfiltered set)
  const carriers = [...new Set(all.map(r=>r.lmcarrier||"Unknown").filter(Boolean))].sort();
  const statuses = [...new Set(all.map(r=>r.status||"Unknown"))].sort();

  const q = search.trim().toLowerCase();
  const filtered = all.filter(r => {
    const d = parseInt(r.days_stale)||0;
    if (bucketFilter  && !STALE_BUCKETS.find(b=>b.label===bucketFilter)?.test(d)) return false;
    if (carrierFilter && (r.lmcarrier||"Unknown") !== carrierFilter)               return false;
    if (statusFilter  && (r.status||"Unknown")    !== statusFilter)                return false;
    if (q && !r.scancode?.toLowerCase().includes(q) && !r.customer_name?.toLowerCase().includes(q)) return false;
    return true;
  });

  const PillRow = ({ label, items, active, setActive, colorFn }) => (
    <div style={{ display:"flex", gap:4, alignItems:"center", flexWrap:"wrap" }}>
      <span style={{ fontSize:10, color:t.mu, fontFamily:"monospace", minWidth:52, flexShrink:0 }}>{label}</span>
      <button onClick={() => setActive(null)}
        style={{ padding:"2px 9px", borderRadius:20, border:`1px solid ${t.border}`, fontSize:10, fontFamily:"monospace", cursor:"pointer",
          background: active===null ? t.p : t.sk, color: active===null ? (t.dark?"#000":"#fff") : t.mu }}>
        All
      </button>
      {items.map(item => {
        const color  = colorFn ? colorFn(item) : "#3b82f6";
        const isActive = active === (typeof item === "object" ? item.label : item);
        const key    = typeof item === "object" ? item.label : item;
        const count  = typeof item === "object"
          ? all.filter(r => item.test(parseInt(r.days_stale)||0)).length
          : item === "_carrier_" ? 0 : all.filter(r => (label==="Carrier" ? r.lmcarrier||"Unknown" : r.status||"Unknown") === item).length;
        return (
          <button key={key} onClick={() => setActive(a => a===key ? null : key)}
            style={{ padding:"2px 9px", borderRadius:20, border:`1px solid ${isActive ? color : color+"55"}`, fontSize:10, fontFamily:"monospace", cursor:"pointer",
              background: isActive ? color : `${color}15`, color: isActive ? "#fff" : color }}>
            {typeof item === "object" ? item.label : item.replace(/_/g," ")} · {count}
          </button>
        );
      })}
    </div>
  );

  return (
    <Card title={`No Update >3 Days  ·  ${total} shipments`} accent="#ef4444" t={t}>
      {loading
        ? <div style={{ height:260, background:t.sk, borderRadius:8, animation:"pulse 1.5s infinite" }}/>
        : <>
            {/* Summary stats */}
            <div style={{ display:"flex", gap:8, marginBottom:12, flexWrap:"wrap" }}>
              <div style={{ background:t.sk, borderRadius:8, padding:"7px 14px", textAlign:"center" }}>
                <div style={{ fontSize:18, fontWeight:700, color:"#ef4444", fontFamily:"monospace" }}>{total}</div>
                <div style={{ fontSize:10, color:t.mu, marginTop:1 }}>Stale orders</div>
              </div>
              {avgDays > 0 && <div style={{ background:t.sk, borderRadius:8, padding:"7px 14px", textAlign:"center" }}>
                <div style={{ fontSize:18, fontWeight:700, color:staleColor(avgDays), fontFamily:"monospace" }}>{avgDays}d</div>
                <div style={{ fontSize:10, color:t.mu, marginTop:1 }}>Avg stale</div>
              </div>}
              {(boxRows||[]).length > 0 && <div style={{ background:t.sk, borderRadius:8, padding:"7px 14px", textAlign:"center" }}>
                <div style={{ fontSize:18, fontWeight:700, color:"#f97316", fontFamily:"monospace" }}>{(boxRows||[]).length}</div>
                <div style={{ fontSize:10, color:t.mu, marginTop:1 }}>Stale boxes</div>
              </div>}
              <div style={{ marginLeft:"auto", display:"flex", alignItems:"center" }}>
                <span style={{ fontSize:11, color:t.mu, fontFamily:"monospace" }}>{filtered.length} shown</span>
              </div>
            </div>

            {/* Filter rows */}
            <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:10, background:t.sk, borderRadius:8, padding:"8px 10px" }}>
              {/* Days bucket */}
              <PillRow label="Days"
                items={STALE_BUCKETS}
                active={bucketFilter}
                setActive={setBucketFilter}
                colorFn={item => item.color}/>
              {/* LM Carrier */}
              {carriers.length > 0 && <PillRow label="Carrier"
                items={carriers}
                active={carrierFilter}
                setActive={setCarrierFilter}
                colorFn={() => "#3b82f6"}/>}
              {/* Status */}
              {statuses.length > 0 && <PillRow label="Status"
                items={statuses}
                active={statusFilter}
                setActive={setStatusFilter}
                colorFn={s => exStatusColor(s)}/>}
            </div>

            {/* Search */}
            <div style={{ display:"flex", gap:8, marginBottom:10, alignItems:"center" }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter by scancode or customer…"
                style={{ flex:1, background:t.sk, border:`1px solid ${t.border}`, borderRadius:6, padding:"5px 10px", fontSize:11, color:t.s, fontFamily:"monospace", outline:"none" }}/>
              {search && <button onClick={() => setSearch("")} style={{ background:"none", border:"none", color:t.mu, cursor:"pointer", fontSize:13 }}>✕</button>}
              {(bucketFilter||carrierFilter||statusFilter) && (
                <button onClick={() => { setBucketFilter(null); setCarrierFilter(null); setStatusFilter(null); setSearch(""); }}
                  style={{ fontSize:10, color:"#ef4444", background:"#ef444415", border:"1px solid #ef444444", borderRadius:6, padding:"4px 8px", cursor:"pointer", fontFamily:"monospace", whiteSpace:"nowrap" }}>
                  ✕ Clear
                </button>
              )}
            </div>

            {/* Table */}
            <div style={{ maxHeight:240, overflowY:"auto", borderRadius:6, border:`1px solid ${t.border}` }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                <thead><tr style={{ background:t.sk, position:"sticky", top:0 }}>
                  {["Scancode","Customer","Country","Status","Carrier","Last Update","Stale"].map(h => <AlertTH key={h} t={t}>{h}</AlertTH>)}
                </tr></thead>
                <tbody>
                  {filtered.length === 0
                    ? <tr><td colSpan={7} style={{ padding:20, textAlign:"center", color:t.mu }}>No matching shipments</td></tr>
                    : filtered.map((r,i) => (
                        <tr key={i} className="rh">
                          <AlertTD t={t} style={{ whiteSpace:"nowrap" }}><ShipLink scancode={r.scancode}/></AlertTD>
                          <AlertTD t={t} style={{ color:t.s, maxWidth:130, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}><CustLink id={r.customerid} name={r.customer_name}/></AlertTD>
                          <AlertTD t={t} style={{ color:t.s }}>{r.destination_country||"—"}</AlertTD>
                          <AlertTD t={t} style={{ fontFamily:"monospace", color:t.mu, fontSize:10, maxWidth:130, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{(r.status||"—").replace(/_/g," ")}</AlertTD>
                          <AlertTD t={t} style={{ color:t.mu, fontSize:10, maxWidth:110, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.lmcarrier||"—"}</AlertTD>
                          <AlertTD t={t} style={{ fontFamily:"monospace", color:t.mu, whiteSpace:"nowrap" }}>{r.last_update||"—"}</AlertTD>
                          <AlertTD t={t} style={{ fontFamily:"monospace", fontWeight:700, whiteSpace:"nowrap", color:staleColor(r.days_stale) }}>{r.days_stale}d</AlertTD>
                        </tr>
                      ))
                  }
                </tbody>
              </table>
            </div>
          </>
      }
    </Card>
  );
}

// ── LivePickupList ─────────────────────────────────────────────────────────────
const NODE_LABELS_GLOBAL = { JPRPC1:"Jaipur", DELPC1:"Delhi", SURPC1:"Surat", MUMPC1:"Mumbai", BLRPC1:"Bangalore" };

function LivePickupList({ rows, loading, t }) {
  const [search,    setSearch]    = useState("");
  const [collapsed, setCollapsed] = useState({});

  const toggle = node => setCollapsed(c => ({ ...c, [node]: !c[node] }));

  // Group by service_node
  const groups = (() => {
    const map = {};
    rows.forEach(r => {
      const key = r.service_node || "Unknown";
      if (!map[key]) map[key] = [];
      map[key].push(r);
    });
    // Sort nodes alphabetically; Unknown last
    return Object.entries(map).sort(([a],[b]) => a === "Unknown" ? 1 : b === "Unknown" ? -1 : a.localeCompare(b));
  })();

  const q = search.trim().toLowerCase();
  const matchRow = r =>
    !q ||
    r.scancode?.toLowerCase().includes(q) ||
    r.customer_name?.toLowerCase().includes(q) ||
    r.destination_country?.toLowerCase().includes(q);

  const COLS = ["Scancode","Customer","Country","Service","Carrier","Created","Age"];

  return (
    <Card title={`Live OUT_FOR_PICKUP  ·  ${rows.length} awaiting pickup`} accent="#ef4444" t={t} style={{ marginBottom:14 }}>
      {loading
        ? <div style={{ height:180, background:t.sk, borderRadius:8, animation:"pulse 1.5s infinite" }}/>
        : <>
            <div style={{ display:"flex", gap:8, marginBottom:12, alignItems:"center" }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter by scancode, customer or country…"
                style={{ flex:1, background:t.sk, border:`1px solid ${t.border}`, borderRadius:6, padding:"5px 10px", fontSize:11, color:t.s, fontFamily:"monospace", outline:"none" }}/>
              {search && <button onClick={() => setSearch("")} style={{ background:"none", border:"none", color:t.mu, cursor:"pointer", fontSize:13, padding:"0 4px" }}>✕</button>}
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {groups.map(([node, nodeRows]) => {
                const filtered = nodeRows.filter(matchRow);
                if (filtered.length === 0) return null;
                const label    = NODE_LABELS_GLOBAL[node] || node;
                const isOpen   = !collapsed[node];
                const oldest   = Math.max(...filtered.map(r => parseInt(r.age_days)||0));
                const urgColor = oldest >= 3 ? "#ef4444" : oldest >= 1 ? "#f59e0b" : "#10b981";
                return (
                  <div key={node} style={{ border:`1px solid ${t.border}`, borderRadius:8, overflow:"hidden" }}>
                    {/* Node header — clickable to collapse */}
                    <button onClick={() => toggle(node)}
                      style={{ width:"100%", display:"flex", alignItems:"center", gap:10, padding:"8px 12px", background:t.sk, border:"none", cursor:"pointer", textAlign:"left" }}>
                      <span style={{ fontSize:13, color:t.mu, fontFamily:"monospace", transition:"transform 0.15s", display:"inline-block", transform: isOpen ? "rotate(90deg)" : "rotate(0deg)" }}>▶</span>
                      <span style={{ fontSize:13, fontWeight:700, color:t.p, flex:1 }}>{label}</span>
                      <span style={{ fontSize:10, color:t.mu, fontFamily:"monospace", background:t.border, padding:"2px 8px", borderRadius:4 }}>{node}</span>
                      <span style={{ fontSize:11, color:urgColor, fontFamily:"monospace", fontWeight:700 }}>{filtered.length} shipments</span>
                      {oldest > 0 && <span style={{ fontSize:10, color:urgColor, fontFamily:"monospace" }}>oldest {oldest}d</span>}
                    </button>
                    {/* Collapsible table */}
                    {isOpen && (
                      <div style={{ overflowX:"auto" }}>
                        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                          <thead>
                            <tr style={{ background:`${t.sk}88` }}>
                              {COLS.map(h => (
                                <th key={h} style={{ padding:"5px 10px", textAlign:"left", color:t.mu, fontFamily:"monospace", fontWeight:600, borderBottom:`1px solid ${t.border}`, whiteSpace:"nowrap" }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {filtered.map((r,i) => {
                              const age = parseInt(r.age_days) || 0;
                              return (
                                <tr key={i} className="rh">
                                  <td style={{ padding:"6px 10px", borderBottom:`1px solid ${t.border}`, whiteSpace:"nowrap" }}><ShipLink scancode={r.scancode}/></td>
                                  <td style={{ padding:"6px 10px", color:t.s, borderBottom:`1px solid ${t.border}`, maxWidth:180, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}><CustLink id={r.customerid} name={r.customer_name}/></td>
                                  <td style={{ padding:"6px 10px", color:t.s, borderBottom:`1px solid ${t.border}` }}>{r.destination_country||"—"}</td>
                                  <td style={{ padding:"6px 10px", fontFamily:"monospace", color:t.s, borderBottom:`1px solid ${t.border}` }}>{r.shippingmethod||"—"}</td>
                                  <td style={{ padding:"6px 10px", color:t.mu, borderBottom:`1px solid ${t.border}`, maxWidth:130, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.lmcarrier||"—"}</td>
                                  <td style={{ padding:"6px 10px", fontFamily:"monospace", color:t.mu, borderBottom:`1px solid ${t.border}`, whiteSpace:"nowrap" }}>{r.created_date||"—"}</td>
                                  <td style={{ padding:"6px 10px", fontFamily:"monospace", borderBottom:`1px solid ${t.border}`, whiteSpace:"nowrap",
                                    color: age >= 3 ? "#ef4444" : age >= 1 ? "#f59e0b" : "#10b981" }}>
                                    {age}d
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
              {groups.every(([node, nodeRows]) => nodeRows.filter(matchRow).length === 0) && (
                <div style={{ color:t.mu, fontSize:12, padding:"20px 0", textAlign:"center" }}>No results</div>
              )}
            </div>
          </>
      }
    </Card>
  );
}

// ── CustomerSignalCard ─────────────────────────────────────────────────────────
function CustomerSignalCard({ newRows, reactivatedRows, loading, t }) {
  const [tab,    setTab]    = useState("new");
  const [search, setSearch] = useState("");
  const rows     = tab === "new" ? (newRows||[]) : (reactivatedRows||[]);
  const filtered = search.trim()
    ? rows.filter(r => r.customer_name?.toLowerCase().includes(search.toLowerCase()))
    : rows;
  return (
    <Card title="Customer Signals  ·  First-timers & Re-activated" accent="#f97316" t={t} style={{ marginBottom:14 }}>
      {loading
        ? <div style={{ height:220, background:t.sk, borderRadius:8, animation:"pulse 1.5s infinite" }}/>
        : <>
            <div style={{ display:"flex", gap:8, marginBottom:8, alignItems:"center", flexWrap:"wrap" }}>
              <div style={{ display:"flex", background:t.sk, borderRadius:7, padding:2, gap:2 }}>
                {[["new","★  First-time","#10b981"],["reactivated","↩  Re-activated","#f97316"]].map(([key,label,color]) => (
                  <button key={key} onClick={() => { setTab(key); setSearch(""); }}
                    style={{ padding:"5px 13px", borderRadius:5, border:"none", cursor:"pointer", fontSize:11, fontFamily:"monospace", fontWeight:600,
                      background: tab===key ? color : "transparent",
                      color: tab===key ? "#fff" : t.mu, transition:"all 0.15s" }}>
                    {label}&nbsp;<span style={{ fontSize:10, opacity:0.8 }}>({key==="new"?(newRows||[]).length:(reactivatedRows||[]).length})</span>
                  </button>
                ))}
              </div>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter by name…"
                style={{ flex:1, minWidth:140, background:t.sk, border:`1px solid ${t.border}`, borderRadius:6, padding:"5px 10px", fontSize:11, color:t.s, fontFamily:"monospace", outline:"none" }}/>
              {search && <button onClick={() => setSearch("")} style={{ background:"none", border:"none", color:t.mu, cursor:"pointer", fontSize:13 }}>✕</button>}
            </div>
            <div style={{ fontSize:10, color:t.mu, marginBottom:10, fontStyle:"italic" }}>
              {tab === "new"
                ? "Customers whose very first order ever was placed within the selected date range."
                : "Customers who re-ordered after 15+ days of inactivity — their previous order was outside the range."}
            </div>
            <div style={{ maxHeight:300, overflowY:"auto", display:"flex", flexDirection:"column", gap:5 }}>
              {filtered.length === 0
                ? <div style={{ color:t.mu, fontSize:12, padding:"20px 0", textAlign:"center" }}>No customers found</div>
                : filtered.map((r,i) => (
                    <div key={i} style={{ display:"flex", alignItems:"center", gap:10, background:t.sk, borderRadius:7, padding:"8px 12px" }}>
                      <div style={{ width:30, height:30, borderRadius:"50%", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13,
                        background: tab==="new" ? "#10b98118" : "#f9741618",
                        color:      tab==="new" ? "#10b981"   : "#f97316" }}>
                        {tab==="new" ? "★" : "↩"}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:12, fontWeight:600, color:t.p, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}><CustLink id={r.customerid} name={r.customer_name}/></div>
                        {tab === "new"
                          ? <div style={{ fontSize:10, color:t.mu, marginTop:2 }}>
                              First order: <span style={{ color:"#10b981", fontFamily:"monospace" }}>{r.first_order_ever||"—"}</span>
                              {r.total_orders > 0 && <span style={{ marginLeft:8 }}>{r.total_orders} orders total</span>}
                            </div>
                          : <div style={{ fontSize:10, color:t.mu, marginTop:2, display:"flex", gap:8, flexWrap:"wrap" }}>
                              <span>Last seen: <span style={{ fontFamily:"monospace", color:t.s }}>{r.last_before_range||"—"}</span></span>
                              <span style={{ background:"#f9741622", color:"#f97316", padding:"1px 6px", borderRadius:4, fontFamily:"monospace" }}>{r.gap_days}d gap</span>
                              <span>{r.orders_in_range} order{r.orders_in_range>1?"s":""} now</span>
                            </div>
                        }
                      </div>
                      {r.service_node && (
                        <span style={{ fontSize:10, color:t.mu, background:t.border, padding:"2px 7px", borderRadius:4, fontFamily:"monospace", flexShrink:0 }}>
                          {NODE_LABELS_GLOBAL[r.service_node]||r.service_node}
                        </span>
                      )}
                    </div>
                  ))
              }
            </div>
          </>
      }
    </Card>
  );
}

// ── CustomerTiersCard ─────────────────────────────────────────────────────────
function CustomerTiersCard({ tierRows, detailRows, loading, t }) {
  const [expanded, setExpanded] = useState(null); // "Top 10%" | "Middle 40%" | "Last 50%" | null
  const [search,   setSearch]   = useState("");

  const TIER_COLORS = { "Top 10%":"#f59e0b", "Middle 40%":"#3b82f6", "Last 50%":"#6b7280" };
  const tierOrder   = ["Top 10%","Middle 40%","Last 50%"];

  const tierOf = decile => {
    const d = parseInt(decile);
    if (d === 1)      return "Top 10%";
    if (d <= 5)       return "Middle 40%";
    return "Last 50%";
  };

  // Group detail rows by tier
  const detailByTier = (detailRows||[]).reduce((map, r) => {
    const tier = tierOf(r.decile);
    if (!map[tier]) map[tier] = [];
    map[tier].push(r);
    return map;
  }, {});

  const tierTotalRev = (tierRows||[]).reduce((s,r) => s + (parseFloat(r.total_revenue)||0), 0);
  const sorted       = tierOrder.map(name => (tierRows||[]).find(r=>r.tier===name)).filter(Boolean);

  const toggle = tier => {
    setExpanded(e => e === tier ? null : tier);
    setSearch("");
  };

  return (
    <Card title="Customer Revenue Tiers  ·  NTILE distribution  ·  Click a tier to see customers" accent="#f97316" t={t}>
      {loading
        ? <div style={{ height:180, background:t.sk, borderRadius:8, animation:"pulse 1.5s infinite" }}/>
        : sorted.length === 0
          ? <div style={{ color:t.mu, fontSize:12 }}>No data</div>
          : <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {sorted.map((r,i) => {
                const rev    = parseFloat(r.total_revenue)||0;
                const pct    = tierTotalRev > 0 ? (rev/tierTotalRev*100) : 0;
                const color  = TIER_COLORS[r.tier] || "#6b7280";
                const isOpen = expanded === r.tier;
                const custList = detailByTier[r.tier] || [];
                const q = search.trim().toLowerCase();
                const filtered = isOpen && q
                  ? custList.filter(c => c.customer_name?.toLowerCase().includes(q))
                  : custList;

                return (
                  <div key={i} style={{ border:`1px solid ${isOpen ? color+"66" : t.border}`, borderRadius:8, overflow:"hidden", transition:"border-color 0.2s" }}>
                    {/* Tier row — clickable */}
                    <button onClick={() => toggle(r.tier)}
                      style={{ width:"100%", background: isOpen ? `${color}0e` : "transparent", border:"none", cursor:"pointer", padding:"10px 14px", textAlign:"left" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <span style={{ fontSize:13, color:t.mu, transition:"transform 0.15s", display:"inline-block", transform: isOpen ? "rotate(90deg)" : "rotate(0deg)" }}>▶</span>
                          <div style={{ width:10, height:10, borderRadius:3, background:color, flexShrink:0 }}/>
                          <span style={{ fontSize:13, fontWeight:700, color }}>{r.tier}</span>
                        </div>
                        <div style={{ display:"flex", gap:12, alignItems:"center" }}>
                          <span style={{ fontSize:11, color:t.mu, fontFamily:"monospace" }}>{fmt.number(r.customers)} custs</span>
                          <span style={{ fontSize:11, color:t.mu, fontFamily:"monospace" }}>{fmt.number(r.total_shipments)} ships</span>
                          <span style={{ fontSize:13, fontWeight:700, color, fontFamily:"monospace" }}>{fmt.currency(rev)}</span>
                        </div>
                      </div>
                      <div style={{ height:10, background:t.sk, borderRadius:6, overflow:"hidden" }}>
                        <div style={{ width:`${pct}%`, height:"100%", background:`${color}cc`, borderRadius:6, display:"flex", alignItems:"center", paddingLeft:8 }}>
                          {pct > 12 && <span style={{ fontSize:9, color:"#fff", fontFamily:"monospace", fontWeight:700 }}>{pct.toFixed(1)}%</span>}
                        </div>
                      </div>
                      {pct <= 12 && <div style={{ fontSize:9, color:t.mu, fontFamily:"monospace", marginTop:2, textAlign:"right" }}>{pct.toFixed(1)}% of revenue</div>}
                    </button>

                    {/* Expanded customer list */}
                    {isOpen && (
                      <div style={{ borderTop:`1px solid ${color}44`, padding:"10px 14px" }}>
                        <div style={{ display:"flex", gap:8, marginBottom:8, alignItems:"center" }}>
                          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter by name…"
                            style={{ flex:1, background:t.sk, border:`1px solid ${t.border}`, borderRadius:6, padding:"4px 10px", fontSize:11, color:t.s, fontFamily:"monospace", outline:"none" }}/>
                          {search && <button onClick={e => { e.stopPropagation(); setSearch(""); }} style={{ background:"none", border:"none", color:t.mu, cursor:"pointer", fontSize:13 }}>✕</button>}
                          <span style={{ fontSize:10, color:t.mu, fontFamily:"monospace", flexShrink:0 }}>{filtered.length} of {custList.length}</span>
                        </div>
                        <div style={{ maxHeight:220, overflowY:"auto", borderRadius:6, border:`1px solid ${t.border}` }}>
                          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                            <thead><tr style={{ background:t.sk, position:"sticky", top:0 }}>
                              <th style={{ padding:"5px 10px", textAlign:"left", color:t.mu, fontFamily:"monospace", fontWeight:600, borderBottom:`1px solid ${t.border}`, width:28 }}>#</th>
                              <th style={{ padding:"5px 10px", textAlign:"left", color:t.mu, fontFamily:"monospace", fontWeight:600, borderBottom:`1px solid ${t.border}` }}>Customer</th>
                              <th style={{ padding:"5px 10px", textAlign:"right", color:t.mu, fontFamily:"monospace", fontWeight:600, borderBottom:`1px solid ${t.border}`, whiteSpace:"nowrap" }}>Shipments</th>
                              <th style={{ padding:"5px 10px", textAlign:"right", color:t.mu, fontFamily:"monospace", fontWeight:600, borderBottom:`1px solid ${t.border}` }}>Revenue</th>
                            </tr></thead>
                            <tbody>
                              {filtered.length === 0
                                ? <tr><td colSpan={4} style={{ padding:16, textAlign:"center", color:t.mu }}>No results</td></tr>
                                : filtered.map((c, ci) => (
                                    <tr key={ci} className="rh">
                                      <td style={{ padding:"5px 10px", color:t.mu, fontFamily:"monospace", borderBottom:`1px solid ${t.border}`, fontSize:10 }}>{ci+1}</td>
                                      <td style={{ padding:"5px 10px", color:t.s, borderBottom:`1px solid ${t.border}`, maxWidth:200, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                                        <CustLink id={c.customerid} name={c.customer_name}/>
                                      </td>
                                      <td style={{ padding:"5px 10px", textAlign:"right", color:t.mu, fontFamily:"monospace", borderBottom:`1px solid ${t.border}` }}>{fmt.number(c.shipments)}</td>
                                      <td style={{ padding:"5px 10px", textAlign:"right", color, fontFamily:"monospace", fontWeight:700, borderBottom:`1px solid ${t.border}` }}>{fmt.currency(c.revenue)}</td>
                                    </tr>
                                  ))
                              }
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              <div style={{ display:"flex", justifyContent:"space-between", paddingTop:4 }}>
                <span style={{ fontSize:11, color:t.mu }}>{(tierRows||[]).reduce((s,r)=>s+(parseInt(r.customers)||0),0)} total customers</span>
                <span style={{ fontSize:11, color:t.p, fontFamily:"monospace", fontWeight:600 }}>{fmt.currency(tierTotalRev)}</span>
              </div>
            </div>
      }
    </Card>
  );
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
  const [activeTab,   setActiveTab]   = useState("main");
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
        .grid-kpi{display:grid;grid-template-columns:repeat(5,1fr);gap:14px;margin-bottom:14px}
        .grid-insights{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:18px}
        .grid-2col{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:18px}
        .grid-countries{display:grid;grid-template-columns:1.5fr 1fr;gap:14px;margin-bottom:18px}
        .grid-customers{display:grid;grid-template-columns:1fr 1fr;gap:6px 32px}
        .header-right{display:flex;align-items:center;gap:10px}
        .header-datepicker{flex:1}

        @media(max-width:1100px){
          .grid-insights{grid-template-columns:repeat(3,1fr)}
        }
        @media(max-width:1100px){
          .grid-kpi{grid-template-columns:repeat(3,1fr)}
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
            <div style={{ fontSize:15, fontWeight:700, color:t.p }}>Control Tower</div>
          </div>
        </div>

        <div className="header-datepicker">
          <DateRangePicker value={dateRange} onChange={setDateRange} t={t}/>
        </div>

        <div className="header-right">
          <ThemeSelector themeKey={themeKey} setThemeKey={setThemeKey} t={t}/>
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
      {/* ── Tab bar ── */}
      <div style={{ display:"flex", gap:0, padding:"0 24px", background:t.headerBg, borderBottom:`1px solid ${t.border}`, position:"sticky", top:53, zIndex:9 }}>
        {[["main","Overall"],["indiapost","IndiaPost"],["analytics","Analytics"]].map(([key,label]) => (
          <button key={key} onClick={() => setActiveTab(key)} style={{ padding:"10px 20px", fontSize:12, fontWeight:600, background:"none", border:"none", borderBottom: activeTab===key ? `2px solid #3b82f6` : "2px solid transparent", color: activeTab===key ? "#3b82f6" : t.mu, cursor:"pointer", transition:"color 0.15s", marginBottom:-1 }}>
            {label}
          </button>
        ))}
      </div>

      <div className="dash-content fade">

      {activeTab === "main" && <>

        {/* KPIs */}
        <div className="grid-kpi">
          <KPICard label="Total Revenue"    loading={loading} value={fmt.currency(kpis.total_revenue)}   sub={`${dateRange.start} → ${dateRange.end}`} sparkData={revSpark} color="#3b82f6" t={t}/>
          <KPICard label="Total Shipments"  loading={loading} value={fmt.number(kpis.total_orders)}      sub={`${dateRange.start} → ${dateRange.end}`} sparkData={ordSpark} color="#10b981" t={t}/>
          <KPICard label="Avg Shipment Value" loading={loading} value={fmt.currency(kpis.avg_order_value)} sub="Per shipment" color="#f59e0b" t={t}/>
          <KPICard label="Unique Customers" loading={loading} value={fmt.number(kpis.unique_customers)}  sub="Active shippers" color="#8b5cf6" t={t}/>
          <KPICard label="Cancellation Rate" loading={loading}
            value={kpis.cancelled_orders != null && (parseFloat(kpis.total_orders)||0) + (parseFloat(kpis.cancelled_orders)||0) > 0
              ? `${(parseFloat(kpis.cancelled_orders) / (parseFloat(kpis.total_orders) + parseFloat(kpis.cancelled_orders)) * 100).toFixed(1)}%`
              : "—"}
            sub={`${fmt.number(kpis.cancelled_orders)} cancelled`} color="#ef4444" t={t}/>
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
              : <BarChart data={data.dailyRevenue||[]} xKey="day" yKey="revenue" color="#3b82f6" height={140} showTrend trendColor="#f59e0b"
                  fmtTertiary={d => d.daily_load != null ? `${parseFloat(d.daily_load).toLocaleString("en-IN",{maximumFractionDigits:1})} kg` : null} t={t}/>}
          </Card>
          <Card title="Shipments by Status" accent="#10b981" t={t}>
            {loading
              ? <div style={{ height:140, background:t.sk, borderRadius:8, animation:"pulse 1.5s infinite" }}/>
              : <DonutChart data={data.ordersByStatus||[]} labelKey="status" valueKey="count" t={t}/>}
          </Card>
        </div>

        {/* Row 3: countries + tracking */}
        <div className="grid-countries">
          <Card title="Revenue by Destination Country" accent="#06b6d4" t={t}>
            {loading
              ? <div style={{ height:200, background:t.sk, borderRadius:8, animation:"pulse 1.5s infinite" }}/>
              : <HorizontalBar data={countriesData} labelKey="label" valueKey="revenue" color="#06b6d4" fmtVal={fmt.currency} maxItems={12} t={t}/>}
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

        {/* Row 4: service mix */}
        <div className="grid-2col">
          <Card title="Service Mix by Shipments" accent="#f97316" t={t}>
            {loading
              ? <div style={{ height:160, background:t.sk, borderRadius:8, animation:"pulse 1.5s infinite" }}/>
              : <DonutChart
                  data={(data.shipmentsByService||[]).map(r=>({...r,label:serviceName(r.service)}))}
                  labelKey="label" valueKey="count" t={t}/>}
          </Card>
          <Card title="Service Mix by Revenue" accent="#f97316" t={t}>
            {loading
              ? <div style={{ height:160, background:t.sk, borderRadius:8, animation:"pulse 1.5s infinite" }}/>
              : <DonutChart
                  data={(data.shipmentsByService||[]).map(r=>({...r,label:serviceName(r.service)}))}
                  labelKey="label" valueKey="revenue" fmtVal={fmt.currency} t={t}/>}
          </Card>
        </div>

        {/* Row 5: LM carrier efficiency */}
        <Card title="LM Carrier Delivery Performance  ·  Delivery rate = % of shipments in date range already delivered  ·  TAT = pickup→delivery (delivered only)" accent="#10b981" t={t} style={{ marginBottom:14 }}>
          {loading
            ? <div style={{ height:200, background:t.sk, borderRadius:8, animation:"pulse 1.5s infinite" }}/>
            : (() => {
                const rows = data.carrierPerformance||[];
                if (!rows.length) return <div style={{ color:t.mu, fontSize:12 }}>No data</div>;
                return (
                  <div style={{ overflowX:"auto" }}>
                    <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
                      <thead>
                        <tr>
                          {["Carrier","Method","Delivery Rate","TAT (days)","Delivered","Total"].map(h => (
                            <th key={h} style={{ textAlign:h==="Delivery Rate"?"left":"right", color:t.mu, fontWeight:500, padding:"4px 8px", fontFamily:"monospace", fontSize:10, letterSpacing:"0.05em", borderBottom:`1px solid ${t.border}`, whiteSpace:"nowrap" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r,i) => {
                          const rate = parseFloat(r.delivery_rate)||0;
                          const rateColor = rate>=80?"#10b981":rate>=50?"#f59e0b":"#ef4444";
                          return (
                            <tr key={i} style={{ borderBottom:`1px solid ${t.border}40` }}>
                              <td style={{ padding:"7px 8px", color:t.p, fontWeight:600 }}>{r.lmcarrier}</td>
                              <td style={{ padding:"7px 8px", color:t.t3, textAlign:"right" }}>{r.lmshippingmethod}</td>
                              <td style={{ padding:"7px 8px", minWidth:140 }}>
                                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                                  <div style={{ flex:1, height:5, background:t.sk, borderRadius:3, overflow:"hidden" }}>
                                    <div style={{ width:`${rate}%`, height:"100%", background:rateColor, borderRadius:3 }}/>
                                  </div>
                                  <span style={{ fontFamily:"monospace", color:rateColor, width:36, textAlign:"right", flexShrink:0 }}>{rate}%</span>
                                </div>
                              </td>
                              <td style={{ padding:"7px 8px", textAlign:"right", color:t.s, fontFamily:"monospace" }}>{r.avg_tat != null ? `${r.avg_tat}d` : "—"}</td>
                              <td style={{ padding:"7px 8px", textAlign:"right", color:"#10b981", fontFamily:"monospace" }}>{parseInt(r.delivered||0).toLocaleString("en-IN")}</td>
                              <td style={{ padding:"7px 8px", textAlign:"right", color:t.mu, fontFamily:"monospace" }}>{parseInt(r.total||0).toLocaleString("en-IN")}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
        </Card>

        {/* Row 6: TAT distribution */}
        <Card title="Overall TAT Distribution (Pickup → Delivered)" accent="#8b5cf6" t={t} style={{ marginBottom:14 }}>
          {loading
            ? <div style={{ height:120, background:t.sk, borderRadius:8, animation:"pulse 1.5s infinite" }}/>
            : (() => {
                const rows = data.tatDistribution||[];
                if (!rows.length) return <div style={{ color:t.mu, fontSize:12 }}>No data — try a wider date range</div>;
                const total = rows.reduce((s,r) => s+(parseFloat(r.shipments)||0), 0);
                const avgTat = data.carrierPerformance
                  ? (() => { const all = (data.carrierPerformance||[]).filter(r=>r.avg_tat!=null); const wsum = all.reduce((s,r)=>s+(parseFloat(r.avg_tat)||0)*(parseFloat(r.delivered)||0),0); const wd = all.reduce((s,r)=>s+(parseFloat(r.delivered)||0),0); return wd>0?Math.round(wsum/wd*10)/10:null; })()
                  : null;
                const within14 = rows.filter(r=>r.sort_order<=2).reduce((s,r)=>s+(parseFloat(r.shipments)||0),0);
                const sla = total>0 ? (within14/total*100).toFixed(1) : null;
                const max = Math.max(...rows.map(r=>parseFloat(r.shipments)||0), 1);
                const COLORS = { "1–7d":"#10b981", "8–14d":"#3b82f6", "15–21d":"#f59e0b", "22–28d":"#f97316", "29+d":"#ef4444" };
                return (
                  <div>
                    <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
                      {avgTat != null && <div style={{ background:t.sk, borderRadius:8, padding:"8px 16px", textAlign:"center" }}>
                        <div style={{ fontSize:18, fontWeight:700, color:t.p, fontFamily:"monospace" }}>{avgTat}d</div>
                        <div style={{ fontSize:10, color:t.mu, marginTop:2 }}>Weighted avg TAT</div>
                      </div>}
                      {sla != null && <div style={{ background:t.sk, borderRadius:8, padding:"8px 16px", textAlign:"center" }}>
                        <div style={{ fontSize:18, fontWeight:700, color: parseFloat(sla)>=80?"#10b981":"#f59e0b", fontFamily:"monospace" }}>{sla}%</div>
                        <div style={{ fontSize:10, color:t.mu, marginTop:2 }}>Delivered ≤14 days</div>
                      </div>}
                      <div style={{ background:t.sk, borderRadius:8, padding:"8px 16px", textAlign:"center" }}>
                        <div style={{ fontSize:18, fontWeight:700, color:t.p, fontFamily:"monospace" }}>{total.toLocaleString("en-IN")}</div>
                        <div style={{ fontSize:10, color:t.mu, marginTop:2 }}>Total delivered</div>
                      </div>
                    </div>
                    <div style={{ display:"flex", alignItems:"flex-end", gap:8, height:100 }}>
                      {rows.map((r,i) => {
                        const val = parseFloat(r.shipments)||0;
                        const pct = (val/max)*100;
                        const color = COLORS[r.bucket]||"#8b5cf6";
                        return (
                          <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", height:"100%" }}>
                            <div style={{ flex:1, width:"100%", display:"flex", alignItems:"flex-end" }}>
                              <div style={{ width:"100%", background:`${color}33`, borderRadius:"4px 4px 0 0", height:`${pct}%`, minHeight:val>0?4:0, position:"relative" }}>
                                <div style={{ position:"absolute", bottom:0, left:0, right:0, height:3, background:color, borderRadius:2 }}/>
                                <div style={{ position:"absolute", top:-18, left:"50%", transform:"translateX(-50%)", fontSize:10, color:t.s, fontFamily:"monospace", whiteSpace:"nowrap" }}>{val.toLocaleString("en-IN")}</div>
                              </div>
                            </div>
                            <div style={{ fontSize:11, color:color, fontFamily:"monospace", marginTop:6, fontWeight:600 }}>{r.bucket}</div>
                            <div style={{ fontSize:9, color:t.mu, fontFamily:"monospace" }}>{total>0?(val/total*100).toFixed(0):"0"}%</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
        </Card>

        {/* Row 7: top customers */}
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
                          <span style={{ fontSize:12, color:t.s, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1, marginRight:8 }}><CustLink id={c.customerid} name={c.customer_name}/></span>
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

        {/* Row 8: Commercial customer revenue */}
        <Card title="Commercial Customer Revenue Distribution  ·  Lite / Premium / XPress  ·  Completed payments  ·  Excl. IndiaPost" accent="#06b6d4" t={t} style={{ marginTop:14 }}>
          {loading
            ? <div style={{ height:220, background:t.sk, borderRadius:8, animation:"pulse 1.5s infinite" }}/>
            : (() => {
                const rows = data.commercialCustomers||[];
                if (!rows.length) return <div style={{ color:t.mu, fontSize:12 }}>No data</div>;
                const totalRev = rows.reduce((s,r) => s+(parseFloat(r.revenue)||0), 0);
                const maxRev   = Math.max(...rows.map(r => parseFloat(r.revenue)||0), 1);
                return (
                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    {rows.map((r,i) => {
                      const rev = parseFloat(r.revenue)||0;
                      const pct = totalRev > 0 ? (rev/totalRev*100) : 0;
                      const barW = (rev/maxRev)*100;
                      return (
                        <div key={i} style={{ display:"grid", gridTemplateColumns:"22px 1fr 160px 80px 76px", gap:"0 10px", alignItems:"center" }}>
                          <span style={{ fontSize:11, color:t.mu, fontFamily:"monospace", textAlign:"right" }}>{i+1}</span>
                          <span style={{ fontSize:11, color:t.s, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}><CustLink id={r.customerid} name={r.customer_name}/></span>
                          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                            <div style={{ flex:1, height:5, background:t.sk, borderRadius:3 }}>
                              <div style={{ width:`${barW}%`, height:"100%", background:"#06b6d499", borderRadius:3 }}/>
                            </div>
                          </div>
                          <span style={{ fontSize:11, color:t.p, fontFamily:"monospace", textAlign:"right" }}>{fmt.currency(rev)}</span>
                          <span style={{ fontSize:10, color:t.mu, fontFamily:"monospace", textAlign:"right" }}>{pct.toFixed(1)}%</span>
                        </div>
                      );
                    })}
                    <div style={{ borderTop:`1px solid ${t.border}`, paddingTop:8, display:"flex", justifyContent:"space-between", marginTop:4 }}>
                      <span style={{ fontSize:11, color:t.mu }}>{rows.length} customers</span>
                      <span style={{ fontSize:11, color:t.p, fontFamily:"monospace", fontWeight:600 }}>{fmt.currency(totalRev)} total</span>
                    </div>
                  </div>
                );
              })()}
        </Card>

      </>}

      {activeTab === "indiapost" && (() => {
        const ipk = data.ipKpis?.[0] || {};
        const pendingCustoms = parseInt(data.ipPendingCustoms?.[0]?.count || 0);
        const ipSpark = (data.ipDailyTrend||[]).map(d => d.shipments);
        return (
          <>
            {/* IndiaPost KPIs */}
            {/* KPIs — 5 cards including revenue */}
            <div className="grid-kpi">
              <KPICard label="Total Shipments" loading={loading} value={fmt.number(ipk.total)} sub={`${dateRange.start} → ${dateRange.end}`} sparkData={ipSpark} color="#ef4444" t={t}/>
              <KPICard label="Active" loading={loading} value={fmt.number(ipk.active)} sub="Non-cancelled" sparkData={ipSpark} color="#10b981" t={t}/>
              <KPICard label="Delivered" loading={loading} value={fmt.number(ipk.delivered)} sub={ipk.active > 0 ? `${(parseFloat(ipk.delivered)/parseFloat(ipk.active)*100).toFixed(1)}% delivery rate` : ""} color="#3b82f6" t={t}/>
              <KPICard label="Revenue" loading={loading} value={fmt.currency(ipk.revenue)} sub="IndiaPost shipments" color="#8b5cf6" t={t}/>
              <KPICard label="Cancelled" loading={loading} value={fmt.number(ipk.cancelled)} sub={ipk.total > 0 ? `${(parseFloat(ipk.cancelled)/parseFloat(ipk.total)*100).toFixed(1)}% of total` : ""} color="#6b7280" t={t}/>
            </div>

            {/* Daily trend + mail type */}
            <div className="grid-2col">
              <Card title="Daily IndiaPost Shipments" accent="#ef4444" t={t}>
                {loading
                  ? <div style={{ height:150, background:t.sk, borderRadius:8, animation:"pulse 1.5s infinite" }}/>
                  : <BarChart data={data.ipDailyTrend||[]} xKey="day" yKey="shipments" color="#ef4444" height={140}
                      fmtTooltip={d => `${fmt.number(d.shipments)} shipments`}
                      fmtSecondary={d => fmt.currency(d.revenue)} t={t}/>}
              </Card>
              <Card title="Mail Type" accent="#8b5cf6" t={t}>
                {loading
                  ? <div style={{ height:140, background:t.sk, borderRadius:8, animation:"pulse 1.5s infinite" }}/>
                  : <DonutChart data={(data.ipMailType||[]).map(r=>({...r,label:r.mail_type_cd||"Unknown"}))} labelKey="label" valueKey="count" t={t}/>}
              </Card>
            </div>

            {/* Status flow */}
            <Card title="Shipment Status Pipeline" accent="#10b981" t={t} style={{ marginBottom:14 }}>
              {loading
                ? <div style={{ height:200, background:t.sk, borderRadius:8, animation:"pulse 1.5s infinite" }}/>
                : (() => {
                    const rows = data.ipStatusFlow||[];
                    if (!rows.length) return <div style={{ color:t.mu, fontSize:12 }}>No data</div>;
                    const total = rows.reduce((s,r) => s+(parseFloat(r.count)||0), 0)||1;
                    const maxCount = Math.max(...rows.map(r => parseFloat(r.count)||0), 1);
                    return (
                      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                        {rows.map((r,i) => {
                          const val = parseFloat(r.count)||0;
                          const pct = (val/total)*100;
                          const barW = (val/maxCount)*100;
                          const c = statusColor(r.status);
                          return (
                            <div key={i}>
                              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:3 }}>
                                <span style={{ fontSize:11, color:t.s, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1, marginRight:8 }}>{ipStatusLabel(r.status)}</span>
                                <span style={{ fontSize:11, color:c, fontFamily:"monospace", flexShrink:0 }}>
                                  {val.toLocaleString("en-IN")} <span style={{ color:t.mu, fontWeight:400 }}>({pct.toFixed(1)}%)</span>
                                </span>
                              </div>
                              <div style={{ height:14, background:t.sk, borderRadius:3, overflow:"hidden" }}>
                                <div style={{ width:`${barW}%`, height:"100%", background:`${c}cc`, borderRadius:3 }}/>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
            </Card>

            {/* Customs hold — banner + list in one card */}
            <OnHoldList rows={data.ipOnHold||[]} pendingCustoms={pendingCustoms} loading={loading} t={t}/>

            {/* Country + Customers side by side */}
            <div className="grid-2col">
            <Card title="Shipments &amp; Revenue by Country" accent="#06b6d4" t={t}>
              {loading
                ? <div style={{ height:200, background:t.sk, borderRadius:8, animation:"pulse 1.5s infinite" }}/>
                : (() => {
                    const rows = (data.ipCountries||[]).map(r=>({...r,label:countryName(r.destination_country)}));
                    if (!rows.length) return <div style={{ color:t.mu, fontSize:12 }}>No data</div>;
                    const maxCount = Math.max(...rows.map(r=>parseFloat(r.count)||0), 1);
                    const maxRev   = Math.max(...rows.map(r=>parseFloat(r.revenue)||0), 1);
                    return (
                      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                        <div style={{ display:"grid", gridTemplateColumns:"1fr 120px 120px", gap:"0 12px", marginBottom:4 }}>
                          <span style={{ fontSize:10, color:t.mu, fontFamily:"monospace" }}>Country</span>
                          <span style={{ fontSize:10, color:"#06b6d4", fontFamily:"monospace", textAlign:"right" }}>Shipments</span>
                          <span style={{ fontSize:10, color:"#8b5cf6", fontFamily:"monospace", textAlign:"right" }}>Revenue</span>
                        </div>
                        {rows.slice(0,12).map((r,i) => (
                          <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr 120px 120px", gap:"0 12px", alignItems:"center" }}>
                            <span style={{ fontSize:11, color:t.s, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.label}</span>
                            <div style={{ display:"flex", alignItems:"center", gap:5, justifyContent:"flex-end" }}>
                              <div style={{ width:50, height:4, background:t.sk, borderRadius:2, flexShrink:0 }}>
                                <div style={{ width:`${(parseFloat(r.count)||0)/maxCount*100}%`, height:"100%", background:"#06b6d499", borderRadius:2 }}/>
                              </div>
                              <span style={{ fontSize:11, color:t.p, fontFamily:"monospace", flexShrink:0, width:32, textAlign:"right" }}>{fmt.number(r.count)}</span>
                            </div>
                            <span style={{ fontSize:11, color:"#8b5cf6", fontFamily:"monospace", textAlign:"right" }}>{fmt.currency(r.revenue)}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
            </Card>

            <Card title="Top Customers by Shipments &amp; Revenue" accent="#f59e0b" t={t}>
              {loading
                ? <div style={{ height:200, background:t.sk, borderRadius:8, animation:"pulse 1.5s infinite" }}/>
                : (() => {
                    const rows = data.ipCustomers||[];
                    if (!rows.length) return <div style={{ color:t.mu, fontSize:12 }}>No data</div>;
                    const maxCount = Math.max(...rows.map(r=>parseFloat(r.count)||0), 1);
                    const maxRev   = Math.max(...rows.map(r=>parseFloat(r.revenue)||0), 1);
                    return (
                      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                        <div style={{ display:"grid", gridTemplateColumns:"1fr 120px 130px", gap:"0 12px", marginBottom:4 }}>
                          <span style={{ fontSize:10, color:t.mu, fontFamily:"monospace" }}>Customer</span>
                          <span style={{ fontSize:10, color:"#f59e0b", fontFamily:"monospace", textAlign:"right" }}>Shipments</span>
                          <span style={{ fontSize:10, color:"#f97316", fontFamily:"monospace", textAlign:"right" }}>Revenue</span>
                        </div>
                        {rows.slice(0,10).map((r,i) => (
                          <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr 120px 130px", gap:"0 12px", alignItems:"center" }}>
                            <span style={{ fontSize:11, color:t.s, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}><CustLink id={r.customerid} name={r.customer_name}/></span>
                            <div style={{ display:"flex", alignItems:"center", gap:5, justifyContent:"flex-end" }}>
                              <div style={{ width:50, height:4, background:t.sk, borderRadius:2, flexShrink:0 }}>
                                <div style={{ width:`${(parseFloat(r.count)||0)/maxCount*100}%`, height:"100%", background:"#f59e0b99", borderRadius:2 }}/>
                              </div>
                              <span style={{ fontSize:11, color:t.p, fontFamily:"monospace", flexShrink:0, width:32, textAlign:"right" }}>{fmt.number(r.count)}</span>
                            </div>
                            <span style={{ fontSize:11, color:"#f97316", fontFamily:"monospace", textAlign:"right" }}>{fmt.currency(r.revenue)}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
            </Card>
            </div>

            {/* IP TAT distribution */}
            <Card title="IndiaPost TAT Distribution (Pickup → Delivered)" accent="#8b5cf6" t={t} style={{ marginBottom:14 }}>
              {loading
                ? <div style={{ height:120, background:t.sk, borderRadius:8, animation:"pulse 1.5s infinite" }}/>
                : (() => {
                    const rows = data.ipTatDistribution||[];
                    if (!rows.length) return <div style={{ color:t.mu, fontSize:12 }}>No data — try a wider date range</div>;
                    const total = rows.reduce((s,r) => s+(parseFloat(r.shipments)||0), 0);
                    const within14 = rows.filter(r=>r.sort_order<=2).reduce((s,r)=>s+(parseFloat(r.shipments)||0),0);
                    const sla = total>0 ? (within14/total*100).toFixed(1) : null;
                    const max = Math.max(...rows.map(r=>parseFloat(r.shipments)||0), 1);
                    const COLORS = { "1–7d":"#10b981", "8–14d":"#3b82f6", "15–21d":"#f59e0b", "22–28d":"#f97316", "29+d":"#ef4444" };
                    return (
                      <div>
                        <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
                          {sla != null && <div style={{ background:t.sk, borderRadius:8, padding:"8px 16px", textAlign:"center" }}>
                            <div style={{ fontSize:18, fontWeight:700, color: parseFloat(sla)>=80?"#10b981":"#f59e0b", fontFamily:"monospace" }}>{sla}%</div>
                            <div style={{ fontSize:10, color:t.mu, marginTop:2 }}>Delivered ≤14 days</div>
                          </div>}
                          <div style={{ background:t.sk, borderRadius:8, padding:"8px 16px", textAlign:"center" }}>
                            <div style={{ fontSize:18, fontWeight:700, color:t.p, fontFamily:"monospace" }}>{total.toLocaleString("en-IN")}</div>
                            <div style={{ fontSize:10, color:t.mu, marginTop:2 }}>Total delivered</div>
                          </div>
                        </div>
                        <div style={{ display:"flex", alignItems:"flex-end", gap:8, height:100 }}>
                          {rows.map((r,i) => {
                            const val = parseFloat(r.shipments)||0;
                            const pct = (val/max)*100;
                            const color = COLORS[r.bucket]||"#8b5cf6";
                            return (
                              <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", height:"100%" }}>
                                <div style={{ flex:1, width:"100%", display:"flex", alignItems:"flex-end" }}>
                                  <div style={{ width:"100%", background:`${color}33`, borderRadius:"4px 4px 0 0", height:`${pct}%`, minHeight:val>0?4:0, position:"relative" }}>
                                    <div style={{ position:"absolute", bottom:0, left:0, right:0, height:3, background:color, borderRadius:2 }}/>
                                    <div style={{ position:"absolute", top:-18, left:"50%", transform:"translateX(-50%)", fontSize:10, color:t.s, fontFamily:"monospace", whiteSpace:"nowrap" }}>{val.toLocaleString("en-IN")}</div>
                                  </div>
                                </div>
                                <div style={{ fontSize:11, color, fontFamily:"monospace", marginTop:6, fontWeight:600 }}>{r.bucket}</div>
                                <div style={{ fontSize:9, color:t.mu, fontFamily:"monospace" }}>{total>0?(val/total*100).toFixed(0):"0"}%</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
            </Card>

          </>
        );
      })()}

      {/* ── Analytics Tab ── */}
      {activeTab === "analytics" && (() => {
        const totalRev  = parseFloat(data.kpis?.[0]?.total_revenue) || 0;
        const totalOrd  = parseInt(data.kpis?.[0]?.total_orders)    || 0;
        const uniqueCust= parseInt(data.kpis?.[0]?.unique_customers) || 0;

        // Group networkRevenue rows by POE
        const netRows    = data.networkRevenue || [];
        const netGroups  = (() => {
          const map = {};
          netRows.forEach(r => {
            const key = r.network || "Unknown";
            if (!map[key]) map[key] = { network: key, total: 0, services: {} };
            map[key].total += parseFloat(r.revenue) || 0;
            map[key].services[r.service] = (map[key].services[r.service] || 0) + (parseFloat(r.revenue) || 0);
          });
          return Object.values(map).sort((a,b) => b.total - a.total).slice(0, 15);
        })();
        const netMax = Math.max(...netGroups.map(g => g.total), 1);
        const SVC_COLORS = { XL:"#3b82f6", AP:"#8b5cf6", AE:"#f59e0b", IP:"#10b981", IE:"#06b6d4", AN:"#f97316" };

        // WoW data
        const wowRows  = data.weekOnWeek || [];
        const wowMax   = Math.max(...wowRows.map(r => parseFloat(r.revenue) || 0), 1);

        // KAM
        const kamRows  = data.kamRevenue || [];
        const kamTotal = kamRows.reduce((s,r) => s + (parseFloat(r.revenue)||0), 0);
        const kamMax   = Math.max(...kamRows.map(r => parseFloat(r.revenue)||0), 1);

        // Clearance
        const clrRows  = data.clearanceRevenue || [];
        const clrTotal = clrRows.reduce((s,r) => s + (parseFloat(r.revenue)||0), 0);
        const clrMax   = Math.max(...clrRows.map(r => parseFloat(r.revenue)||0), 1);
        const CLR_COLORS = ["#3b82f6","#8b5cf6","#10b981","#f59e0b","#f97316","#06b6d4","#ef4444","#ec4899"];

        // Customer tiers
        const tierRows = data.customerTiers || [];

        // Pickup node
        const nodeRows = data.pickupNodePerf || [];
        const nodeGroups = (() => {
          const map = {};
          nodeRows.forEach(r => {
            const nd = r.service_node || "Unknown";
            if (!map[nd]) map[nd] = { node: nd, total: 0, carriers: {} };
            map[nd].total += parseFloat(r.revenue) || 0;
            const fm = r.fm_carrier || "No FM";
            map[nd].carriers[fm] = (map[nd].carriers[fm] || 0) + (parseFloat(r.revenue) || 0);
          });
          return Object.values(map).sort((a,b) => b.total - a.total);
        })();
        const nodeMax = Math.max(...nodeGroups.map(g => g.total), 1);

        return (
          <>
            {/* Live pickup list */}
            <LivePickupList rows={data.livePickups||[]} loading={loading} t={t}/>

            {/* Shipment alerts: two separate cards side by side */}
            <div className="grid-2col">
              <ExceptionShipmentsCard rows={data.exceptionShipments||[]} loading={loading} t={t}/>
              <StaleShipmentsCard rows={data.staleShipments||[]} boxRows={data.staleBoxes||[]} loading={loading} t={t}/>
            </div>

            {/* Customer signals */}
            <CustomerSignalCard newRows={data.newCustomers||[]} reactivatedRows={data.reactivatedCustomers||[]} loading={loading} t={t}/>

            {/* KPI row */}
            <div className="grid-kpi" style={{ marginBottom:14 }}>
              <KPICard label="Unique Customers"  loading={loading} value={fmt.number(uniqueCust)}  sub="Active shippers" color="#8b5cf6" t={t}/>
              <KPICard label="Total Shipments"   loading={loading} value={fmt.number(totalOrd)}    sub={`${dateRange.start} → ${dateRange.end}`} sparkData={ordSpark} color="#10b981" t={t}/>
              <KPICard label="Total Revenue"     loading={loading} value={fmt.currency(totalRev)}  sub={`${dateRange.start} → ${dateRange.end}`} sparkData={revSpark} color="#3b82f6" t={t}/>
              <KPICard label="Avg Shipment Value" loading={loading} value={fmt.currency(data.kpis?.[0]?.avg_order_value)} sub="Per shipment" color="#f59e0b" t={t}/>
              <KPICard label="KAMs Active"       loading={loading} value={fmt.number(kamRows.filter(r=>r.kam!=="Unassigned").length)} sub="Key account managers" color="#06b6d4" t={t}/>
            </div>

            {/* Row: Network Revenue + Clearance Revenue */}
            <div className="grid-2col">
              <Card title="Network-wise Revenue  ·  by Gateway (POE)" accent="#3b82f6" t={t}>
                {loading
                  ? <div style={{ height:260, background:t.sk, borderRadius:8, animation:"pulse 1.5s infinite" }}/>
                  : netGroups.length === 0
                    ? <div style={{ color:t.mu, fontSize:12 }}>No data</div>
                    : <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                        {netGroups.map((g,i) => {
                          const barW = (g.total / netMax) * 100;
                          const svcs = Object.entries(g.services).sort((a,b) => b[1]-a[1]);
                          return (
                            <div key={i}>
                              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                                <span style={{ fontSize:11, color:t.s, fontFamily:"monospace", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:"50%" }}>{g.network}</span>
                                <div style={{ display:"flex", gap:6, alignItems:"center", flexShrink:0 }}>
                                  {svcs.map(([svc,rev]) => (
                                    <span key={svc} style={{ fontSize:10, color: SVC_COLORS[svc]||t.mu, fontFamily:"monospace", background:`${SVC_COLORS[svc]||t.mu}18`, padding:"1px 5px", borderRadius:4 }}>{svc} {fmt.currency(rev)}</span>
                                  ))}
                                  <span style={{ fontSize:11, color:t.p, fontFamily:"monospace", fontWeight:700 }}>{fmt.currency(g.total)}</span>
                                </div>
                              </div>
                              <div style={{ height:6, background:t.sk, borderRadius:3, overflow:"hidden" }}>
                                {svcs.reduce((acc,  [svc,rev]) => {
                                  const w = (rev/netMax)*100;
                                  acc.els.push(<div key={svc} style={{ width:`${w}%`, height:"100%", background: SVC_COLORS[svc]||"#6b7280", display:"inline-block" }}/>);
                                  return acc;
                                }, { els:[] }).els}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                }
              </Card>

              <Card title="Clearance-wise Revenue  ·  by Destination Clearance Type" accent="#06b6d4" t={t}>
                {loading
                  ? <div style={{ height:260, background:t.sk, borderRadius:8, animation:"pulse 1.5s infinite" }}/>
                  : clrRows.length === 0
                    ? <div style={{ color:t.mu, fontSize:12 }}>No data</div>
                    : <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                        {clrRows.map((r,i) => {
                          const rev = parseFloat(r.revenue)||0;
                          const pct = clrTotal > 0 ? (rev/clrTotal*100) : 0;
                          const barW = (rev/clrMax)*100;
                          const color = CLR_COLORS[i % CLR_COLORS.length];
                          return (
                            <div key={i}>
                              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                                <span style={{ fontSize:11, color:t.s, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:"60%" }}>{r.clearance||"—"}</span>
                                <div style={{ display:"flex", gap:10, flexShrink:0 }}>
                                  <span style={{ fontSize:11, color, fontFamily:"monospace", fontWeight:700 }}>{fmt.currency(rev)}</span>
                                  <span style={{ fontSize:10, color:t.mu, fontFamily:"monospace" }}>{pct.toFixed(1)}%</span>
                                </div>
                              </div>
                              <div style={{ height:5, background:t.sk, borderRadius:3 }}>
                                <div style={{ width:`${barW}%`, height:"100%", background:`${color}99`, borderRadius:3 }}/>
                              </div>
                            </div>
                          );
                        })}
                        <div style={{ borderTop:`1px solid ${t.border}`, paddingTop:6, display:"flex", justifyContent:"space-between" }}>
                          <span style={{ fontSize:11, color:t.mu }}>{clrRows.length} types</span>
                          <span style={{ fontSize:11, color:t.p, fontFamily:"monospace", fontWeight:600 }}>{fmt.currency(clrTotal)}</span>
                        </div>
                      </div>
                }
              </Card>
            </div>

            {/* Row: Week-on-Week + KAM Revenue */}
            <div className="grid-2col">
              <Card title="Week-on-Week Revenue  ·  Rolling 13 weeks" accent="#f59e0b" t={t}>
                {loading
                  ? <div style={{ height:200, background:t.sk, borderRadius:8, animation:"pulse 1.5s infinite" }}/>
                  : wowRows.length === 0
                    ? <div style={{ color:t.mu, fontSize:12 }}>No data</div>
                    : (() => {
                        return (
                          <div>
                            <div style={{ display:"flex", alignItems:"flex-end", gap:4, height:140 }}>
                              {wowRows.map((r,i) => {
                                const rev  = parseFloat(r.revenue)||0;
                                const pct  = (rev/wowMax)*100;
                                const prev = i>0 ? (parseFloat(wowRows[i-1].revenue)||0) : null;
                                const wow  = prev != null && prev > 0 ? ((rev-prev)/prev*100) : null;
                                const color = wow == null ? "#3b82f6" : wow >= 0 ? "#10b981" : "#ef4444";
                                return (
                                  <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", height:"100%", position:"relative" }}
                                    title={`${r.week_start}: ${fmt.currency(rev)}${wow!=null ? ` (${wow>=0?"+":""}${wow.toFixed(1)}% WoW)` : ""}`}>
                                    {wow != null && <div style={{ position:"absolute", top:-14, left:"50%", transform:"translateX(-50%)", fontSize:8, color, fontFamily:"monospace", whiteSpace:"nowrap" }}>{wow>=0?"+":""}{wow.toFixed(0)}%</div>}
                                    <div style={{ flex:1, width:"100%", display:"flex", alignItems:"flex-end" }}>
                                      <div style={{ width:"100%", background:`${color}33`, borderRadius:"3px 3px 0 0", height:`${pct}%`, minHeight:rev>0?4:0, borderBottom:`2px solid ${color}` }}/>
                                    </div>
                                    <div style={{ fontSize:8, color:t.mu, fontFamily:"monospace", marginTop:4, textAlign:"center", overflow:"hidden" }}>{r.week_start}</div>
                                  </div>
                                );
                              })}
                            </div>
                            <div style={{ display:"flex", justifyContent:"space-between", marginTop:8 }}>
                              <span style={{ fontSize:10, color:t.mu }}>{wowRows.length} weeks</span>
                              <span style={{ fontSize:10, color:t.mu, fontFamily:"monospace" }}>Bars: green=WoW↑  red=WoW↓</span>
                            </div>
                          </div>
                        );
                      })()
                }
              </Card>

              <Card title="KAM-wise Revenue  ·  Key Account Managers" accent="#8b5cf6" t={t}>
                {loading
                  ? <div style={{ height:200, background:t.sk, borderRadius:8, animation:"pulse 1.5s infinite" }}/>
                  : kamRows.length === 0
                    ? <div style={{ color:t.mu, fontSize:12 }}>No data</div>
                    : <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
                        {kamRows.map((r,i) => {
                          const rev  = parseFloat(r.revenue)||0;
                          const pct  = kamTotal > 0 ? (rev/kamTotal*100) : 0;
                          const barW = (rev/kamMax)*100;
                          return (
                            <div key={i}>
                              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                                <span style={{ fontSize:11, color: r.kam==="Unassigned" ? t.mu : t.s, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:"55%" }}>{r.kam||"—"}</span>
                                <div style={{ display:"flex", gap:10, flexShrink:0 }}>
                                  <span style={{ fontSize:10, color:t.mu, fontFamily:"monospace" }}>{fmt.number(r.shipments)} ships</span>
                                  <span style={{ fontSize:11, color:"#8b5cf6", fontFamily:"monospace", fontWeight:700 }}>{fmt.currency(rev)}</span>
                                  <span style={{ fontSize:10, color:t.mu, fontFamily:"monospace" }}>{pct.toFixed(1)}%</span>
                                </div>
                              </div>
                              <div style={{ height:4, background:t.sk, borderRadius:2 }}>
                                <div style={{ width:`${barW}%`, height:"100%", background: r.kam==="Unassigned" ? "#6b728088" : "#8b5cf699", borderRadius:2 }}/>
                              </div>
                            </div>
                          );
                        })}
                        <div style={{ borderTop:`1px solid ${t.border}`, paddingTop:6, display:"flex", justifyContent:"space-between" }}>
                          <span style={{ fontSize:11, color:t.mu }}>{kamRows.filter(r=>r.kam!=="Unassigned").length} KAMs</span>
                          <span style={{ fontSize:11, color:t.p, fontFamily:"monospace", fontWeight:600 }}>{fmt.currency(kamTotal)}</span>
                        </div>
                      </div>
                }
              </Card>
            </div>

            {/* Row: Customer Tiers + Pickup Node */}
            <div className="grid-2col">
              <CustomerTiersCard tierRows={data.customerTiers||[]} detailRows={data.customerTierDetail||[]} loading={loading} t={t}/>

              <Card title="Pickup Node Performance  ·  by Service Node & FM Carrier" accent="#10b981" t={t}>
                {loading
                  ? <div style={{ height:180, background:t.sk, borderRadius:8, animation:"pulse 1.5s infinite" }}/>
                  : nodeGroups.length === 0
                    ? <div style={{ color:t.mu, fontSize:12 }}>No data</div>
                    : <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                        {nodeGroups.map((g,i) => {
                          const barW = (g.total/nodeMax)*100;
                          const fms  = Object.entries(g.carriers).sort((a,b)=>b[1]-a[1]);
                          return (
                            <div key={i}>
                              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                                <span style={{ fontSize:12, fontWeight:700, color:t.p }}>{NODE_LABELS_GLOBAL[g.node] || g.node}</span>
                                <span style={{ fontSize:11, color:"#10b981", fontFamily:"monospace", fontWeight:700 }}>{fmt.currency(g.total)}</span>
                              </div>
                              <div style={{ height:6, background:t.sk, borderRadius:3, marginBottom:5 }}>
                                <div style={{ width:`${barW}%`, height:"100%", background:"#10b98188", borderRadius:3 }}/>
                              </div>
                              <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                                {fms.map(([fm,rev]) => (
                                  <span key={fm} style={{ fontSize:10, color:t.mu, background:t.sk, padding:"2px 7px", borderRadius:4, fontFamily:"monospace" }}>
                                    {fm}: {fmt.currency(rev)}
                                  </span>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                }
              </Card>
            </div>
          </>
        );
      })()}

      </div>

      {/* ── Footer ── */}
      <div style={{ borderTop:`1px solid ${t.border}`, background:t.headerBg, padding:"18px 28px", display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8 }}>
        <span style={{ fontSize:11, color:t.mu }}>© 2026 Xindus Trade Networks. All Rights Reserved.</span>
        <span style={{ fontSize:10, color:t.fa, fontFamily:"monospace" }}>
          {lastRefresh ? `Last updated ${lastRefresh.toLocaleTimeString("en-IN")}` : "Loading…"}
        </span>
      </div>
    </div>
  );
}
