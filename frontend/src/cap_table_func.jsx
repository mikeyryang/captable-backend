import { useState, useMemo, useEffect } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { LayoutGrid, Table2, PlusCircle, ShieldAlert, GitBranch, Waves, TrendingUp, Landmark, FileEdit, Star, FileText } from "lucide-react";


// ════════════════════════════════════════════════════════════
// SEED DATA
// ════════════════════════════════════════════════════════════

const TODAY = new Date("2026-06-09");
let NEXT_ID = 20;

const CO = {
  name: "Valkyrie Fund",
  state: "Santa Clara", entity: "LP",
  inc: "2022-03-15",
  auth: { common: 15000000, pref_a: 5000000, pool: 3000000 },
  val409a: 4200000, valDate: "2024-06-01",
  pps: 0.42, ppsA: 1.00,
};

const CLS_COLOR = {
  "Common": "#7F77DD",
  "Series A Preferred": "#1D9E75",
  "ISO": "#378ADD",
  "NSO": "#E8923A",
  "NSO (Advisor)": "#BA7517",
  "Option Pool": "#9CA3AF",
  "RSU": "#D85A30",
  "SAFE": "#C8915A",
  "Warrant": "#64748B",
};

const TYPE_STYLE = {
  founder:  { bg: "#EEEDFE", fg: "#3C3489" },
  investor: { bg: "#E1F5EE", fg: "#085041" },
  employee: { bg: "#E6F1FB", fg: "#0C447C" },
  advisor:  { bg: "#FAEEDA", fg: "#633806" },
  pool:     { bg: "#F1EFE8", fg: "#444441" },
};

const STATUS_COLOR = { ok: "#10B981", warning: "#F59E0B", critical: "#EF4444" };
const STATUS_ICON  = { ok: "✓", warning: "⚠", critical: "⚡" };

const SEC0 = [
  { id:"s1",  holder:"Alice Chen",           type:"founder",  cls:"Common",             shares:3500000, price:0.0001, date:"2022-03-15", vest:{total:3500000,cliff:12,mos:48,start:"2022-03-15"}, f83b:"filed",  cert:"CS-001",   exer:0 },
  { id:"s2",  holder:"Marcus Rivera",         type:"founder",  cls:"Common",             shares:3000000, price:0.0001, date:"2022-03-15", vest:{total:3000000,cliff:12,mos:48,start:"2022-03-15"}, f83b:"filed",  cert:"CS-002",   exer:0 },
  { id:"s3",  holder:"Accel Partners",        type:"investor", cls:"Series A Preferred", shares:2000000, price:1.00,   date:"2023-07-10", vest:null,                                               f83b:null,     cert:"PS-A-001", exer:0, liq:"1× non-participating" },
  { id:"s4",  holder:"First Round Capital",   type:"investor", cls:"Series A Preferred", shares:500000,  price:1.00,   date:"2023-07-10", vest:null,                                               f83b:null,     cert:"PS-A-002", exer:0, liq:"1× non-participating" },
  { id:"s5",  holder:"Y Combinator",          type:"investor", cls:"Series A Preferred", shares:250000,  price:1.00,   date:"2023-07-10", vest:null,                                               f83b:null,     cert:"PS-A-003", exer:0, liq:"1× non-participating" },
  { id:"s6",  holder:"Priya Sharma",          type:"employee", cls:"ISO",                shares:200000,  price:0.42,   date:"2023-09-01", vest:{total:200000,cliff:12,mos:48,start:"2023-09-01"},  f83b:null,     cert:"OPT-001",  exer:0 },
  { id:"s7",  holder:"Jordan Lee",            type:"employee", cls:"ISO",                shares:150000,  price:0.42,   date:"2024-01-15", vest:{total:150000,cliff:12,mos:48,start:"2024-01-15"},  f83b:null,     cert:"OPT-002",  exer:37500 },
  { id:"s8",  holder:"Sam Okonkwo",           type:"employee", cls:"ISO",                shares:75000,   price:0.42,   date:"2024-03-01", vest:{total:75000,cliff:12,mos:48,start:"2024-03-01"},   f83b:null,     cert:"OPT-003",  exer:0 },
  { id:"s9",  holder:"Taylor Kim",            type:"employee", cls:"NSO",                shares:50000,   price:0.42,   date:"2024-04-01", vest:{total:50000,cliff:12,mos:48,start:"2024-04-01"},   f83b:null,     cert:"OPT-004",  exer:0 },
  { id:"s10", holder:"Dr. Wei Zhang",         type:"advisor",  cls:"NSO (Advisor)",      shares:25000,   price:0.42,   date:"2023-06-15", vest:{total:25000,cliff:0,mos:24,start:"2023-06-15"},    f83b:null,     cert:"OPT-005",  exer:0 },
  { id:"s11", holder:"[Option Pool Reserve]", type:"pool",     cls:"Option Pool",        shares:2000000, price:null,   date:"2022-03-15", vest:null,                                               f83b:null,     cert:null,       exer:0 },
];

// ════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════

function mosDiff(a, b) {
  const da = new Date(a), db = b instanceof Date ? b : new Date(b);
  return (db.getFullYear() - da.getFullYear()) * 12 + (db.getMonth() - da.getMonth());
}

function vestedShares(s, asOf = TODAY) {
  if (!s.vest) return s.type === "pool" ? 0 : s.shares;
  const mos = Math.max(0, mosDiff(s.vest.start, asOf));
  if (mos < s.vest.cliff) return 0;
  return Math.min(s.vest.total, Math.floor(s.vest.total * (mos / s.vest.mos)));
}

const fmt   = n => n == null ? "—" : n >= 1e6 ? (n/1e6).toFixed(2)+"M" : n >= 1e3 ? (n/1e3).toFixed(0)+"K" : n.toLocaleString();
const pct   = n => (n * 100).toFixed(2) + "%";
const fmtD  = n => n >= 1e6 ? "$"+(n/1e6).toFixed(2)+"M" : n >= 1e3 ? "$"+(n/1e3).toFixed(0)+"K" : "$"+n.toFixed(2);

// ════════════════════════════════════════════════════════════
// COMPLIANCE ENGINES
// ════════════════════════════════════════════════════════════

function check409a(co) {
  const months = mosDiff(co.valDate, TODAY);
  if (months > 12) return { status:"critical", months, msg:`Valuation is ${months} months old — exceeds the 12-month safe harbor.`, action:"Order a new 409A immediately. Options granted on a stale valuation expose grantees to §409A tax penalties (20% excise + interest)." };
  if (months > 9)  return { status:"warning",  months, msg:`Valuation is ${months} months old — renewal due within 90 days.`, action:"Schedule a 409A refresh before the 12-month mark." };
  return { status:"ok", months, msg:`Valuation is current (${months} months old, within 12-month safe harbor).`, action:null };
}

function checkRule701(secs) {
  const cutoff = new Date(TODAY); cutoff.setFullYear(cutoff.getFullYear() - 1);
  const eligible = secs.filter(s => ["employee","advisor"].includes(s.type) && new Date(s.date) >= cutoff);
  const val = eligible.reduce((acc, s) => acc + s.shares * (s.price || 0), 0);
  if (val > 5e6)  return { status:"critical", val, eligible, msg:`${fmtD(val)} issued in trailing 12 months — enhanced disclosure required.`, action:"You must provide audited financial statements, risk factors, and other disclosures to offerees before any further sales." };
  if (val > 1e6)  return { status:"warning",  val, eligible, msg:`${fmtD(val)} issued — approaching the $5M enhanced-disclosure threshold.`, action:"Track cumulative issuances carefully. Prepare disclosures in advance of the $5M threshold." };
  return { status:"ok", val, eligible, msg:`${fmtD(val)} issued in trailing 12 months — well within the $1M safe harbor.`, action:null };
}

