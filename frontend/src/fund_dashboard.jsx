import { useState, useMemo, useEffect } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line } from "recharts";
import { LayoutGrid, Building2, Users, TrendingUp, FileText, ChevronRight, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";

// ═══════════════════════════════════════════════════════
// MOCK DATA
// ═══════════════════════════════════════════════════════

const FUND = {
  name: "Valkyrie Fund I",
  vintage: 2021,
  size: 50000000,
  strategy: "Early Stage Technology",
  manager: "Valkyrie Capital",
};

const PORTFOLIO = [
  { id:"pc1", name:"Mohan",         sector:"Deep Tech / Mining AI",   invested: 2000000, ownership: 8.5,  currentMark: 8000000,  stage:"Series A",  date:"2022-03-15", status:"active",   moic: 4.0  },
  { id:"pc2", name:"NovaBio",       sector:"Biotech",                 invested: 1500000, ownership: 6.2,  currentMark: 1500000,  stage:"Seed",      date:"2022-07-01", status:"active",   moic: 1.0  },
  { id:"pc3", name:"DataStream",    sector:"Data Infrastructure",     invested: 2000000, ownership: 11.0, currentMark: 0,        stage:"Exited",    date:"2021-11-10", status:"exited",   moic: 3.0, realized: 6000000, exitDate:"2024-01-15" },
  { id:"pc4", name:"CloudBase",     sector:"SaaS / DevTools",         invested: 1000000, ownership: 4.8,  currentMark: 500000,   stage:"Seed",      date:"2023-02-20", status:"active",   moic: 0.5  },
  { id:"pc5", name:"QuantumLeap",   sector:"Quantum Computing",       invested: 3000000, ownership: 9.1,  currentMark: 9000000,  stage:"Series A",  date:"2022-01-08", status:"active",   moic: 3.0  },
  { id:"pc6", name:"AcmeTech",      sector:"Enterprise SaaS",         invested: 3000000, ownership: 7.3,  currentMark: 4500000,  stage:"Series B",  date:"2021-09-30", status:"active",   moic: 1.5  },
  { id:"pc7", name:"GreenGrid",     sector:"Climate Tech",            invested: 2500000, ownership: 5.5,  currentMark: 3500000,  stage:"Series A",  date:"2023-06-15", status:"active",   moic: 1.4  },
  { id:"pc8", name:"MedAI",         sector:"Healthcare AI",           invested: 1500000, ownership: 3.9,  currentMark: 2000000,  stage:"Seed",      date:"2023-09-01", status:"active",   moic: 1.3  },
];

const LPS = [
  { id:"lp1", name:"Greenwood University Endowment", type:"Endowment",       commitment: 15000000, contributed: 12000000, distributions: 2400000, nav: 18000000 },
  { id:"lp2", name:"Harborview Family Office",       type:"Family Office",   commitment: 10000000, contributed: 8000000,  distributions: 1600000, nav: 12000000 },
  { id:"lp3", name:"Pacific Pension Fund",           type:"Pension Fund",    commitment: 12000000, contributed: 9600000,  distributions: 1920000, nav: 14400000 },
  { id:"lp4", name:"James R. Whitfield III",         type:"Individual",      commitment: 5000000,  contributed: 4000000,  distributions: 800000,  nav: 6000000  },
  { id:"lp5", name:"Apex Corporate Ventures",        type:"Corporate",       commitment: 8000000,  contributed: 6400000,  distributions: 1280000, nav: 9600000  },
];

const CASHFLOWS = [
  { date:"2021-09-01", amount:-3000000,  type:"call",    label:"Capital Call 1" },
  { date:"2022-01-15", amount:-5000000,  type:"call",    label:"Capital Call 2" },
  { date:"2022-09-01", amount:-6000000,  type:"call",    label:"Capital Call 3" },
  { date:"2023-03-01", amount:-5000000,  type:"call",    label:"Capital Call 4" },
  { date:"2023-11-01", amount:-4000000,  type:"call",    label:"Capital Call 5" },
  { date:"2024-01-15", amount: 6000000,  type:"dist",    label:"DataStream Exit Distribution" },
  { date:"2024-06-01", amount: 2000000,  type:"dist",    label:"Interim Distribution" },
];

const QUARTERLY = [
  { q:"Q1 2022", nav: 18000000, tvpi: 0.90 },
  { q:"Q2 2022", nav: 22000000, tvpi: 1.10 },
  { q:"Q3 2022", nav: 26000000, tvpi: 1.15 },
  { q:"Q4 2022", nav: 29000000, tvpi: 1.18 },
  { q:"Q1 2023", nav: 31000000, tvpi: 1.25 },
  { q:"Q2 2023", nav: 35000000, tvpi: 1.38 },
  { q:"Q3 2023", nav: 38000000, tvpi: 1.45 },
  { q:"Q4 2023", nav: 40000000, tvpi: 1.52 },
  { q:"Q1 2024", nav: 43000000, tvpi: 1.68 },
  { q:"Q2 2024", nav: 47000000, tvpi: 1.78 },
];

// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════

const fmt = n => n >= 1e6 ? "$"+(n/1e6).toFixed(1)+"M" : n >= 1e3 ? "$"+(n/1e3).toFixed(0)+"K" : "$"+n.toLocaleString();
const pct = n => (n*100).toFixed(1)+"%";
const fmtX = n => n.toFixed(2)+"x";
const fmtDate = d => new Date(d).toLocaleDateString("en-US",{month:"short",year:"numeric"});

function calcIRR(cashflows) {
  // Newton-Raphson IRR approximation
  let rate = 0.15;
  for (let i = 0; i < 100; i++) {
    let npv = 0, dnpv = 0;
    const t0 = new Date(cashflows[0].date).getTime();
    cashflows.forEach(cf => {
      const t = (new Date(cf.date).getTime() - t0) / (365.25 * 24 * 3600 * 1000);
      npv  += cf.amount / Math.pow(1 + rate, t);
      dnpv += -t * cf.amount / Math.pow(1 + rate, t + 1);
    });
    const newRate = rate - npv / dnpv;
    if (Math.abs(newRate - rate) < 1e-7) break;
    rate = newRate;
  }
  return rate;
}

// ═══════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════

export default function FundDashboard() {
  const [portfolio, setPortfolio] = useState(() => {
    const saved = localStorage.getItem("vk_portfolio");
    return saved ? JSON.parse(saved) : PORTFOLIO;
  });
  const [lps, setLps] = useState(() => {
    const saved = localStorage.getItem("vk_lps");
    return saved ? JSON.parse(saved) : LPS;
  });
  const [showAddCompany, setShowAddCompany] = useState(false);
  const [showAddLP, setShowAddLP] = useState(false);
  const [editingMark, setEditingMark] = useState(null);
  const [companyForm, setCompanyForm] = useState({ name:"", sector:"", stage:"Seed", invested:"", ownership:"", currentMark:"", date:"" });
  const [lpForm, setLpForm] = useState({ name:"", type:"Family Office", commitment:"", contributed:"", distributions:"0", nav:"" });

  useEffect(() => { localStorage.setItem("vk_portfolio", JSON.stringify(portfolio)); }, [portfolio]);
  useEffect(() => { localStorage.setItem("vk_lps", JSON.stringify(lps)); }, [lps]);
  const [view, setView] = useState("overview");
  const [selectedCompany, setSelectedCompany] = useState(null);

  function handleAddCompany() {
  if (!companyForm.name || !companyForm.invested) return;
  const invested = parseFloat(companyForm.invested);
  const mark = parseFloat(companyForm.currentMark) || invested;
  setPortfolio(prev => [...prev, {
    id: "pc"+Date.now(),
    name: companyForm.name,
    sector: companyForm.sector || "Other",
    stage: companyForm.stage,
    invested,
    ownership: parseFloat(companyForm.ownership) || 0,
    currentMark: mark,
    date: companyForm.date || new Date().toISOString().slice(0,10),
    status: "active",
    moic: mark / invested,
  }]);
  setCompanyForm({ name:"", sector:"", stage:"Seed", invested:"", ownership:"", currentMark:"", date:"" });
  setShowAddCompany(false);
}

function handleAddLP() {
  if (!lpForm.name || !lpForm.commitment) return;
  setLps(prev => [...prev, {
    id: "lp"+Date.now(),
    name: lpForm.name,
    type: lpForm.type,
    commitment: parseFloat(lpForm.commitment),
    contributed: parseFloat(lpForm.contributed) || 0,
    distributions: parseFloat(lpForm.distributions) || 0,
    nav: parseFloat(lpForm.nav) || 0,
  }]);
  setLpForm({ name:"", type:"Family Office", commitment:"", contributed:"", distributions:"0", nav:"" });
  setShowAddLP(false);
}

function handleUpdateMark(id, newMark) {
  setPortfolio(prev => prev.map(p => p.id === id
    ? { ...p, currentMark: parseFloat(newMark), moic: parseFloat(newMark) / p.invested }
    : p
  ));
  setEditingMark(null);
}

  const metrics = useMemo(() => {
    const paidIn        = CASHFLOWS.filter(c => c.type === "call").reduce((a,c) => a + Math.abs(c.amount), 0);
    const distributions = CASHFLOWS.filter(c => c.type === "dist").reduce((a,c) => a + c.amount, 0);
    const unrealized    = portfolio.filter(p => p.status === "active").reduce((a,p) => a + p.currentMark, 0);
    const realized      = portfolio.filter(p => p.status === "exited").reduce((a,p) => a + (p.realized||0), 0);
    const totalValue    = unrealized + distributions;
    const tvpi          = totalValue / paidIn;
    const dpi           = distributions / paidIn;
    const rvpi          = unrealized / paidIn;
    const mgmtFees      = paidIn * 0.02 * 3; // ~2% for 3 years
    const carry         = Math.max(0, (totalValue - paidIn) * 0.20);
    const netTvpi       = (totalValue - mgmtFees - carry) / paidIn;
    const committed     = FUND.size;
    const remaining     = committed - paidIn;
    // Add current NAV as terminal cashflow for IRR
    const irrFlows = [
      ...CASHFLOWS,
      { date: new Date().toISOString().slice(0,10), amount: unrealized + distributions, type:"terminal" }
    ];
    const grossIRR = calcIRR(irrFlows);
    const netIRR   = grossIRR * 0.85; // approximate net
    return { paidIn, distributions, unrealized, realized, totalValue, tvpi, dpi, rvpi, netTvpi, grossIRR, netIRR, committed, remaining, mgmtFees, carry };
  }, []);

  const lpMetrics = useMemo(() => {
    const totalCommitted    = lps.reduce((a,l) => a + l.commitment, 0);
    const totalContributed  = lps.reduce((a,l) => a + l.contributed, 0);
    const totalDistributed  = lps.reduce((a,l) => a + l.distributions, 0);
    const totalNAV          = lps.reduce((a,l) => a + l.nav, 0);
    return { totalCommitted, totalContributed, totalDistributed, totalNAV };
  }, [lps]);

  // ── Shared Styles ─────────────────────────────────────
  const S = {
    page:    { padding:"24px", maxWidth:1200, margin:"0 auto" },
    layout:  { display:"flex", gap:20, alignItems:"flex-start" },
    sidebar: { width:200, flexShrink:0, background:"#2A1D16", borderRadius:12, padding:"16px 0", position:"sticky", top:60 },
    sbLabel: { fontSize:9.5, color:"rgba(255,255,255,0.28)", letterSpacing:".08em", textTransform:"uppercase", padding:"0 16px", marginBottom:6, marginTop:12 },
    sbItem:  (a) => ({ display:"flex", alignItems:"center", gap:9, padding:"9px 16px", fontSize:12.5, cursor:"pointer", color: a ? "#E8C9A8" : "rgba(255,255,255,0.48)", background: a ? "rgba(200,145,90,0.14)" : "transparent", borderLeft: a ? "2px solid #C8915A" : "2px solid transparent", transition:"all .12s", userSelect:"none" }),
    main:    { flex:1, minWidth:0 },
    grid4:   { display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:16 },
    grid3:   { display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:16 },
    grid2:   { display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 },
    card:    { background:"#fff", border:"0.5px solid var(--color-border-tertiary)", borderRadius:10, padding:"14px 16px", marginBottom:12 },
    cardH:   { fontSize:11, color:"var(--color-text-secondary)", marginBottom:3, fontWeight:500 },
    cardV:   { fontSize:22, fontWeight:500, color:"var(--color-text-primary)", fontVariantNumeric:"tabular-nums" },
    cardSub: { fontSize:11, color:"var(--color-text-tertiary)", marginTop:2 },
    secH:    { fontSize:12, fontWeight:600, color:"var(--color-text-secondary)", marginBottom:12, letterSpacing:".02em", textTransform:"uppercase" },
    tbl:     { width:"100%", borderCollapse:"collapse", fontSize:12 },
    th:      { padding:"8px 12px", textAlign:"left", color:"var(--color-text-secondary)", fontWeight:500, borderBottom:"0.5px solid var(--color-border-tertiary)", fontSize:11, whiteSpace:"nowrap" },
    td:      { padding:"10px 12px", color:"var(--color-text-primary)", borderBottom:"0.5px solid var(--color-border-tertiary)", verticalAlign:"middle" },
    trHover: { cursor:"pointer", transition:"background .1s" },
    badge:   (c) => ({ fontSize:10, padding:"2px 8px", borderRadius:4, fontWeight:500, background:c+"18", color:c }),
    pill:    (c) => ({ fontSize:11, padding:"3px 10px", borderRadius:6, background:c+"15", color:c, fontWeight:500 }),
    tag:     { fontSize:10, padding:"2px 8px", borderRadius:4, background:"var(--color-background-secondary)", color:"var(--color-text-tertiary)", border:"0.5px solid var(--color-border-tertiary)" },
    moicUp:  { color:"#10B981", fontWeight:500 },
    moicFlat:{ color:"#F59E0B", fontWeight:500 },
    moicDown:{ color:"#EF4444", fontWeight:500 },
    pageTitle:{ fontSize:20, fontWeight:600, color:"var(--color-text-primary)", marginBottom:4 },
    pageSub:  { fontSize:12, color:"var(--color-text-secondary)", marginBottom:20 },
  };

  const NAV_ITEMS = [
    { id:"overview",   label:"Overview",          icon:LayoutGrid },
    { id:"portfolio",  label:"Portfolio",          icon:Building2 },
    { id:"lps",        label:"LP Management",      icon:Users },
    { id:"metrics",    label:"Fund Metrics",       icon:TrendingUp },
    { id:"documents",  label:"Documents",          icon:FileText },
  ];

  const moicColor = (m) => m >= 2 ? "#10B981" : m >= 1 ? "#F59E0B" : "#EF4444";
  const moicStyle = (m) => m >= 2 ? S.moicUp : m >= 1 ? S.moicFlat : S.moicDown;

  // ═══════════════════════════════════
  // VIEW: OVERVIEW
  // ═══════════════════════════════════
  const Overview = () => {
    const sectorMap = {};
    portfolio.forEach(p => { sectorMap[p.sector] = (sectorMap[p.sector]||0) + (p.currentMark || p.realized || 0); });
    const sectorData = Object.entries(sectorMap).map(([name,value]) => ({ name, value }));
    const COLORS = ["#C8915A","#2A1D16","#E8C9A8","#8B6344","#D4A97A","#6B4C32","#F0D9C0","#4A3020"];
    return (
      <div>
        <div style={S.grid4}>
          {[
            { h:"Fund Size",          v:fmt(FUND.size),           sub:`${fmt(metrics.paidIn)} called · ${fmt(metrics.remaining)} remaining` },
            { h:"Total NAV",          v:fmt(metrics.unrealized),  sub:"Unrealized portfolio value" },
            { h:"Distributions",      v:fmt(metrics.distributions), sub:"Total returned to LPs" },
            { h:"Portfolio Cos.",     v:portfolio.length,          sub:`${portfolio.filter(p=>p.status==="active").length} active · ${portfolio.filter(p=>p.status==="exited").length} exited` },
          ].map((m,i) => (
            <div key={i} style={S.card}>
              <div style={S.cardH}>{m.h}</div>
              <div style={S.cardV}>{m.v}</div>
              <div style={S.cardSub}>{m.sub}</div>
            </div>
          ))}
        </div>

        <div style={S.grid3}>
          {[
            { h:"TVPI (Gross)",  v:fmtX(metrics.tvpi),    sub:"Total value / paid-in",        color: metrics.tvpi >= 2 ? "#10B981" : "#F59E0B" },
            { h:"DPI",          v:fmtX(metrics.dpi),     sub:"Distributions / paid-in",      color: metrics.dpi >= 1 ? "#10B981" : "#C8915A" },
            { h:"Gross IRR",    v:pct(metrics.grossIRR), sub:"Since first capital call",      color: metrics.grossIRR >= 0.2 ? "#10B981" : "#F59E0B" },
          ].map((m,i) => (
            <div key={i} style={{ ...S.card, borderTop:`3px solid ${m.color}` }}>
              <div style={S.cardH}>{m.h}</div>
              <div style={{ ...S.cardV, color:m.color }}>{m.v}</div>
              <div style={S.cardSub}>{m.sub}</div>
            </div>
          ))}
        </div>

        <div style={S.grid2}>
          <div style={S.card}>
            <div style={S.secH}>NAV over time</div>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={QUARTERLY} margin={{top:4,right:8,left:0,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-tertiary)" vertical={false}/>
                <XAxis dataKey="q" tick={{fontSize:9}} interval={2}/>
                <YAxis tickFormatter={v=>"$"+(v/1e6).toFixed(0)+"M"} tick={{fontSize:9}}/>
                <Tooltip formatter={v=>[fmt(v),"NAV"]} contentStyle={{fontSize:11,borderRadius:6}}/>
                <Line type="monotone" dataKey="nav" stroke="#C8915A" strokeWidth={2} dot={false}/>
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div style={S.card}>
            <div style={S.secH}>Portfolio by sector (value)</div>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={sectorData} dataKey="value" cx="45%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={2}>
                  {sectorData.map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                </Pie>
                <Tooltip formatter={(v,n)=>[fmt(v),n]} contentStyle={{fontSize:11,borderRadius:6}}/>
              </PieChart>
            </ResponsiveContainer>
            <div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:4}}>
              {sectorData.map((d,i) => (
                <span key={d.name} style={{fontSize:10,display:"flex",alignItems:"center",gap:4,color:"var(--color-text-secondary)"}}>
                  <span style={{width:7,height:7,borderRadius:2,background:COLORS[i%COLORS.length],flexShrink:0}}/>
                  {d.name.split(" / ")[0]}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div style={S.card}>
          <div style={S.secH}>Portfolio snapshot</div>
          <table style={S.tbl}>
            <thead>
              <tr>{["Company","Sector","Invested","Current Mark","MOIC","Status"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {portfolio.slice(0,5).map((p,i) => (
                <tr key={p.id} style={{...S.trHover, background: i%2===0?"transparent":"#FAF7F3"}} onClick={()=>{setSelectedCompany(p);setView("portfolio");}}>
                  <td style={{...S.td,fontWeight:500}}>{p.name}</td>
                  <td style={S.td}><span style={S.tag}>{p.sector}</span></td>
                  <td style={{...S.td,fontVariantNumeric:"tabular-nums"}}>{fmt(p.invested)}</td>
                  <td style={{...S.td,fontVariantNumeric:"tabular-nums"}}>{p.status==="exited"? <span style={{color:"#10B981"}}>Exited — {fmt(p.realized)}</span> : fmt(p.currentMark)}</td>
                  <td style={{...S.td,...moicStyle(p.moic)}}>{fmtX(p.moic)}</td>
                  <td style={S.td}><span style={S.badge(p.status==="active"?"#10B981":"#6366F1")}>{p.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={()=>setView("portfolio")} style={{marginTop:12,fontSize:12,padding:"6px 14px",border:"0.5px solid var(--color-border-secondary)",borderRadius:6,background:"transparent",color:"var(--color-text-secondary)",cursor:"pointer"}}>
            View all {portfolio.length} companies →
          </button>
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════
  // VIEW: PORTFOLIO
  // ═══════════════════════════════════
  const Portfolio = () => {
    const co = selectedCompany;
    if (co) return (
      <div>
        <button onClick={()=>setSelectedCompany(null)} style={{fontSize:12,padding:"6px 12px",border:"0.5px solid var(--color-border-secondary)",borderRadius:6,background:"transparent",color:"var(--color-text-secondary)",cursor:"pointer",marginBottom:16}}>
          ← Back to portfolio
        </button>
        <div style={S.card}>
          <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:16}}>
            <div>
              <div style={{fontSize:20,fontWeight:600,marginBottom:4}}>{co.name}</div>
              <span style={S.tag}>{co.sector}</span>
              <span style={{...S.tag,marginLeft:6}}>{co.stage}</span>
            </div>
            <span style={S.badge(co.status==="active"?"#10B981":"#6366F1")}>{co.status}</span>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
            {[
              {h:"Invested",       v:fmt(co.invested)},
              {h:"Current Mark",   v:co.status==="exited"? fmt(co.realized) : fmt(co.currentMark)},
              {h:"MOIC",           v:fmtX(co.moic), color:moicColor(co.moic)},
              {h:"Ownership",      v:pct(co.ownership/100)},
              {h:"Investment Date",v:fmtDate(co.date)},
              {h:"Stage",          v:co.stage},
              {h:"Unrealized G/L", v:fmt((co.currentMark||0)-co.invested), color:(co.currentMark||0)>=co.invested?"#10B981":"#EF4444"},
              {h:"Status",         v:co.status[0].toUpperCase()+co.status.slice(1)},
            ].map((m,i)=>(
              <div key={i} style={{padding:"12px",background:"var(--color-background-secondary)",borderRadius:8}}>
                <div style={{fontSize:10,color:"var(--color-text-tertiary)",marginBottom:4,fontWeight:500}}>{m.h}</div>
                <div style={{fontSize:15,fontWeight:500,color:m.color||"var(--color-text-primary)"}}>{m.v}</div>
              </div>
            ))}
          </div>
        </div>
        {co.status==="exited" && (
          <div style={{...S.card,borderLeft:"3px solid #10B981"}}>
            <div style={{fontSize:13,fontWeight:500,marginBottom:4,color:"#10B981"}}>✓ Realized Investment</div>
            <div style={{fontSize:12,color:"var(--color-text-secondary)"}}>Exited {fmtDate(co.exitDate)} · {fmt(co.realized)} distributed to fund · {fmtX(co.moic)} MOIC</div>
          </div>
        )}
      </div>
    );

    return (
      <div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
          <div style={S.pageTitle}>Portfolio Companies</div>
          <button onClick={()=>setShowAddCompany(true)} style={{padding:"8px 18px",background:"#2A1D16",color:"#E8C9A8",border:"none",borderRadius:8,fontSize:13,cursor:"pointer",fontWeight:500}}>+ Add Company</button>
        </div>
        <div style={S.pageSub}>{portfolio.length} investments · {portfolio.filter(p=>p.status==="active").length} active · {fmt(portfolio.reduce((a,p)=>a+p.invested,0))} deployed</div>
        <div style={{...S.card,padding:0,overflow:"hidden"}}>
          <table style={S.tbl}>
            <thead style={{background:"var(--color-background-secondary)"}}>
              <tr>{["Company","Sector","Stage","Invested","Current Mark","MOIC","Ownership","Status"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {portfolio.map((p,i)=>(
                <tr key={p.id} onClick={()=>setSelectedCompany(p)} style={{...S.trHover,background:i%2===0?"#fff":"#FAF7F3"}}>
                  <td style={{...S.td,fontWeight:500}}>{p.name}</td>
                  <td style={S.td}><span style={S.tag}>{p.sector.split(" / ")[0]}</span></td>
                  <td style={S.td}><span style={S.tag}>{p.stage}</span></td>
                  <td style={{...S.td,fontVariantNumeric:"tabular-nums"}}>{fmt(p.invested)}</td>
                  <td style={{...S.td,fontVariantNumeric:"tabular-nums"}}>{p.status==="exited"?<span style={{color:"#10B981"}}>Exited</span>:fmt(p.currentMark)}</td>
                  <td style={{...S.td,...moicStyle(p.moic)}}>{fmtX(p.moic)}</td>
                  <td style={{...S.td,fontVariantNumeric:"tabular-nums"}}>{pct(p.ownership/100)}</td>
                  <td style={S.td}><span style={S.badge(p.status==="active"?"#10B981":"#6366F1")}>{p.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════
  // VIEW: LPs
  // ═══════════════════════════════════
  const LPView = () => (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
        <div style={S.pageTitle}>LP Management</div>
        <button onClick={()=>setShowAddLP(true)} style={{padding:"8px 18px",background:"#2A1D16",color:"#E8C9A8",border:"none",borderRadius:8,fontSize:13,cursor:"pointer",fontWeight:500}}>+ Add LP</button>
      </div>
      <div style={S.pageSub}>{lps.length} limited partners · {fmt(lpMetrics.totalCommitted)} committed · {fmt(lpMetrics.totalContributed)} contributed</div>
      <div style={S.grid4}>
        {[
          {h:"Total Committed",   v:fmt(lpMetrics.totalCommitted),   sub:"Across all LPs"},
          {h:"Called Capital",    v:fmt(lpMetrics.totalContributed),  sub:pct(lpMetrics.totalContributed/lpMetrics.totalCommitted)+" of commitments"},
          {h:"Distributions",     v:fmt(lpMetrics.totalDistributed),  sub:"Returned to LPs"},
          {h:"Total LP NAV",      v:fmt(lpMetrics.totalNAV),          sub:"Current estimated value"},
        ].map((m,i)=>(
          <div key={i} style={S.card}>
            <div style={S.cardH}>{m.h}</div>
            <div style={S.cardV}>{m.v}</div>
            <div style={S.cardSub}>{m.sub}</div>
          </div>
        ))}
      </div>
      <div style={{...S.card,padding:0,overflow:"hidden"}}>
        <table style={S.tbl}>
          <thead style={{background:"var(--color-background-secondary)"}}>
            <tr>{["LP Name","Type","Commitment","Contributed","Distributions","Current NAV","TVPI"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {lps.map((lp,i)=>{
              const tvpi = (lp.nav + lp.distributions) / lp.contributed;
              return (
                <tr key={lp.id} style={{background:i%2===0?"#fff":"#FAF7F3"}}>
                  <td style={{...S.td,fontWeight:500}}>{lp.name}</td>
                  <td style={S.td}><span style={S.tag}>{lp.type}</span></td>
                  <td style={{...S.td,fontVariantNumeric:"tabular-nums"}}>{fmt(lp.commitment)}</td>
                  <td style={{...S.td,fontVariantNumeric:"tabular-nums"}}>{fmt(lp.contributed)}</td>
                  <td style={{...S.td,fontVariantNumeric:"tabular-nums",color:"#10B981"}}>{fmt(lp.distributions)}</td>
                  <td style={{...S.td,fontVariantNumeric:"tabular-nums"}}>{fmt(lp.nav)}</td>
                  <td style={{...S.td,...moicStyle(tvpi)}}>{fmtX(tvpi)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot style={{background:"var(--color-background-secondary)"}}>
            <tr>
              <td style={{...S.td,fontWeight:600}} colSpan={2}>Total</td>
              <td style={{...S.td,fontWeight:600,fontVariantNumeric:"tabular-nums"}}>{fmt(lpMetrics.totalCommitted)}</td>
              <td style={{...S.td,fontWeight:600,fontVariantNumeric:"tabular-nums"}}>{fmt(lpMetrics.totalContributed)}</td>
              <td style={{...S.td,fontWeight:600,fontVariantNumeric:"tabular-nums",color:"#10B981"}}>{fmt(lpMetrics.totalDistributed)}</td>
              <td style={{...S.td,fontWeight:600,fontVariantNumeric:"tabular-nums"}}>{fmt(lpMetrics.totalNAV)}</td>
              <td style={{...S.td,...moicStyle((lpMetrics.totalNAV+lpMetrics.totalDistributed)/lpMetrics.totalContributed)}}>{fmtX((lpMetrics.totalNAV+lpMetrics.totalDistributed)/lpMetrics.totalContributed)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );

  // ═══════════════════════════════════
  // VIEW: FUND METRICS
  // ═══════════════════════════════════
  const Metrics = () => {
    const cashflowBars = CASHFLOWS.map(c => ({
      label: c.label.split(" ")[0]+" "+c.label.split(" ")[1],
      amount: c.amount,
      color: c.type==="call" ? "#EF4444" : "#10B981",
    }));
    return (
      <div>
        <div style={S.pageTitle}>Fund Performance Metrics</div>
        <div style={S.pageSub}>Gross and net performance · {FUND.vintage} vintage · as of {new Date().toLocaleDateString("en-US",{month:"long",year:"numeric"})}</div>

        <div style={{...S.card,marginBottom:14}}>
          <div style={S.secH}>Performance summary</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:1,background:"var(--color-border-tertiary)",borderRadius:8,overflow:"hidden"}}>
            {[
              {label:"TVPI (Gross)",  gross:fmtX(metrics.tvpi),    net:fmtX(metrics.netTvpi),   desc:"Total value / paid-in capital"},
              {label:"DPI",          gross:fmtX(metrics.dpi),     net:fmtX(metrics.dpi*0.88),  desc:"Distributions / paid-in capital"},
              {label:"RVPI",         gross:fmtX(metrics.rvpi),    net:fmtX(metrics.rvpi*0.9),  desc:"Unrealized value / paid-in capital"},
              {label:"IRR",          gross:pct(metrics.grossIRR), net:pct(metrics.netIRR),     desc:"Internal rate of return"},
              {label:"Paid-In",      gross:fmt(metrics.paidIn),   net:fmt(metrics.paidIn),     desc:"Capital called from LPs"},
              {label:"Total Value",  gross:fmt(metrics.totalValue),net:fmt(metrics.totalValue-metrics.mgmtFees-metrics.carry),desc:"NAV + distributions"},
            ].map((m,i)=>(
              <div key={i} style={{padding:"16px",background:"#fff"}}>
                <div style={{fontSize:11,color:"var(--color-text-tertiary)",marginBottom:8}}>{m.label}</div>
                <div style={{display:"flex",gap:12,alignItems:"baseline"}}>
                  <div>
                    <div style={{fontSize:9,color:"var(--color-text-tertiary)",marginBottom:2}}>GROSS</div>
                    <div style={{fontSize:18,fontWeight:600,color:"var(--color-text-primary)"}}>{m.gross}</div>
                  </div>
                  <div style={{width:"0.5px",height:32,background:"var(--color-border-tertiary)"}}/>
                  <div>
                    <div style={{fontSize:9,color:"var(--color-text-tertiary)",marginBottom:2}}>NET</div>
                    <div style={{fontSize:18,fontWeight:600,color:"var(--color-text-secondary)"}}>{m.net}</div>
                  </div>
                </div>
                <div style={{fontSize:10,color:"var(--color-text-tertiary)",marginTop:6}}>{m.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={S.grid2}>
          <div style={S.card}>
            <div style={S.secH}>TVPI progression</div>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={QUARTERLY} margin={{top:4,right:8,left:0,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-tertiary)" vertical={false}/>
                <XAxis dataKey="q" tick={{fontSize:9}} interval={2}/>
                <YAxis domain={[0.8,2.0]} tick={{fontSize:9}} tickFormatter={v=>v+"x"}/>
                <Tooltip formatter={v=>[v+"x","TVPI"]} contentStyle={{fontSize:11,borderRadius:6}}/>
                <Line type="monotone" dataKey="tvpi" stroke="#C8915A" strokeWidth={2} dot={{r:3,fill:"#C8915A"}}/>
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div style={S.card}>
            <div style={S.secH}>Cash flow waterfall</div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={cashflowBars} margin={{top:4,right:8,left:0,bottom:20}}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-tertiary)" vertical={false}/>
                <XAxis dataKey="label" tick={{fontSize:9}} angle={-20} textAnchor="end"/>
                <YAxis tickFormatter={v=>"$"+(Math.abs(v)/1e6).toFixed(0)+"M"} tick={{fontSize:9}}/>
                <Tooltip formatter={v=>[fmt(Math.abs(v)),v<0?"Capital Call":"Distribution"]} contentStyle={{fontSize:11,borderRadius:6}}/>
                <Bar dataKey="amount" radius={[4,4,0,0]}>
                  {cashflowBars.map((e,i)=><Cell key={i} fill={e.color}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={S.card}>
          <div style={S.secH}>Fee & carry summary</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
            {[
              {h:"Management Fees",   v:fmt(metrics.mgmtFees),  sub:"2% p.a. on committed"},
              {h:"Carried Interest",  v:fmt(metrics.carry),     sub:"20% of profits above cost"},
              {h:"Net Paid-In",       v:fmt(metrics.paidIn),    sub:"LP contributed capital"},
              {h:"Net to LPs",        v:fmt(metrics.totalValue - metrics.mgmtFees - metrics.carry), sub:"After fees & carry"},
            ].map((m,i)=>(
              <div key={i} style={{padding:"12px",background:"var(--color-background-secondary)",borderRadius:8}}>
                <div style={{fontSize:10,color:"var(--color-text-tertiary)",marginBottom:4}}>{m.h}</div>
                <div style={{fontSize:16,fontWeight:500,color:"var(--color-text-primary)"}}>{m.v}</div>
                <div style={{fontSize:10,color:"var(--color-text-tertiary)",marginTop:2}}>{m.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════
  // VIEW: DOCUMENTS
  // ═══════════════════════════════════
  const Documents = () => (
    <div>
      <div style={S.pageTitle}>Documents & Reporting</div>
      <div style={S.pageSub}>K-1s, financial reports, and LP communications</div>
      <div style={S.grid2}>
        {[
          { title:"K-1 Tax Documents",     desc:"Annual Schedule K-1 for each LP showing allocated income, losses, deductions, and credits.", year:"2024 (current)", status:"pending", color:"#F59E0B" },
          { title:"Financial Reports",      desc:"Audited and unaudited financial statements including balance sheet, P&L, and capital account statements.", year:"Q1 2024",       status:"ready",   color:"#10B981" },
          { title:"Capital Call Notices",   desc:"Formal notices to LPs for capital contributions with wiring instructions and deadlines.", year:"Most recent: Call 5", status:"sent", color:"#10B981" },
          { title:"Distribution Notices",   desc:"Notices to LPs accompanying distributions with tax withholding details.", year:"Jan 2024 distribution", status:"sent", color:"#10B981" },
          { title:"Quarterly LP Reports",   desc:"Portfolio update, NAV summary, notable events, and outlook for limited partners.", year:"Q1 2024",       status:"draft",   color:"#C8915A" },
          { title:"Annual Meeting Materials",desc:"Annual meeting deck, fund overview, portfolio deep-dives, and outlook presentation.", year:"2024",         status:"pending", color:"#F59E0B" },
        ].map((d,i)=>(
          <div key={i} style={{...S.card,display:"flex",flexDirection:"column",gap:10}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div style={{fontSize:13,fontWeight:500}}>{d.title}</div>
              <span style={S.badge(d.color)}>{d.status}</span>
            </div>
            <div style={{fontSize:11,color:"var(--color-text-secondary)",lineHeight:1.6}}>{d.desc}</div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:"auto"}}>
              <span style={{fontSize:11,color:"var(--color-text-tertiary)"}}>{d.year}</span>
              <button style={{fontSize:11,padding:"5px 12px",border:"0.5px solid var(--color-border-secondary)",borderRadius:6,background:"transparent",color:"var(--color-text-secondary)",cursor:"pointer"}}>
                {d.status==="ready"||d.status==="sent" ? "Download →" : "Generate →"}
              </button>
            </div>
          </div>
        ))}
      </div>
      <div style={{...S.card,background:"var(--color-background-secondary)",border:"0.5px dashed var(--color-border-secondary)"}}>
        <div style={{fontSize:12,fontWeight:500,marginBottom:4,color:"var(--color-text-secondary)"}}>K-1 Generation</div>
        <div style={{fontSize:11,color:"var(--color-text-tertiary)",lineHeight:1.6,marginBottom:12}}>Generate Schedule K-1 for all {lps.length} LPs for the 2024 tax year. Each K-1 will include allocated ordinary income, capital gains, deductions, and each LP's ending capital account balance.</div>
        <div style={{display:"flex",gap:8}}>
          <button style={{fontSize:12,padding:"8px 18px",background:"#2A1D16",color:"#E8C9A8",border:"none",borderRadius:8,cursor:"pointer",fontWeight:500}}>
            Generate all K-1s ({lps.length} LPs) →
          </button>
          <button style={{fontSize:12,padding:"8px 18px",background:"transparent",color:"var(--color-text-secondary)",border:"0.5px solid var(--color-border-secondary)",borderRadius:8,cursor:"pointer"}}>
            Preview template
          </button>
        </div>
      </div>
    </div>
  );

  const VIEWS = { overview:<Overview/>, portfolio:<Portfolio/>, lps:<LPView/>, metrics:<Metrics/>, documents:<Documents/> };

  return (
    <div style={S.page}>
      <div style={S.layout}>
        {/* Sidebar */}
        <div style={S.sidebar}>
          <div style={{padding:"12px 16px 0"}}>
            <div style={{fontSize:12,fontWeight:600,color:"#E8C9A8",letterSpacing:"0.02em"}}>{FUND.name}</div>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.35)",marginTop:2}}>{FUND.vintage} · {FUND.strategy}</div>
          </div>
          <div style={{margin:"12px 16px",padding:"10px 12px",background:"rgba(200,145,90,0.12)",borderRadius:8,border:"0.5px solid rgba(200,145,90,0.25)"}}>
            <div style={{fontSize:9,color:"rgba(255,255,255,0.4)",marginBottom:2}}>FUND TVPI</div>
            <div style={{fontSize:18,fontWeight:600,color:"#E8C9A8"}}>{fmtX(metrics.tvpi)}</div>
            <div style={{fontSize:9,color:"rgba(255,255,255,0.35)",marginTop:1}}>IRR: {pct(metrics.grossIRR)}</div>
          </div>
          <div style={S.sbLabel}>Navigation</div>
          {NAV_ITEMS.map(n => (
            <div key={n.id} style={S.sbItem(view===n.id)} onClick={()=>{setView(n.id);setSelectedCompany(null);}}>
              <n.icon size={14} strokeWidth={1.75}/>
              <span>{n.label}</span>
            </div>
          ))}
          <div style={S.sbLabel}>Fund</div>
          <div style={{padding:"0 16px"}}>
            {[
              {l:"Size",    v:fmt(FUND.size)},
              {l:"Called",  v:pct(metrics.paidIn/FUND.size)},
              {l:"LPs",     v:lps.length},
              {l:"Companies",v:portfolio.length},
            ].map(r=>(
              <div key={r.l} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"0.5px solid rgba(255,255,255,0.05)",fontSize:11}}>
                <span style={{color:"rgba(255,255,255,0.35)"}}>{r.l}</span>
                <span style={{color:"rgba(255,255,255,0.65)"}}>{r.v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Main */}
        <div style={S.main}>
          {VIEWS[view]}
        </div>
            {/* Add Company Modal */}
{showAddCompany && (
  <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setShowAddCompany(false)}>
    <div style={{background:"#fff",borderRadius:12,padding:28,width:480,maxWidth:"90vw"}} onClick={e=>e.stopPropagation()}>
      <div style={{fontSize:16,fontWeight:600,marginBottom:20}}>Add Portfolio Company</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        {[
          {label:"Company name *",    key:"name",        type:"text",   placeholder:"e.g. Acme Corp"},
          {label:"Sector",            key:"sector",      type:"text",   placeholder:"e.g. Deep Tech"},
          {label:"Invested ($) *",    key:"invested",    type:"number", placeholder:"e.g. 2000000"},
          {label:"Current mark ($)",  key:"currentMark", type:"number", placeholder:"Leave blank = cost"},
          {label:"Ownership (%)",     key:"ownership",   type:"number", placeholder:"e.g. 8.5"},
          {label:"Investment date",   key:"date",        type:"date",   placeholder:""},
        ].map(f=>(
          <div key={f.key}>
            <label style={{fontSize:11,fontWeight:500,color:"var(--color-text-secondary)",display:"block",marginBottom:4}}>{f.label}</label>
            <input type={f.type} placeholder={f.placeholder} value={companyForm[f.key]} onChange={e=>setCompanyForm(p=>({...p,[f.key]:e.target.value}))}
              style={{width:"100%",padding:"8px 10px",border:"0.5px solid var(--color-border-secondary)",borderRadius:8,fontSize:13,boxSizing:"border-box",outline:"none"}}/>
          </div>
        ))}
        <div>
          <label style={{fontSize:11,fontWeight:500,color:"var(--color-text-secondary)",display:"block",marginBottom:4}}>Stage</label>
          <select value={companyForm.stage} onChange={e=>setCompanyForm(p=>({...p,stage:e.target.value}))}
            style={{width:"100%",padding:"8px 10px",border:"0.5px solid var(--color-border-secondary)",borderRadius:8,fontSize:13,boxSizing:"border-box",outline:"none",background:"#fff"}}>
            {["Pre-Seed","Seed","Series A","Series B","Series C","Growth","Exited"].map(s=><option key={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:20}}>
        <button onClick={()=>setShowAddCompany(false)} style={{padding:"8px 16px",border:"0.5px solid var(--color-border-secondary)",borderRadius:8,background:"transparent",fontSize:13,cursor:"pointer"}}>Cancel</button>
        <button onClick={handleAddCompany} style={{padding:"8px 18px",background:"#2A1D16",color:"#E8C9A8",border:"none",borderRadius:8,fontSize:13,cursor:"pointer",fontWeight:500}}>Add Company →</button>
      </div>
    </div>
  </div>
)}

{/* Add LP Modal */}
{showAddLP && (
  <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setShowAddLP(false)}>
    <div style={{background:"#fff",borderRadius:12,padding:28,width:480,maxWidth:"90vw"}} onClick={e=>e.stopPropagation()}>
      <div style={{fontSize:16,fontWeight:600,marginBottom:20}}>Add Limited Partner</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        {[
          {label:"LP Name *",           key:"name",          type:"text",   placeholder:"e.g. Greenwood Endowment"},
          {label:"Commitment ($) *",    key:"commitment",    type:"number", placeholder:"e.g. 10000000"},
          {label:"Contributed ($)",     key:"contributed",   type:"number", placeholder:"e.g. 8000000"},
          {label:"Distributions ($)",   key:"distributions", type:"number", placeholder:"e.g. 1000000"},
          {label:"Current NAV ($)",     key:"nav",           type:"number", placeholder:"e.g. 12000000"},
        ].map(f=>(
          <div key={f.key}>
            <label style={{fontSize:11,fontWeight:500,color:"var(--color-text-secondary)",display:"block",marginBottom:4}}>{f.label}</label>
            <input type={f.type} placeholder={f.placeholder} value={lpForm[f.key]} onChange={e=>setLpForm(p=>({...p,[f.key]:e.target.value}))}
              style={{width:"100%",padding:"8px 10px",border:"0.5px solid var(--color-border-secondary)",borderRadius:8,fontSize:13,boxSizing:"border-box",outline:"none"}}/>
          </div>
        ))}
        <div>
          <label style={{fontSize:11,fontWeight:500,color:"var(--color-text-secondary)",display:"block",marginBottom:4}}>LP Type</label>
          <select value={lpForm.type} onChange={e=>setLpForm(p=>({...p,type:e.target.value}))}
            style={{width:"100%",padding:"8px 10px",border:"0.5px solid var(--color-border-secondary)",borderRadius:8,fontSize:13,boxSizing:"border-box",outline:"none",background:"#fff"}}>
            {["Family Office","Endowment","Pension Fund","Individual","Corporate","Sovereign Wealth","Fund of Funds"].map(t=><option key={t}>{t}</option>)}
          </select>
        </div>
      </div>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:20}}>
        <button onClick={()=>setShowAddLP(false)} style={{padding:"8px 16px",border:"0.5px solid var(--color-border-secondary)",borderRadius:8,background:"transparent",fontSize:13,cursor:"pointer"}}>Cancel</button>
        <button onClick={handleAddLP} style={{padding:"8px 18px",background:"#2A1D16",color:"#E8C9A8",border:"none",borderRadius:8,fontSize:13,cursor:"pointer",fontWeight:500}}>Add LP →</button>
      </div>
    </div>
  </div>
)}
      </div>
    </div>
  );
}