function check83b(secs) {
  const overdue = secs.filter(s => {
    if (!["founder","employee"].includes(s.type) || s.cls !== "Common") return false;
    if (s.f83b === "filed") return false;
    const deadline = new Date(s.date); deadline.setDate(deadline.getDate() + 30);
    return TODAY > deadline;
  });
  const pending = secs.filter(s => {
    if (!["founder","employee"].includes(s.type) || s.cls !== "Common") return false;
    if (s.f83b === "filed") return false;
    const deadline = new Date(s.date); deadline.setDate(deadline.getDate() + 30);
    return TODAY <= deadline;
  });
  if (overdue.length > 0) return { status:"critical", overdue, pending, msg:`${overdue.length} restricted stock grant(s) with expired 83(b) deadlines.`, action:"The 30-day window has passed. Consult a tax attorney immediately — you may have significant ordinary income exposure on future vesting." };
  if (pending.length > 0) return { status:"warning",  overdue, pending, msg:`${pending.length} grant(s) with 83(b) elections due within 30 days.`, action:"File 83(b) elections with the IRS immediately. Deadline is 30 days from grant — no extensions are permitted." };
  return { status:"ok", overdue:[], pending:[], msg:"All restricted stock grants have filed 83(b) elections on time.", action:null };
}

function checkQSBS(co) {
  const incDate = new Date(co.inc);
  const qsbsCutoff = new Date("1993-08-10");
  if (incDate < qsbsCutoff) return { status:"critical", msg:"Incorporated before the §1202 cutoff date (Aug 10, 1993).", action:"QSBS unavailable. Consult tax counsel." };
  const estAssets = 11000000;
  if (estAssets > 50e6) return { status:"critical", msg:`Estimated gross assets ($${(estAssets/1e6).toFixed(0)}M) exceed the $50M §1202 threshold.`, action:"QSBS may be disqualified. Consult tax counsel before issuing more stock." };
  return { status:"ok", estAssets, msg:`Company appears QSBS-eligible: C-corp, assets ~$${(estAssets/1e6).toFixed(1)}M (under $50M), incorporated ${co.inc}.`, action:"Confirm with tax counsel before any secondary sales. 5-year holding periods tracked below." };
}

function checkForm3921(secs, filed = false) {
  const isoExer = secs.filter(s => s.cls === "ISO" && (s.exer || 0) > 0);
  if (filed) return { status:"ok", isoExer:[], msg:"Form 3921 filed for all ISO exercises.", action:null };
  // for example: Jordan exercised in 2025 → Form 3921 due Jan 31, 2026 → TODAY is June 9, 2026 → overdue
  const overdue = isoExer.filter(() => TODAY > new Date("2026-01-31"));
  if (overdue.length > 0) return { status:"critical", isoExer, msg:`${overdue.length} ISO exercise(s) with overdue Form 3921 filings (deadline was Jan 31, 2026).`, action:"File Form 3921 immediately. IRS penalty is $270–$550 per form for late filing after 30 days, with no ceiling for intentional disregard." };
  if (isoExer.length > 0) return { status:"warning",  isoExer, msg:`${isoExer.length} ISO exercise(s) recorded — Form 3921 filing required by Jan 31 of following year.`, action:"Prepare and file Form 3921 with the IRS and furnish a copy to the employee by Jan 31." };
  return { status:"ok", isoExer:[], msg:"No ISO exercises requiring Form 3921.", action:null };
}

// ════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════

export default function CapTableApp() {
  const [view, setView] = useState("dashboard");
  const [secs, setSecs] = useState(() => {
  const saved = localStorage.getItem("captable_secs");
    return saved ? JSON.parse(saved) : SEC0;
  });
  const [valDate, setValDate] = useState(() => localStorage.getItem("captable_valDate") || CO.valDate);
  const [val409a, setVal409a] = useState(() => {
    const saved = localStorage.getItem("captable_val409a");
    return saved ? Number(saved) : CO.val409a;
  });
  const [f3921Filed, setF3921Filed] = useState(() => localStorage.getItem("captable_f3921Filed") === "true");
  const [filter, setFilter] = useState("all");
  const [scenario, setScenario] = useState({ raise: 5000000, preMoney: 15000000 });
  const [exitVal, setExitVal] = useState(25000000);
  const [issueForm, setIssueForm] = useState({ holder:"", type:"employee", cls:"ISO", shares:"", price:"0.42", date:"", cliff:"12", mos:"48" });
  const [issueSuccess, setIssueSuccess] = useState(false);
  useEffect(() => { localStorage.setItem("captable_secs", JSON.stringify(secs)); }, [secs]);
  useEffect(() => { localStorage.setItem("captable_valDate", valDate); }, [valDate]);
  useEffect(() => { localStorage.setItem("captable_val409a", String(val409a)); }, [val409a]);
  useEffect(() => { localStorage.setItem("captable_f3921Filed", String(f3921Filed)); }, [f3921Filed]);

  const stats = useMemo(() => {
    const nonPool = secs.filter(s => s.type !== "pool");
    const issued  = nonPool.reduce((a, s) => a + s.shares, 0);
    const fd      = secs.reduce((a, s) => a + s.shares, 0);
    const auth    = CO.auth.common + CO.auth.pref_a + CO.auth.pool;
    const prefInv = secs.filter(s => s.cls === "Series A Preferred").reduce((a,s) => a + s.shares * s.price, 0);
    return { issued, fd, auth, prefInv };
  }, [secs]);

  const compliance = useMemo(() => ({
  a409:  check409a({ ...CO, valDate, val409a }),
  r701:  checkRule701(secs),
  b83:   check83b(secs),
  qsbs:  checkQSBS(CO),
  f3921: checkForm3921(secs, f3921Filed),
}), [secs, valDate, val409a, f3921Filed]);

  const critCount = useMemo(() =>
    Object.values(compliance).filter(c => c.status === "critical").length, [compliance]);

  const warnCount = useMemo(() =>
    Object.values(compliance).filter(c => c.status === "warning").length, [compliance]);

  const filteredSecs = useMemo(() =>
    filter === "all" ? secs : secs.filter(s => s.type === filter), [secs, filter]);

  const scenarioCalc = useMemo(() => {
    const pps      = scenario.preMoney / stats.fd;
    const newShares = Math.round(scenario.raise / pps);
    const postMoney = scenario.preMoney + scenario.raise;
    const newFD     = stats.fd + newShares;
    const dilution  = newShares / newFD;
    return { pps, newShares, postMoney, newFD, dilution };
  }, [scenario, stats]);

  const waterfallCalc = useMemo(() => {
    const prefInv  = 2750000; // total Series A investment
    const prefShrs = secs.filter(s => s.cls === "Series A Preferred").reduce((a,s) => a+s.shares, 0);
    const comShrs  = secs.filter(s => s.cls === "Common").reduce((a,s) => a+s.shares, 0);
    const optShrs  = secs.filter(s => ["ISO","NSO","NSO (Advisor)"].includes(s.cls)).reduce((a,s) => a+s.shares, 0);
    const totalExclPool = comShrs + prefShrs + optShrs;
    // 1× non-participating: preferred chooses higher of 1× pref OR pro-rata with common
    const prefProRata = exitVal * (prefShrs / totalExclPool);
    const prefConverts = prefProRata > prefInv;
    const prefPayout  = prefConverts ? prefProRata : Math.min(prefInv, exitVal);
    const residual    = prefConverts ? 0 : Math.max(0, exitVal - prefPayout);
    const comFrac     = comShrs / (prefConverts ? totalExclPool : (comShrs + optShrs));
    const optFrac     = optShrs / (prefConverts ? totalExclPool : (comShrs + optShrs));
    return [
      { name:"Series A Preferred", amount: prefPayout,                color:"#1D9E75", note: prefConverts ? "Converted pro-rata" : "1× liquidation preference" },
      { name:"Common (founders)",  amount: prefConverts ? exitVal*(comShrs/totalExclPool) : residual*comFrac, color:"#7F77DD", note:"Pro-rata with options" },
      { name:"Option holders",     amount: prefConverts ? exitVal*(optShrs/totalExclPool) : residual*optFrac, color:"#378ADD", note:"Exercised options only" },
    ];
  }, [exitVal, secs]);

  const ownershipPie = useMemo(() => {
    const map = {};
    secs.forEach(s => {
      const key = s.type === "pool" ? "Option Pool" : s.type === "founder" ? "Founders" : s.type === "investor" ? "Investors" : "Employees & Advisors";
      map[key] = (map[key] || 0) + s.shares;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [secs]);

  function handleIssue() {
    if (!issueForm.holder.trim() || !issueForm.shares || !issueForm.date) return;
    const id = "s" + (NEXT_ID++);
    const hasVest = ["ISO","NSO","NSO (Advisor)","Common","RSU"].includes(issueForm.cls);
    setSecs(prev => [...prev, {
      id, holder: issueForm.holder.trim(),
      type: issueForm.type, cls: issueForm.cls,
      shares: parseInt(issueForm.shares), price: parseFloat(issueForm.price) || 0,
      date: issueForm.date,
      vest: hasVest ? { total: parseInt(issueForm.shares), cliff: parseInt(issueForm.cliff), mos: parseInt(issueForm.mos), start: issueForm.date } : null,
      f83b: issueForm.cls === "Common" ? null : null,
      cert: issueForm.cls.includes("Preferred") ? "PS-"+id : issueForm.cls === "Common" ? "CS-"+id : "OPT-"+id,
      exer: 0,
    }]);
    setIssueForm({ holder:"", type:"employee", cls:"ISO", shares:"", price:"0.42", date:"", cliff:"12", mos:"48" });
    setIssueSuccess(true);
    setTimeout(() => { setIssueSuccess(false); setView("ledger"); }, 1200);
  }

  function handleRemove(id) {
  if (!window.confirm("Remove this security from the cap table? This cannot be undone.")) return;
  setSecs(prev => prev.filter(s => s.id !== id));
  }
  // ── Shared Styles ─────────────────────────
  const S = {
    app:     { display:"flex", height:"calc(100vh - 48px)", fontFamily:"var(--font-sans)", background:"var(--color-background-primary)", overflow:"hidden", borderRadius:12, border:"0.5px solid var(--color-border-tertiary)" },
    sb:      { width:212, background:"#2A1D16", display:"flex", flexDirection:"column", flexShrink:0, borderRadius:"12px 0 0 12px", overflow:"hidden" },
    sbTop:   { padding:"18px 16px 14px", borderBottom:"0.5px solid rgba(255,255,255,0.07)" },
    sbLogo: { fontSize:20, fontWeight:500, color:"#F1F1F3", lineHeight:1.3, marginBottom:2, textShadow:"5 5 15px rgba(167,139,250,0.5)" },
    sbSub:   { fontSize:14, color:"rgba(255,255,255,0.35)" },
    sbBadge: (color) => ({ display:"inline-flex", alignItems:"center", gap:4, marginTop:8, fontSize:11, padding:"3px 8px", borderRadius:4, background: color+"20", color }),
    sbNav:   { flex:1, padding:"10px 0", overflowY:"auto" },
    sbItem:  (a) => ({ display:"flex", alignItems:"center", gap:9, padding:"9px 16px", fontSize:12.5, cursor:"pointer", color: a ? "#E8C9A8" : "rgba(255,255,255,0.48)", background: a ? "rgba(200,145,90,0.14)" : "transparent", borderLeft: a ? "2px solid #C8915A" : "2px solid transparent", transition:"all .12s", userSelect:"none" }),
    sbFoot:  { padding:"12px 16px", borderTop:"0.5px solid rgba(255,255,255,0.07)" },
    sbCLabel:{ fontSize:9.5, color:"rgba(255,255,255,0.28)", letterSpacing:".07em", textTransform:"uppercase", marginBottom:8 },
    sbCheck: { display:"flex", alignItems:"center", gap:7, marginBottom:6, fontSize:11, color:"rgba(255,255,255,0.42)", cursor:"pointer" },
    dot:     (st) => ({ width:6, height:6, borderRadius:"50%", background: STATUS_COLOR[st], flexShrink:0, boxShadow: st==="critical" ? `0 0 5px ${STATUS_COLOR[st]}80` : "none" }),
    main:    { flex:1, display:"flex", flexDirection:"column", overflow:"hidden" },
    topbar:  { display:"flex", alignItems:"center", padding:"12px 22px", borderBottom:"0.5px solid var(--color-border-secondary)", gap:12, flexShrink:0 },
    tbTitle: { fontSize:14, fontWeight:500, color:"var(--color-text-primary)", flex:1 },
    tbMeta:  { fontSize:11, color:"var(--color-text-tertiary)", fontVariantNumeric:"tabular-nums" },
    content: { flex:1, overflow:"auto", padding:"18px 22px" },
    card:    { background:"var(--color-background-primary)", border:"0.5px solid var(--color-border-tertiary)", borderRadius:10, padding:"14px 16px", marginBottom:12 },
    cardH:   { fontSize:11, color:"var(--color-text-secondary)", marginBottom:3, fontWeight:500, letterSpacing:".02em" },
    cardV:   { fontSize:22, fontWeight:500, color:"var(--color-text-primary)", fontVariantNumeric:"tabular-nums" },
    cardSub: { fontSize:11, color:"var(--color-text-tertiary)", marginTop:2 },
    grid4:   { display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:9, marginBottom:14 },
    grid2:   { display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 },
    secH:    { fontSize:12, fontWeight:500, color:"var(--color-text-secondary)", marginBottom:10, display:"flex", alignItems:"center", justifyContent:"space-between" },
    badge:   (t) => ({ fontSize:10, padding:"2px 7px", borderRadius:4, fontWeight:500, background:(TYPE_STYLE[t]||{bg:"#eee"}).bg, color:(TYPE_STYLE[t]||{fg:"#333"}).fg }),
    clsBadge:(c) => ({ fontSize:10, padding:"2px 7px", borderRadius:4, fontWeight:500, background:(CLS_COLOR[c]||"#9CA3AF")+"22", color:(CLS_COLOR[c]||"#9CA3AF") }),
    statPill:(st) => ({ fontSize:10.5, padding:"2px 8px", borderRadius:4, fontWeight:500, background:STATUS_COLOR[st]+"18", color:STATUS_COLOR[st] }),
    tbl:     { width:"100%", borderCollapse:"collapse", fontSize:12 },
    th:      { padding:"8px 10px", textAlign:"left", color:"var(--color-text-secondary)", fontWeight:500, borderBottom:"0.5px solid var(--color-border-tertiary)", whiteSpace:"nowrap", fontSize:11 },
    trr:     (i) => ({ background: i%2===0 ? "transparent" : "var(--color-background-secondary)", borderBottom:"0.5px solid var(--color-border-tertiary)" }),
    td:      { padding:"8px 10px", color:"var(--color-text-primary)", verticalAlign:"middle" },
    input:   { width:"100%", padding:"8px 10px", border:"0.5px solid var(--color-border-secondary)", borderRadius:8, fontSize:13, background:"var(--color-background-primary)", color:"var(--color-text-primary)", boxSizing:"border-box", outline:"none" },
    select:  { width:"100%", padding:"8px 10px", border:"0.5px solid var(--color-border-secondary)", borderRadius:8, fontSize:13, background:"var(--color-background-primary)", color:"var(--color-text-primary)", boxSizing:"border-box", outline:"none" },
    label:   { fontSize:12, color:"var(--color-text-secondary)", marginBottom:4, display:"block", fontWeight:500 },
    fg2:     { display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 },
    btn:     { padding:"9px 18px", background: "#C8915A", color:"white", border:"none", borderRadius:8, fontSize:13, cursor:"pointer", fontWeight:500 },
    btnGhost:{ padding:"7px 14px", background:"transparent", color:"var(--color-text-secondary)", border:"0.5px solid var(--color-border-secondary)", borderRadius:8, fontSize:12, cursor:"pointer" },
    slider:  { width:"100%", accentColor:"#C8915A" },
    warnBox: (color) => ({ padding:"10px 12px", background:color+"15", borderRadius:6, fontSize:12, marginBottom:12, color }),
    flag:    (color) => ({ fontSize:10, padding:"1px 5px", borderRadius:3, background:color+"18", color }),
    vestBar: { height:4, background:"var(--color-border-tertiary)", borderRadius:2, width:52, overflow:"hidden", position:"relative" },
  };

  const CHECKS = [
    { k:"a409",  label:"409A valuation" },
    { k:"r701",  label:"Rule 701" },
    { k:"b83",   label:"83(b) elections" },
    { k:"qsbs",  label:"QSBS §1202" },
    { k:"f3921", label:"Form 3921" },
  ];

  const NAV = [
  { id:"dashboard",  label:"Overview",       icon:LayoutGrid },
  { id:"ledger",     label:"Cap Table",       icon:Table2 },
  { id:"issue",      label:"Issue Security",  icon:PlusCircle },
  { id:"compliance", label:"Compliance",      icon:ShieldAlert, badge: critCount+warnCount },
  { id:"model",      label:"Model Round",     icon:GitBranch },
  { id:"waterfall",  label:"Waterfall",       icon:Waves },
  ];

  // VIEW: DASHBOARD
  // ═══════════════════════════════════
  const Dashboard = () => {
    const PIE_COLORS = { "Founders":"#7F77DD", "Investors":"#1D9E75", "Employees & Advisors":"#378ADD", "Option Pool":"#9CA3AF" };
    return (
      <div>
        <div style={S.grid4}>
          {[
            { h:"Fully diluted shares", v:fmt(stats.fd),      sub:`${fmt(CO.auth.common+CO.auth.pref_a+CO.auth.pool)} authorized` },
            { h:"Issued & outstanding", v:fmt(stats.issued),  sub:pct(stats.issued/(CO.auth.common+CO.auth.pref_a+CO.auth.pool))+" of authorized" },
            { h:"Post-money (Series A)", v:fmtD(11000000),   sub:"Jul 2023 · $1.00 PPS" },
            { h:"409A fair market value", v:fmtD(CO.val409a), sub:`$${CO.pps}/share · ${mosDiff(CO.valDate, TODAY)}mo old` },
          ].map((m,i) => (
            <div key={i} style={S.card}>
              <div style={S.cardH}>{m.h}</div>
              <div style={S.cardV}>{m.v}</div>
              <div style={S.cardSub}>{m.sub}</div>
            </div>
          ))}
        </div>

        <div style={S.grid2}>
          <div style={S.card}>
            <div style={S.secH}>Ownership (fully diluted)</div>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={ownershipPie} dataKey="value" cx="45%" cy="50%" innerRadius={45} outerRadius={72} paddingAngle={2}>
                  {ownershipPie.map((e,i) => <Cell key={i} fill={PIE_COLORS[e.name] || "#9CA3AF"} />)}
                </Pie>
                <Tooltip formatter={(v,n) => [fmt(v)+" shares ("+pct(v/stats.fd)+")", n]} contentStyle={{ fontSize:11, borderRadius:6 }} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display:"flex", flexWrap:"wrap", gap:10, marginTop:2 }}>
              {ownershipPie.map(d => (
                <span key={d.name} style={{ fontSize:11, display:"flex", alignItems:"center", gap:5, color:"var(--color-text-secondary)" }}>
                  <span style={{ width:8, height:8, borderRadius:2, background:PIE_COLORS[d.name]||"#9CA3AF", flexShrink:0 }}/>
                  {d.name} <span style={{ color:"var(--color-text-primary)", fontWeight:500 }}>{pct(d.value/stats.fd)}</span>
                </span>
              ))}
            </div>
          </div>

          <div style={S.card}>
            <div style={S.secH}>
              <span>Compliance health</span>
              {critCount > 0 && <span style={S.statPill("critical")}>⚡ {critCount} critical</span>}
            </div>
            {CHECKS.map(({ k, label }) => {
              const c = compliance[k];
              return (
                <div key={k} onClick={() => setView("compliance")} style={{ display:"flex", alignItems:"center", gap:9, padding:"7px 0", borderBottom:"0.5px solid var(--color-border-tertiary)", cursor:"pointer" }}>
                  <div style={S.dot(c.status)}/>
                  <div style={{ flex:1, fontSize:12 }}>{label}</div>
                  <span style={S.statPill(c.status)}>{STATUS_ICON[c.status]} {c.status === "ok" ? "Clean" : c.status.charAt(0).toUpperCase()+c.status.slice(1)}</span>
                </div>
              );
            })}
            <button onClick={() => setView("compliance")} style={{ ...S.btnGhost, marginTop:10, width:"100%", textAlign:"center", fontSize:12 }}>
              View all compliance details →
            </button>
          </div>
        </div>

        <div style={S.card}>
          <div style={S.secH}>Funding history</div>
          {[
            { round:"Incorporation", date:"Mar 2022", amount:"$1,300",  shares:"6,500,000 founder common shares", color:"#7F77DD", label:"F" },
            { round:"Series A",      date:"Jul 2023", amount:"$2.75M",  shares:"2,750,000 Series A Preferred @ $1.00/share · $11M post-money", color:"#1D9E75", label:"A" },
          ].map((r,i) => (
            <div key={i} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 0", borderBottom: i===0 ? "0.5px solid var(--color-border-tertiary)" : "none" }}>
              <div style={{ width:36, height:36, borderRadius:8, background:r.color, display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontSize:13, fontWeight:600, flexShrink:0 }}>{r.label}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:500 }}>{r.round}</div>
                <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginTop:1 }}>{r.shares}</div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontSize:13, fontWeight:500, fontVariantNumeric:"tabular-nums" }}>{r.amount}</div>
                <div style={{ fontSize:11, color:"var(--color-text-tertiary)" }}>{r.date}</div>
              </div>
            </div>
          ))}
          <button onClick={() => setView("model")} style={{ ...S.btnGhost, marginTop:10, fontSize:12, width:"100%", textAlign:"center" }}>
            Model a new round →
          </button>
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════
  // VIEW: CAP TABLE LEDGER
  // ═══════════════════════════════════
  const Ledger = () => {
    const basicTotal = secs.filter(s => s.type !== "pool").reduce((a,s) => a+s.shares, 0);
    return (
      <div>
        <div style={{ display:"flex", gap:6, marginBottom:14, flexWrap:"wrap", alignItems:"center" }}>
          {["all","founder","investor","employee","advisor","pool"].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ padding:"5px 11px", borderRadius:6, fontSize:12, cursor:"pointer", fontWeight: filter===f ? 500 : 400, background: filter===f ? "#C8915A" : "var(--color-background-secondary)", color: filter===f ? "white" : "var(--color-text-secondary)", border: "0.5px solid " + (filter===f ? "#C8915A" : "var(--color-border-tertiary)"), transition:"all .12s" }}>
              {f[0].toUpperCase()+f.slice(1)}
            </button>
          ))}
          <div style={{ flex:1 }}/>
          <button onClick={() => setView("issue")} style={{ ...S.btn, padding:"6px 14px", fontSize:12 }}>+ Issue security</button>
        </div>

        <div style={{ overflowX:"auto" }}>
          <table style={S.tbl}>
            <thead>
              <tr>
                {["Holder","Type","Security","Shares","Vested","Basic %","FD %","Flags","Actions"].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredSecs.map((s, i) => {
                const v = vestedShares(s);
                const vPct = s.vest ? Math.round(v / s.vest.total * 100) : (s.type === "pool" ? 0 : 100);
                const basicPct = s.type === "pool" ? null : s.shares / basicTotal;
                const fdPct = s.shares / stats.fd;
                const flags = [];
                if (s.type === "founder" && s.cls === "Common" && !s.f83b) flags.push({ l:"83(b) needed", c:"#F59E0B" });
                if (s.cls === "ISO" && (s.exer||0) > 0) flags.push({ l:`3921 overdue`, c:"#EF4444" });
                if (s.vest && vPct < 100 && vPct > 0) flags.push({ l:vPct+"% vested", c:"#C8915A" });
                if (s.vest && vPct === 0) flags.push({ l:"Pre-cliff", c:"#9CA3AF" });
                if (s.vest && vPct === 100) flags.push({ l:"Fully vested", c:"#10B981" });
                return (
                  <tr key={s.id} style={S.trr(i)}>
                    <td style={S.td}>
                      <div style={{ fontWeight:500, fontSize:12 }}>{s.holder}</div>
                      {s.cert && <div style={{ fontSize:10, color:"var(--color-text-tertiary)" }}>{s.cert}</div>}
                    </td>
                    <td style={S.td}><span style={S.badge(s.type)}>{s.type}</span></td>
                    <td style={S.td}><span style={S.clsBadge(s.cls)}>{s.cls}</span></td>
                    <td style={{ ...S.td, fontVariantNumeric:"tabular-nums" }}>
                      <div>{fmt(s.shares)}</div>
                      {s.price != null && <div style={{ fontSize:10, color:"var(--color-text-tertiary)" }}>@${s.price.toFixed(4)}</div>}
                    </td>
                    <td style={S.td}>
                      {s.vest ? (
                        <div>
                          <div style={S.vestBar}>
                            <div style={{ position:"absolute", top:0, left:0, height:"100%", width:vPct+"%", background:CLS_COLOR[s.cls]||"#C8915A", borderRadius:2 }}/>
                          </div>
                          <div style={{ fontSize:10, color:"var(--color-text-tertiary)", marginTop:2 }}>{fmt(v)} / {fmt(s.vest.total)}</div>
                        </div>
                      ) : <span style={{ fontSize:11, color:"var(--color-text-tertiary)" }}>—</span>}
                    </td>
                    <td style={{ ...S.td, fontVariantNumeric:"tabular-nums" }}>{basicPct != null ? pct(basicPct) : "—"}</td>
                    <td style={{ ...S.td, fontVariantNumeric:"tabular-nums" }}>{pct(fdPct)}</td>
                    <td style={S.td}>
                      <div style={{ display:"flex", gap:3, flexWrap:"wrap" }}>
                        {flags.map((f,fi) => <span key={fi} style={S.flag(f.c)}>{f.l}</span>)}
                      </div>
                    </td>
                    <td style={S.td}>
                       <button onClick={() => handleRemove(s.id)} style={{ ...S.btnGhost, padding:"4px 10px", fontSize:11, color:"#EF4444", borderColor:"#EF444440" }}>
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background:"var(--color-background-secondary)" }}>
                <td style={{ ...S.td, fontWeight:500 }}>Totals</td>
                <td style={S.td}><span style={{ fontSize:11, color:"var(--color-text-tertiary)" }}>{filteredSecs.length} rows</span></td>
                <td style={S.td}/>
                <td style={{ ...S.td, fontWeight:500, fontVariantNumeric:"tabular-nums" }}>{fmt(filteredSecs.reduce((a,s)=>a+s.shares,0))}</td>
                <td style={S.td}/>
                <td style={{ ...S.td, fontWeight:500, fontVariantNumeric:"tabular-nums" }}>100%</td>
                <td style={{ ...S.td, fontWeight:500, fontVariantNumeric:"tabular-nums" }}>{pct(filteredSecs.reduce((a,s)=>a+s.shares,0)/stats.fd)}</td>
                <td style={S.td}/>
              </tr>
            </tfoot>
          </table>
        </div>

        <div style={{ display:"flex", gap:10, marginTop:10, flexWrap:"wrap" }}>
          {Object.entries(CLS_COLOR).map(([cls, color]) => {
            const total = secs.filter(s => s.cls === cls).reduce((a,s) => a+s.shares, 0);
            if (!total) return null;
            return (
              <span key={cls} style={{ fontSize:11, display:"flex", alignItems:"center", gap:4, color:"var(--color-text-secondary)" }}>
                <span style={{ width:8, height:8, borderRadius:2, background:color, flexShrink:0 }}/>
                {cls}: {fmt(total)} ({pct(total/stats.fd)})
              </span>
            );
          })}
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════
  // VIEW: COMPLIANCE
  // ═══════════════════════════════════
  const Compliance = () => {
    const DETAIL = [
      {
        k:"a409", title:"409A Valuation", icon:"📈",
        law:"IRC §409A",
        desc:"Options must be granted at or above fair market value. The IRS requires a qualified independent appraisal at least every 12 months (or upon a material event such as a new funding round, IPO, or acquisition discussion)."
      },
      {
        k:"r701", title:"Rule 701 (Reg. D)", icon:"🏛",
        law:"SEC Rule 701",
        desc:"Rule 701 exempts offers and sales of securities under a written compensatory plan from SEC registration. If aggregate issuances exceed $10M in 12 months, you must deliver specified disclosures. Below $1M is an absolute safe harbor."
      },
      {
        k:"b83", title:"83(b) Elections", icon:"📝",
        law:"IRC §83(b)",
        desc:"Allows holders of unvested restricted stock to elect to be taxed at grant date (lower value) rather than vesting date. Must be filed with the IRS within 30 days of the grant — no extensions exist. Missing this deadline is irreversible."
      },
      {
        k:"qsbs", title:"QSBS (§1202)", icon:"⭐",
        law:"IRC §1202",
        desc:"Qualified Small Business Stock can provide up to $10M (or 10× basis) in federal capital gains exclusion. Requirements: C-corp, original issuance, ≤$50M gross assets at issuance, active trade/business, and 5-year holding period."
      },
      {
        k:"f3921", title:"Form 3921", icon:"📋",
        law:"IRC §6039",
        desc:"Companies must file Form 3921 with the IRS and furnish a copy to employees for each ISO exercise, by January 31 of the following year. Penalty: $270–$550 per form for late filing; no cap for intentional disregard."
      },
    ];

    return (
      <div>
        {critCount > 0 && (
          <div style={{ ...S.card, borderLeft:"3px solid #EF4444", marginBottom:14 }}>
            <div style={{ fontSize:13, fontWeight:500, color:"#EF4444", marginBottom:4 }}>⚡ {critCount} critical issue{critCount!==1?"s":""} require immediate action</div>
            <div style={{ fontSize:12, color:"var(--color-text-secondary)", lineHeight:1.6 }}>Unresolved compliance issues can expose your company and officers to IRS penalties (up to 20% excise tax + interest under §409A), SEC enforcement, and potential QSBS disqualification. Consult your legal and tax advisors immediately.</div>
          </div>
        )}

        {DETAIL.map(({ k, title, icon, law, desc }) => {
          const c = compliance[k];
          return (
            <div key={k} style={S.card}>
              <div style={{ display:"flex", alignItems:"flex-start", gap:12 }}>
                <div style={{ width:36, height:36, borderRadius:8, background:STATUS_COLOR[c.status]+"18", color:STATUS_COLOR[c.status], display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>{icon}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4, flexWrap:"wrap" }}>
                    <div style={{ fontSize:13, fontWeight:500 }}>{title}</div>
                    <span style={{ fontSize:10, padding:"1px 6px", borderRadius:4, background:"var(--color-background-secondary)", color:"var(--color-text-tertiary)", border:"0.5px solid var(--color-border-tertiary)" }}>{law}</span>
                    <span style={S.statPill(c.status)}>{STATUS_ICON[c.status]} {c.status === "ok" ? "Clean" : c.status.charAt(0).toUpperCase()+c.status.slice(1)}</span>
                  </div>
                  <div style={{ fontSize:11, color:"var(--color-text-tertiary)", marginBottom:8, lineHeight:1.55 }}>{desc}</div>
                  <div style={{ fontSize:12, color:"var(--color-text-primary)", marginBottom: c.action ? 6 : 0 }}>
                    <strong>Status:</strong> {c.msg}
                  </div>
                  {c.action && (
                    <div style={{ fontSize:12, padding:"8px 10px", background:STATUS_COLOR[c.status]+"12", border:`0.5px solid ${STATUS_COLOR[c.status]}40`, borderRadius:6, color:STATUS_COLOR[c.status], lineHeight:1.5 }}>
                      <strong>Action required:</strong> {c.action}
                    </div>
                  )}
                  {k === "a409" && c.status !== "ok" && (
                    <button style={{ ...S.btn, marginTop:10, fontSize:12 }} onClick={() => { setValDate(TODAY.toISOString().slice(0,10)); setVal409a(5800000); }}>
                      Order new 409A valuation →
                    </button>
                  )}
                  {k === "f3921" && c.status !== "ok" && (
                    <button style={{ ...S.btn, marginTop:10, fontSize:12 }} onClick={() => setF3921Filed(true)}>
                      Mark Form 3921 as filed →
                    </button>
                  )}
                </div>
              </div>

              {k === "r701" && (
                <div style={{ marginTop:10, paddingTop:10, borderTop:"0.5px solid var(--color-border-tertiary)" }}>
                  <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginBottom:8 }}>Trailing 12-month issuances vs. thresholds</div>
                  <div style={{ display:"flex", gap:12 }}>
                    {[{ label:"$1M safe harbor", limit:1e6 }, { label:"$5M enhanced disclosure", limit:5e6 }, { label:"$10M offering limit", limit:1e7 }].map(t => {
                      const p = Math.min(100, (c.val / t.limit) * 100);
                      return (
                        <div key={t.label} style={{ flex:1 }}>
                          <div style={{ fontSize:10, color:"var(--color-text-tertiary)", marginBottom:3 }}>{t.label}</div>
                          <div style={{ height:5, background:"var(--color-border-tertiary)", borderRadius:3 }}>
                            <div style={{ height:5, width:p+"%", background: p > 80 ? "#EF4444" : p > 50 ? "#F59E0B" : "#10B981", borderRadius:3, transition:"width .3s" }}/>
                          </div>
                          <div style={{ fontSize:10, color:"var(--color-text-tertiary)", marginTop:2 }}>{p.toFixed(1)}% used</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {k === "qsbs" && (
                <div style={{ marginTop:10, paddingTop:10, borderTop:"0.5px solid var(--color-border-tertiary)" }}>
                  <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginBottom:8 }}>5-year holding period milestones (original issuance dates)</div>
                  {[
                    { holder:"Alice Chen & Marcus Rivera", acq:"2022-03-15", fiveYear:"2027-03-15" },
                    { holder:"Accel Partners (Series A)", acq:"2023-07-10", fiveYear:"2028-07-10" },
                    { holder:"First Round Capital",        acq:"2023-07-10", fiveYear:"2028-07-10" },
                  ].map(h => {
                    const fiveYearDate = new Date(h.fiveYear);
                    const done = TODAY >= fiveYearDate;
                    const remaining = done ? 0 : mosDiff(TODAY, fiveYearDate);
                    const progress = done ? 100 : Math.round(((60 - remaining) / 60) * 100);
                    return (
                      <div key={h.holder} style={{ marginBottom:8 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                          <span style={{ fontSize:11, color:"var(--color-text-primary)" }}>{h.holder}</span>
                          <span style={{ fontSize:11, color: done ? "#10B981" : "var(--color-text-secondary)" }}>{done ? "✓ Achieved" : `${remaining}mo remaining · ${h.fiveYear}`}</span>
                        </div>
                        <div style={{ height:4, background:"var(--color-border-tertiary)", borderRadius:2 }}>
                          <div style={{ height:4, width:progress+"%", background: done ? "#10B981" : "#C8915A", borderRadius:2 }}/>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {k === "f3921" && c.isoExer.length > 0 && (
                <div style={{ marginTop:10, paddingTop:10, borderTop:"0.5px solid var(--color-border-tertiary)" }}>
                  <div style={{ fontSize:11, color:"var(--color-text-secondary)", marginBottom:6 }}>ISO exercises requiring Form 3921</div>
                  {secs.filter(s => s.cls === "ISO" && (s.exer||0) > 0).map(s => (
                    <div key={s.id} style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 0", fontSize:11 }}>
                      <div style={S.dot("critical")}/>
                      <div style={{ flex:1 }}>{s.holder}</div>
                      <div style={{ color:"var(--color-text-secondary)" }}>{fmt(s.exer)} shares exercised</div>
                      <span style={S.flag("#EF4444")}>3921 overdue</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // ═══════════════════════════════════
  // VIEW: ROUND MODELING
  // ═══════════════════════════════════
  const Model = () => {
    const { pps, newShares, postMoney, newFD, dilution } = scenarioCalc;
    const rows = [
      { holder:"Alice Chen",        shares:3500000 },
      { holder:"Marcus Rivera",     shares:3000000 },
      { holder:"Accel Partners",    shares:2000000 },
      { holder:"First Round Capital",shares:500000 },
      { holder:"Y Combinator",      shares:250000 },
      { holder:"Employees & Advisors",shares:500000 },
      { holder:"Option Pool",       shares:2000000 },
      { holder:"New investor",      shares:newShares, isNew:true },
    ];
    return (
      <div>
        <div style={S.grid2}>
          <div style={S.card}>
            <div style={S.secH}>New round parameters</div>
            <div style={{ marginBottom:16 }}>
              <label style={S.label}>Raise amount</label>
              <input type="range" min={500000} max={20000000} step={250000} value={scenario.raise} onChange={e => setScenario(p => ({...p, raise:+e.target.value}))} style={S.slider}/>
              <div style={{ display:"flex", justifyContent:"space-between", marginTop:4 }}>
                <span style={{ fontSize:10, color:"var(--color-text-tertiary)" }}>$500K</span>
                <span style={{ fontSize:14, fontWeight:500, fontVariantNumeric:"tabular-nums" }}>{fmtD(scenario.raise)}</span>
                <span style={{ fontSize:10, color:"var(--color-text-tertiary)" }}>$20M</span>
              </div>
            </div>
            <div>
              <label style={S.label}>Pre-money valuation</label>
              <input type="range" min={5000000} max={100000000} step={1000000} value={scenario.preMoney} onChange={e => setScenario(p => ({...p, preMoney:+e.target.value}))} style={S.slider}/>
              <div style={{ display:"flex", justifyContent:"space-between", marginTop:4 }}>
                <span style={{ fontSize:10, color:"var(--color-text-tertiary)" }}>$5M</span>
                <span style={{ fontSize:14, fontWeight:500, fontVariantNumeric:"tabular-nums" }}>{fmtD(scenario.preMoney)}</span>
                <span style={{ fontSize:10, color:"var(--color-text-tertiary)" }}>$100M</span>
              </div>
            </div>
          </div>

          <div style={S.card}>
            <div style={S.secH}>Round results (live)</div>
            {[
              { l:"Post-money valuation",   v:fmtD(postMoney) },
              { l:"New preferred PPS",       v:"$"+pps.toFixed(4) },
              { l:"New shares to issue",     v:fmt(Math.round(newShares)) },
              { l:"Total FD post-round",     v:fmt(Math.round(newFD)) },
              { l:"Dilution to current holders", v:pct(dilution), warn: dilution > 0.25 },
              { l:"New investor ownership",  v:pct(newShares/newFD) },
            ].map((m,i) => (
              <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom:"0.5px solid var(--color-border-tertiary)", fontSize:12 }}>
                <span style={{ color:"var(--color-text-secondary)" }}>{m.l}</span>
                <span style={{ fontWeight:500, fontVariantNumeric:"tabular-nums", color: m.warn ? "#EF4444" : "var(--color-text-primary)" }}>{m.v}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={S.card}>
          <div style={S.secH}>Ownership table: before vs. after</div>
          <table style={S.tbl}>
            <thead>
              <tr>
                {["Holder","Shares","Before (FD%)","After (FD%)","Δ Change"].map(h => <th key={h} style={S.th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r,i) => {
                const before = r.shares / stats.fd;
                const after  = r.shares / newFD;
                const delta  = after - before;
                return (
                  <tr key={r.holder} style={{ ...S.trr(i), ...(r.isNew ? { background:"rgba(200,145,90,0.08)" } : {}) }}>
                    <td style={{ ...S.td, fontWeight: r.isNew ? 500 : 400, color: r.isNew ? "#C8915A" : "var(--color-text-primary)" }}>
                      {r.isNew ? "★ " : ""}{r.holder}
                    </td>
                    <td style={{ ...S.td, fontVariantNumeric:"tabular-nums" }}>{r.isNew ? fmt(Math.round(newShares)) : fmt(r.shares)}</td>
                    <td style={{ ...S.td, fontVariantNumeric:"tabular-nums" }}>{r.isNew ? "—" : pct(before)}</td>
                    <td style={{ ...S.td, fontVariantNumeric:"tabular-nums" }}>{pct(after)}</td>
                    <td style={{ ...S.td, fontVariantNumeric:"tabular-nums", color: r.isNew ? "#C8915A" : delta < -0.001 ? "#EF4444" : "#10B981" }}>
                      {r.isNew ? "New" : ((delta * 100).toFixed(2) + "%")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ fontSize:11, color:"var(--color-text-tertiary)", marginTop:10, padding:"8px 10px", background:"var(--color-background-secondary)", borderRadius:6 }}>
            Model assumes new investor purchases newly issued preferred shares at the pre-money PPS. Option pool not expanded in this scenario.
          </div>
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════
  // VIEW: WATERFALL
  // ═══════════════════════════════════
  const Waterfall = () => {
    const total = waterfallCalc.reduce((a,w) => a+w.amount, 0);
    const prefInv = 2750000;
    const breakeven = prefInv * (stats.fd / secs.filter(s=>s.cls==="Series A Preferred").reduce((a,s)=>a+s.shares,0));
    return (
      <div>
        <div style={S.card}>
          <div style={S.secH}>
            <span>Exit valuation scenario</span>
            {exitVal < prefInv && <span style={S.statPill("critical")}>Below liquidation preference</span>}
            {exitVal > breakeven && <span style={S.statPill("ok")}>Preferred converts to common</span>}
          </div>
          <input type="range" min={1000000} max={100000000} step={500000} value={exitVal} onChange={e => setExitVal(+e.target.value)} style={S.slider}/>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:8 }}>
            <span style={{ fontSize:11, color:"var(--color-text-tertiary)" }}>$1M</span>
            <div style={{ textAlign:"center" }}>
              <div style={{ fontSize:24, fontWeight:500, fontVariantNumeric:"tabular-nums" }}>{fmtD(exitVal)}</div>
              <div style={{ fontSize:11, color:"var(--color-text-secondary)" }}>total exit proceeds</div>
            </div>
            <span style={{ fontSize:11, color:"var(--color-text-tertiary)" }}>$100M</span>
          </div>
          <div style={{ marginTop:10, padding:"8px 12px", background:"var(--color-background-secondary)", borderRadius:6, fontSize:11, color:"var(--color-text-secondary)" }}>
            Series A invested: <strong>{fmtD(prefInv)}</strong> · 1× liquidation preference: converts to pro-rata common if exit exceeds <strong>{fmtD(breakeven)}</strong>
          </div>
        </div>

        <div style={S.grid2}>
          <div style={S.card}>
            <div style={S.secH}>Proceeds by class</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={waterfallCalc} margin={{ top:4, right:8, left:0, bottom:20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-tertiary)" vertical={false}/>
                <XAxis dataKey="name" tick={{ fontSize:9 }} angle={-12} textAnchor="end"/>
                <YAxis tickFormatter={v => fmtD(v)} tick={{ fontSize:9 }}/>
                <Tooltip formatter={v => [fmtD(v), "Payout"]} contentStyle={{ fontSize:11, borderRadius:6 }}/>
                <Bar dataKey="amount" radius={[4,4,0,0]}>
                  {waterfallCalc.map((e,i) => <Cell key={i} fill={e.color}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={S.card}>
            <div style={S.secH}>Distribution table</div>
            {waterfallCalc.map((w,i) => (
              <div key={i} style={{ padding:"10px 0", borderBottom: i<waterfallCalc.length-1 ? "0.5px solid var(--color-border-tertiary)" : "none" }}>
                <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                  <div style={{ width:10, height:10, borderRadius:2, background:w.color, flexShrink:0 }}/>
                  <div style={{ fontSize:12, fontWeight:500 }}>{w.name}</div>
                  <span style={{ fontSize:10, color:"var(--color-text-tertiary)", marginLeft:"auto" }}>{w.note}</span>
                </div>
                <div style={{ fontSize:22, fontWeight:500, fontVariantNumeric:"tabular-nums" }}>{fmtD(w.amount)}</div>
                <div style={{ fontSize:11, color:"var(--color-text-secondary)" }}>{pct(w.amount / (exitVal || 1))} of proceeds</div>
              </div>
            ))}
            <div style={{ marginTop:10, padding:"8px 10px", background:"var(--color-background-secondary)", borderRadius:6, fontSize:11, color:"var(--color-text-secondary)", lineHeight:1.55 }}>
              Assumes preferred converts when pro-rata exceeds 1× preference. Excludes unexercised options. Not legal or tax advice.
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════
  // VIEW: ISSUE SECURITY
  // ═══════════════════════════════════
  const Issue = () => {
    const isOption = ["ISO","NSO","NSO (Advisor)","RSU"].includes(issueForm.cls);
    const isFounder = issueForm.type === "founder" && issueForm.cls === "Common";
    const currentFMV = 0.42;
    const priceNum = parseFloat(issueForm.price) || 0;
    const belowFMV = isOption && priceNum > 0 && priceNum < currentFMV;
    const valid = issueForm.holder.trim() && issueForm.shares && issueForm.date && !belowFMV;

    return (
      <div style={{ maxWidth:560 }}>
        {issueSuccess && (
          <div style={{ padding:"12px 16px", background:"#10B98118", border:"0.5px solid #10B981", borderRadius:8, marginBottom:16, fontSize:13, color:"#10B981", fontWeight:500 }}>
            ✓ Security issued and added to cap table — redirecting…
          </div>
        )}
        <div style={S.card}>
          <div style={{ fontSize:14, fontWeight:500, marginBottom:16 }}>Issue new security</div>
          <div style={S.fg2}>
            <div>
              <label style={S.label}>Holder name *</label>
              <input style={S.input} value={issueForm.holder} onChange={e => setIssueForm(p=>({...p,holder:e.target.value}))} placeholder="Full name or entity name" />
            </div>
            <div>
              <label style={S.label}>Holder type *</label>
              <select style={S.select} value={issueForm.type} onChange={e => setIssueForm(p=>({...p,type:e.target.value}))}>
                {["founder","investor","employee","advisor","pool"].map(t => <option key={t} value={t}>{t[0].toUpperCase()+t.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>Security class *</label>
              <select style={S.select} value={issueForm.cls} onChange={e => setIssueForm(p=>({...p,cls:e.target.value}))}>
                {["Common","Series A Preferred","Series B Preferred","ISO","NSO","NSO (Advisor)","RSU","SAFE","Warrant"].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>Number of shares *</label>
              <input style={S.input} type="number" min={1} value={issueForm.shares} onChange={e => setIssueForm(p=>({...p,shares:e.target.value}))} placeholder="e.g. 100,000" />
            </div>
            <div>
              <label style={S.label}>Price per share ($)</label>
              <input style={{ ...S.input, borderColor: belowFMV ? "#EF4444" : undefined }} type="number" step="0.0001" value={issueForm.price} onChange={e => setIssueForm(p=>({...p,price:e.target.value}))} />
              {belowFMV && <div style={{ fontSize:11, color:"#EF4444", marginTop:3 }}>⚡ Below 409A FMV (${currentFMV}/share) — §409A violation risk</div>}
            </div>
            <div>
              <label style={S.label}>Grant / issuance date *</label>
              <input style={S.input} type="date" value={issueForm.date} onChange={e => setIssueForm(p=>({...p,date:e.target.value}))} />
            </div>
            <div>
              <label style={S.label}>Cliff (months)</label>
              <input style={S.input} type="number" value={issueForm.cliff} onChange={e => setIssueForm(p=>({...p,cliff:e.target.value}))} />
            </div>
            <div>
              <label style={S.label}>Vesting period (months)</label>
              <input style={S.input} type="number" value={issueForm.mos} onChange={e => setIssueForm(p=>({...p,mos:e.target.value}))} />
            </div>
          </div>

          {isFounder && (
            <div style={S.warnBox("#F59E0B")}>
              ⚠ <strong>83(b) election required.</strong> Restricted common stock for founders must be reported to the IRS within <strong>30 days</strong> of this grant date. Set a reminder immediately. Missing the deadline cannot be corrected.
            </div>
          )}
          {isOption && !belowFMV && (
            <div style={S.warnBox("#378ADD")}>
              ℹ Option exercise price is at or above current 409A FMV ($0.42/share). <strong>Note:</strong> the current 409A is {mosDiff(CO.valDate, TODAY)} months old — a new valuation is needed before issuing further options.
            </div>
          )}
          {issueForm.cls === "SAFE" && (
            <div style={S.warnBox("#C8915A")}>
              ℹ SAFEs are not equity at issuance. They convert to preferred stock at a future priced round. Set the valuation cap and discount rate on the instrument itself. Consult your attorney.
            </div>
          )}

          {issueForm.shares && stats && (
            <div style={{ padding:"10px 12px", background:"var(--color-background-secondary)", borderRadius:6, fontSize:11, color:"var(--color-text-secondary)", marginBottom:12 }}>
              This issuance would represent <strong style={{ color:"var(--color-text-primary)" }}>{pct(parseInt(issueForm.shares||0)/(stats.fd+(parseInt(issueForm.shares)||0)))}</strong> of the post-issuance fully diluted cap table.
            </div>
          )}

          <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
            <button style={S.btnGhost} onClick={() => setView("ledger")}>Cancel</button>
            <button style={{ ...S.btn, opacity: valid ? 1 : 0.5, cursor: valid ? "pointer" : "not-allowed" }} onClick={valid ? handleIssue : null}>
              Issue security →
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════
  const VIEWS = { dashboard:<Dashboard/>, ledger:<Ledger/>, issue:<Issue/>, compliance:<Compliance/>, model:<Model/>, waterfall:<Waterfall/> };
  const activeTitle = NAV.find(n => n.id === view)?.label || "";

  return (
    <div style={S.app}>
      {/* Sidebar */}
      <div style={S.sb}>
        <div style={S.sbTop}>
          <div style={S.sbLogo}>{CO.name}</div>
          <div style={S.sbSub}>{CO.entity} · {CO.state}</div>
          {critCount > 0 && (
            <div style={S.sbBadge("#EF4444")} onClick={() => setView("compliance")}>
              <span>⚡</span><span>{critCount} critical</span>
            </div>
          )}
        </div>

        <nav style={S.sbNav}>
          {NAV.map(n => (
            <div key={n.id} style={S.sbItem(view===n.id)} onClick={() => setView(n.id)}>
              <n.icon size={15} strokeWidth={1.75} />
              <span style={{ flex:1 }}>{n.label}</span>
              {n.badge > 0 && (
                <span style={{ fontSize:10, background: compliance.a409.status==="critical" || compliance.f3921.status==="critical" ? "#EF4444" : "#F59E0B", color:"white", borderRadius:"50%", width:17, height:17, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  {n.badge}
                </span>
              )}
            </div>
          ))}
        </nav>

        <div style={S.sbFoot}>
          <div style={S.sbCLabel}>Compliance</div>
          {CHECKS.map(({ k, label }) => (
            <div key={k} style={S.sbCheck} onClick={() => setView("compliance")}>
              <div style={S.dot(compliance[k].status)}/>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div style={S.main}>
        <div style={S.topbar}>
          <div style={S.tbTitle}>{activeTitle}</div>
          <div style={S.tbMeta}>
            {fmt(stats.fd)} FD · {fmt(stats.issued)} issued · {fmtD(11000000)} post-money
          </div>
        </div>
        <div style={S.content}>
          {VIEWS[view]}
        </div>
      </div>
    </div>
  );
}
