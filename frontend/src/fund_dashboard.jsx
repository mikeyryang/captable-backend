import { useState, useMemo, useEffect, useCallback } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, Legend } from "recharts";
import { LayoutGrid, Building2, Users, TrendingUp, FileText, UserCircle, Calendar } from "lucide-react";

const FUND = {
  name: "Valkyrie Fund I", vintage: 2021, size: 50000000,
  strategy: "Early Stage Technology", manager: "Valkyrie Capital",
  ein: "82-4721039", address: "c/o Valkyrie Capital", city: "San Francisco, CA 94105",
};

const CURRENT_YEAR = new Date().getFullYear();
const TAX_YEARS = Array.from({ length: CURRENT_YEAR - FUND.vintage + 1 }, (_, i) => FUND.vintage + i);

const PORTFOLIO = [
  { id:"pc1", name:"Mohan",       sector:"Deep Tech / Mining AI", invested:2000000, ownership:8.5,  currentMark:8000000, stage:"Series A", date:"2022-03-15", status:"active", moic:4.0 },
  { id:"pc2", name:"NovaBio",     sector:"Biotech",               invested:1500000, ownership:6.2,  currentMark:1500000, stage:"Seed",     date:"2022-07-01", status:"active", moic:1.0 },
  { id:"pc3", name:"DataStream",  sector:"Data Infrastructure",   invested:2000000, ownership:11.0, currentMark:0,       stage:"Exited",   date:"2021-11-10", status:"exited", moic:3.0, realized:6000000, exitDate:"2024-01-15" },
  { id:"pc4", name:"CloudBase",   sector:"SaaS / DevTools",       invested:1000000, ownership:4.8,  currentMark:500000,  stage:"Seed",     date:"2023-02-20", status:"active", moic:0.5 },
  { id:"pc5", name:"QuantumLeap", sector:"Quantum Computing",     invested:3000000, ownership:9.1,  currentMark:9000000, stage:"Series A", date:"2022-01-08", status:"active", moic:3.0 },
  { id:"pc6", name:"AcmeTech",    sector:"Enterprise SaaS",       invested:3000000, ownership:7.3,  currentMark:4500000, stage:"Series B", date:"2021-09-30", status:"active", moic:1.5 },
  { id:"pc7", name:"GreenGrid",   sector:"Climate Tech",          invested:2500000, ownership:5.5,  currentMark:3500000, stage:"Series A", date:"2023-06-15", status:"active", moic:1.4 },
  { id:"pc8", name:"MedAI",       sector:"Healthcare AI",         invested:1500000, ownership:3.9,  currentMark:2000000, stage:"Seed",     date:"2023-09-01", status:"active", moic:1.3 },
];

const LPS = [
  { id:"lp1", name:"Greenwood University Endowment", type:"Endowment",    commitment:15000000, contributed:6900000,  distributions:2400000, nav:8700000  },
  { id:"lp2", name:"Harborview Family Office",       type:"Family Office", commitment:10000000, contributed:4600000,  distributions:1600000, nav:5800000  },
  { id:"lp3", name:"Pacific Pension Fund",           type:"Pension Fund",  commitment:12000000, contributed:5520000,  distributions:1920000, nav:6960000  },
  { id:"lp4", name:"James R. Whitfield III",         type:"Individual",    commitment:5000000,  contributed:2300000,  distributions:800000,  nav:2900000  },
  { id:"lp5", name:"Apex Corporate Ventures",        type:"Corporate",     commitment:8000000,  contributed:3680000,  distributions:1280000, nav:4640000  },
];

const CASHFLOWS = [
  { date:"2021-09-01", amount:-3000000, type:"call", label:"Capital Call 1" },
  { date:"2022-01-15", amount:-5000000, type:"call", label:"Capital Call 2" },
  { date:"2022-09-01", amount:-6000000, type:"call", label:"Capital Call 3" },
  { date:"2023-03-01", amount:-5000000, type:"call", label:"Capital Call 4" },
  { date:"2023-11-01", amount:-4000000, type:"call", label:"Capital Call 5" },
  { date:"2024-01-15", amount:6000000,  type:"dist", label:"DataStream Exit Distribution" },
  { date:"2024-06-01", amount:2000000,  type:"dist", label:"Interim Distribution" },
];

const QUARTERLY = [
  { q:"Q1 2022", nav:18000000, tvpi:0.90 },{ q:"Q2 2022", nav:22000000, tvpi:1.10 },
  { q:"Q3 2022", nav:26000000, tvpi:1.15 },{ q:"Q4 2022", nav:29000000, tvpi:1.18 },
  { q:"Q1 2023", nav:31000000, tvpi:1.25 },{ q:"Q2 2023", nav:35000000, tvpi:1.38 },
  { q:"Q3 2023", nav:38000000, tvpi:1.45 },{ q:"Q4 2023", nav:40000000, tvpi:1.52 },
  { q:"Q1 2024", nav:43000000, tvpi:1.68 },{ q:"Q2 2024", nav:47000000, tvpi:1.78 },
];

const HISTORICAL_METRICS = [
  { year:2021, tvpi:0.88, dpi:0.00, rvpi:0.88, irr:-4.2, nav:18000000,  paidIn:8000000,  distributions:0,       carry:0 },
  { year:2022, tvpi:1.18, dpi:0.00, rvpi:1.18, irr:12.4, nav:29000000,  paidIn:19000000, distributions:0,       carry:0 },
  { year:2023, tvpi:1.52, dpi:0.20, rvpi:1.32, irr:18.7, nav:37000000,  paidIn:23000000, distributions:4600000, carry:1840000 },
  { year:2024, tvpi:1.67, dpi:0.35, rvpi:1.32, irr:22.6, nav:29000000,  paidIn:23000000, distributions:8000000, carry:3040000 },
  { year:2025, tvpi:null, dpi:null, rvpi:null,  irr:null, nav:null,      paidIn:23000000, distributions:null,    carry:null },
  { year:2026, tvpi:null, dpi:null, rvpi:null,  irr:null, nav:null,      paidIn:23000000, distributions:null,    carry:null },
];

const fmt    = n => n==null?"—":n>=1e6?"$"+(n/1e6).toFixed(1)+"M":n>=1e3?"$"+(n/1e3).toFixed(0)+"K":"$"+n.toLocaleString();
const pct    = n => (n*100).toFixed(1)+"%";
const fmtX   = n => n==null?"—":n.toFixed(2)+"x";
const fmtDate= d => new Date(d).toLocaleDateString("en-US",{month:"short",year:"numeric"});
const d$     = n => !n||n===0?"":"$"+Math.round(n).toLocaleString("en-US");
const dParen = n => !n||n===0?"":"$("+Math.round(Math.abs(n)).toLocaleString("en-US")+")";
const dash   = v => v==null ? <span style={{color:"#A89A8C"}}>—</span> : v;

function calcIRR(cashflows) {
  let rate=0.15;
  for(let i=0;i<100;i++){
    let npv=0,dnpv=0;
    const t0=new Date(cashflows[0].date).getTime();
    cashflows.forEach(cf=>{
      const t=(new Date(cf.date).getTime()-t0)/(365.25*24*3600*1000);
      npv+=cf.amount/Math.pow(1+rate,t);
      dnpv+=-t*cf.amount/Math.pow(1+rate,t+1);
    });
    const nr=rate-npv/dnpv;
    if(Math.abs(nr-rate)<1e-7)break;
    rate=nr;
  }
  return rate;
}

export default function FundDashboard() {
  const [portfolio, setPortfolio] = useState(()=>{ const s=localStorage.getItem("vk_portfolio"); return s?JSON.parse(s):PORTFOLIO; });
  const [lps, setLps]             = useState(()=>{ const s=localStorage.getItem("vk_lps");       return s?JSON.parse(s):LPS; });
  const [taxYear, setTaxYear]     = useState(()=>parseInt(localStorage.getItem("vk_taxYear"))||CURRENT_YEAR);
  const [k1Data, setK1Data]       = useState(()=>{ const s=localStorage.getItem("vk_k1data");    return s?JSON.parse(s):{}; });
  const [view, setView]           = useState("overview");
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [showAddCompany, setShowAddCompany]   = useState(false);
  const [showAddLP, setShowAddLP]             = useState(false);
  const [showK1, setShowK1]                   = useState(null);
  const [companyForm, setCompanyForm] = useState({name:"",sector:"",stage:"Seed",invested:"",ownership:"",currentMark:"",date:""});
  const [lpForm, setLpForm]           = useState({name:"",type:"Family Office",commitment:"",contributed:"",distributions:"0",nav:""});

  useEffect(()=>{ localStorage.setItem("vk_portfolio",JSON.stringify(portfolio)); },[portfolio]);
  useEffect(()=>{ localStorage.setItem("vk_lps",JSON.stringify(lps)); },[lps]);
  useEffect(()=>{ localStorage.setItem("vk_taxYear",String(taxYear)); },[taxYear]);
  useEffect(()=>{ localStorage.setItem("vk_k1data",JSON.stringify(k1Data)); },[k1Data]);

  const saveK1Field = useCallback((lpId,field,value)=>{
    setK1Data(prev=>({...prev,[taxYear]:{...(prev[taxYear]||{}),[lpId]:{...(prev[taxYear]?.[lpId]||{}),[field]:value}}}));
  },[taxYear]);

  const getK1Field = useCallback((lpId,field,fallback="")=>{
    return k1Data?.[taxYear]?.[lpId]?.[field]??fallback;
  },[k1Data,taxYear]);

  function handleAddCompany() {
    if(!companyForm.name||!companyForm.invested)return;
    const invested=parseFloat(companyForm.invested);
    const mark=parseFloat(companyForm.currentMark)||invested;
    setPortfolio(prev=>[...prev,{id:"pc"+Date.now(),name:companyForm.name,sector:companyForm.sector||"Other",stage:companyForm.stage,invested,ownership:parseFloat(companyForm.ownership)||0,currentMark:mark,date:companyForm.date||new Date().toISOString().slice(0,10),status:"active",moic:mark/invested}]);
    setCompanyForm({name:"",sector:"",stage:"Seed",invested:"",ownership:"",currentMark:"",date:""});
    setShowAddCompany(false);
  }
  function handleAddLP() {
    if(!lpForm.name||!lpForm.commitment)return;
    setLps(prev=>[...prev,{id:"lp"+Date.now(),name:lpForm.name,type:lpForm.type,commitment:parseFloat(lpForm.commitment),contributed:parseFloat(lpForm.contributed)||0,distributions:parseFloat(lpForm.distributions)||0,nav:parseFloat(lpForm.nav)||0}]);
    setLpForm({name:"",type:"Family Office",commitment:"",contributed:"",distributions:"0",nav:""});
    setShowAddLP(false);
  }

  const metrics = useMemo(()=>{
    const paidIn=CASHFLOWS.filter(c=>c.type==="call").reduce((a,c)=>a+Math.abs(c.amount),0);
    const distributions=CASHFLOWS.filter(c=>c.type==="dist").reduce((a,c)=>a+c.amount,0);
    const unrealized=portfolio.filter(p=>p.status==="active").reduce((a,p)=>a+p.currentMark,0);
    const totalValue=unrealized+distributions;
    const tvpi=totalValue/paidIn,dpi=distributions/paidIn,rvpi=unrealized/paidIn;
    const mgmtFees=paidIn*0.02*3,carry=Math.max(0,(totalValue-paidIn)*0.20);
    const netTvpi=(totalValue-mgmtFees-carry)/paidIn;
    const irrFlows=[...CASHFLOWS,{date:new Date().toISOString().slice(0,10),amount:unrealized,type:"terminal"}];
    const grossIRR=calcIRR(irrFlows),netIRR=grossIRR*0.85;
    return {paidIn,distributions,unrealized,totalValue,tvpi,dpi,rvpi,netTvpi,grossIRR,netIRR,committed:FUND.size,remaining:FUND.size-paidIn,mgmtFees,carry};
  },[portfolio]);

  const lpMetrics = useMemo(()=>({
    totalCommitted:  lps.reduce((a,l)=>a+l.commitment,0),
    totalContributed:lps.reduce((a,l)=>a+l.contributed,0),
    totalDistributed:lps.reduce((a,l)=>a+l.distributions,0),
    totalNAV:        lps.reduce((a,l)=>a+l.nav,0),
  }),[lps]);

  const S = {
    page:     {padding:"24px",maxWidth:1200,margin:"0 auto"},
    layout:   {display:"flex",gap:20,alignItems:"flex-start"},
    sidebar:  {width:200,flexShrink:0,background:"#2A1D16",borderRadius:12,padding:"16px 0",position:"sticky",top:60},
    sbLabel:  {fontSize:9.5,color:"rgba(255,255,255,0.28)",letterSpacing:".08em",textTransform:"uppercase",padding:"0 16px",marginBottom:6,marginTop:12},
    sbItem:   (a)=>({display:"flex",alignItems:"center",gap:9,padding:"9px 16px",fontSize:12.5,cursor:"pointer",color:a?"#E8C9A8":"rgba(255,255,255,0.48)",background:a?"rgba(200,145,90,0.14)":"transparent",borderLeft:a?"2px solid #C8915A":"2px solid transparent",transition:"all .12s",userSelect:"none"}),
    main:     {flex:1,minWidth:0},
    grid4:    {display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:16},
    grid3:    {display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:16},
    grid2:    {display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:14},
    card:     {background:"#fff",border:"0.5px solid var(--color-border-tertiary)",borderRadius:10,padding:"14px 16px",marginBottom:12},
    cardH:    {fontSize:11,color:"var(--color-text-secondary)",marginBottom:3,fontWeight:500},
    cardV:    {fontSize:22,fontWeight:500,color:"var(--color-text-primary)",fontVariantNumeric:"tabular-nums"},
    cardSub:  {fontSize:11,color:"var(--color-text-tertiary)",marginTop:2},
    secH:     {fontSize:12,fontWeight:600,color:"var(--color-text-secondary)",marginBottom:12,letterSpacing:".02em",textTransform:"uppercase"},
    tbl:      {width:"100%",borderCollapse:"collapse",fontSize:12},
    th:       {padding:"8px 12px",textAlign:"left",color:"var(--color-text-secondary)",fontWeight:500,borderBottom:"0.5px solid var(--color-border-tertiary)",fontSize:11,whiteSpace:"nowrap"},
    td:       {padding:"10px 12px",color:"var(--color-text-primary)",borderBottom:"0.5px solid var(--color-border-tertiary)",verticalAlign:"middle"},
    trHover:  {cursor:"pointer",transition:"background .1s"},
    badge:    (c)=>({fontSize:10,padding:"2px 8px",borderRadius:4,fontWeight:500,background:c+"18",color:c}),
    tag:      {fontSize:10,padding:"2px 8px",borderRadius:4,background:"var(--color-background-secondary)",color:"var(--color-text-tertiary)",border:"0.5px solid var(--color-border-tertiary)"},
    moicUp:   {color:"#10B981",fontWeight:500},
    moicFlat: {color:"#F59E0B",fontWeight:500},
    moicDown: {color:"#EF4444",fontWeight:500},
    pageTitle:{fontSize:20,fontWeight:600,color:"var(--color-text-primary)",marginBottom:4},
    pageSub:  {fontSize:12,color:"var(--color-text-secondary)",marginBottom:20},
    input:    {width:"100%",padding:"8px 10px",border:"0.5px solid var(--color-border-secondary)",borderRadius:8,fontSize:13,boxSizing:"border-box",outline:"none"},
    yearTab:  (a)=>({padding:"6px 14px",borderRadius:6,fontSize:12,cursor:"pointer",fontWeight:a?600:400,background:a?"#2A1D16":"var(--color-background-secondary)",color:a?"#E8C9A8":"var(--color-text-secondary)",border:"0.5px solid "+(a?"#2A1D16":"var(--color-border-tertiary)"),transition:"all .12s"}),
  };

  const moicStyle = m => m>=2?S.moicUp:m>=1?S.moicFlat:S.moicDown;
  const moicColor = m => m>=2?"#10B981":m>=1?"#F59E0B":"#EF4444";

  const NAV_ITEMS = [
    {id:"overview",  label:"Overview",     icon:LayoutGrid},
    {id:"portfolio", label:"Portfolio",     icon:Building2},
    {id:"lps",       label:"LP Management",icon:Users},
    {id:"metrics",   label:"Fund Metrics", icon:TrendingUp},
    {id:"documents", label:"Documents",    icon:FileText},
    {id:"lpportal",  label:"LP Portal",    icon:UserCircle},
  ];

  // ── Overview ──────────────────────────────────────────────────
  const Overview = () => {
    const sectorMap={};
    portfolio.forEach(p=>{sectorMap[p.sector]=(sectorMap[p.sector]||0)+(p.currentMark||p.realized||0);});
    const sectorData=Object.entries(sectorMap).map(([name,value])=>({name,value}));
    const COLORS=["#C8915A","#2A1D16","#E8C9A8","#8B6344","#D4A97A","#6B4C32","#F0D9C0","#4A3020"];
    return (
      <div>
        <div style={S.grid4}>
          {[
            {h:"Fund Size",     v:fmt(FUND.size),            sub:`${fmt(metrics.paidIn)} called · ${fmt(metrics.remaining)} remaining`},
            {h:"Total NAV",     v:fmt(metrics.unrealized),   sub:"Unrealized portfolio value"},
            {h:"Distributions", v:fmt(metrics.distributions),sub:"Total returned to LPs"},
            {h:"Portfolio Cos.",v:portfolio.length,           sub:`${portfolio.filter(p=>p.status==="active").length} active · ${portfolio.filter(p=>p.status==="exited").length} exited`},
          ].map((m,i)=>(<div key={i} style={S.card}><div style={S.cardH}>{m.h}</div><div style={S.cardV}>{m.v}</div><div style={S.cardSub}>{m.sub}</div></div>))}
        </div>
        <div style={S.grid3}>
          {[
            {h:"TVPI (Gross)",v:fmtX(metrics.tvpi),   sub:"Total value / paid-in",   color:metrics.tvpi>=2?"#10B981":"#F59E0B"},
            {h:"DPI",         v:fmtX(metrics.dpi),    sub:"Distributions / paid-in", color:metrics.dpi>=1?"#10B981":"#C8915A"},
            {h:"Gross IRR",   v:pct(metrics.grossIRR),sub:"Since first capital call", color:metrics.grossIRR>=0.2?"#10B981":"#F59E0B"},
          ].map((m,i)=>(<div key={i} style={{...S.card,borderTop:`3px solid ${m.color}`}}><div style={S.cardH}>{m.h}</div><div style={{...S.cardV,color:m.color}}>{m.v}</div><div style={S.cardSub}>{m.sub}</div></div>))}
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
                  {sectorData.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                </Pie>
                <Tooltip formatter={(v,n)=>[fmt(v),n]} contentStyle={{fontSize:11,borderRadius:6}}/>
              </PieChart>
            </ResponsiveContainer>
            <div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:4}}>
              {sectorData.map((d,i)=>(<span key={d.name} style={{fontSize:10,display:"flex",alignItems:"center",gap:4,color:"var(--color-text-secondary)"}}><span style={{width:7,height:7,borderRadius:2,background:COLORS[i%COLORS.length],flexShrink:0}}/>{d.name.split(" / ")[0]}</span>))}
            </div>
          </div>
        </div>
        <div style={S.card}>
          <div style={S.secH}>Portfolio snapshot</div>
          <table style={S.tbl}>
            <thead><tr>{["Company","Sector","Invested","Current Mark","MOIC","Status"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>
              {portfolio.slice(0,5).map((p,i)=>(
                <tr key={p.id} style={{...S.trHover,background:i%2===0?"transparent":"#FAF7F3"}} onClick={()=>{setSelectedCompany(p);setView("portfolio");}}>
                  <td style={{...S.td,fontWeight:500}}>{p.name}</td>
                  <td style={S.td}><span style={S.tag}>{p.sector}</span></td>
                  <td style={{...S.td,fontVariantNumeric:"tabular-nums"}}>{fmt(p.invested)}</td>
                  <td style={{...S.td,fontVariantNumeric:"tabular-nums"}}>{p.status==="exited"?<span style={{color:"#10B981"}}>Exited — {fmt(p.realized)}</span>:fmt(p.currentMark)}</td>
                  <td style={{...S.td,...moicStyle(p.moic)}}>{fmtX(p.moic)}</td>
                  <td style={S.td}><span style={S.badge(p.status==="active"?"#10B981":"#6366F1")}>{p.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={()=>setView("portfolio")} style={{marginTop:12,fontSize:12,padding:"6px 14px",border:"0.5px solid var(--color-border-secondary)",borderRadius:6,background:"transparent",color:"var(--color-text-secondary)",cursor:"pointer"}}>View all {portfolio.length} companies →</button>
        </div>
      </div>
    );
  };

  // ── Portfolio ──────────────────────────────────────────────────
  const Portfolio = () => {
    const co=selectedCompany;
    if(co) return (
      <div>
        <button onClick={()=>setSelectedCompany(null)} style={{fontSize:12,padding:"6px 12px",border:"0.5px solid var(--color-border-secondary)",borderRadius:6,background:"transparent",color:"var(--color-text-secondary)",cursor:"pointer",marginBottom:16}}>← Back to portfolio</button>
        <div style={S.card}>
          <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:16}}>
            <div><div style={{fontSize:20,fontWeight:600,marginBottom:4}}>{co.name}</div><span style={S.tag}>{co.sector}</span><span style={{...S.tag,marginLeft:6}}>{co.stage}</span></div>
            <span style={S.badge(co.status==="active"?"#10B981":"#6366F1")}>{co.status}</span>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
            {[
              {h:"Invested",v:fmt(co.invested)},{h:"Current Mark",v:co.status==="exited"?fmt(co.realized):fmt(co.currentMark)},
              {h:"MOIC",v:fmtX(co.moic),color:moicColor(co.moic)},{h:"Ownership",v:pct(co.ownership/100)},
              {h:"Investment Date",v:fmtDate(co.date)},{h:"Stage",v:co.stage},
              {h:"Unrealized G/L",v:fmt((co.currentMark||0)-co.invested),color:(co.currentMark||0)>=co.invested?"#10B981":"#EF4444"},
              {h:"Status",v:co.status[0].toUpperCase()+co.status.slice(1)},
            ].map((m,i)=>(<div key={i} style={{padding:"12px",background:"var(--color-background-secondary)",borderRadius:8}}><div style={{fontSize:10,color:"var(--color-text-tertiary)",marginBottom:4,fontWeight:500}}>{m.h}</div><div style={{fontSize:15,fontWeight:500,color:m.color||"var(--color-text-primary)"}}>{m.v}</div></div>))}
          </div>
        </div>
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
            <thead style={{background:"var(--color-background-secondary)"}}><tr>{["Company","Sector","Stage","Invested","Current Mark","MOIC","Ownership","Status"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
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

  // ── LP Management ──────────────────────────────────────────────
  const LPView = () => (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
        <div style={S.pageTitle}>LP Management</div>
        <button onClick={()=>setShowAddLP(true)} style={{padding:"8px 18px",background:"#2A1D16",color:"#E8C9A8",border:"none",borderRadius:8,fontSize:13,cursor:"pointer",fontWeight:500}}>+ Add LP</button>
      </div>
      <div style={S.pageSub}>{lps.length} limited partners · {fmt(lpMetrics.totalCommitted)} committed · {fmt(lpMetrics.totalContributed)} contributed</div>
      <div style={S.grid4}>
        {[
          {h:"Total Committed",v:fmt(lpMetrics.totalCommitted), sub:"Across all LPs"},
          {h:"Called Capital", v:fmt(lpMetrics.totalContributed),sub:pct(lpMetrics.totalContributed/lpMetrics.totalCommitted)+" of commitments"},
          {h:"Distributions",  v:fmt(lpMetrics.totalDistributed),sub:"Returned to LPs"},
          {h:"Total LP NAV",   v:fmt(lpMetrics.totalNAV),        sub:"Current estimated value"},
        ].map((m,i)=>(<div key={i} style={S.card}><div style={S.cardH}>{m.h}</div><div style={S.cardV}>{m.v}</div><div style={S.cardSub}>{m.sub}</div></div>))}
      </div>
      <div style={{...S.card,padding:0,overflow:"hidden"}}>
        <table style={S.tbl}>
          <thead style={{background:"var(--color-background-secondary)"}}><tr>{["LP Name","Type","Commitment","Contributed","Distributions","Current NAV","TVPI"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
          <tbody>
            {lps.map((lp,i)=>{
              const tvpi=(lp.nav+lp.distributions)/lp.contributed;
              return (<tr key={lp.id} style={{background:i%2===0?"#fff":"#FAF7F3"}}>
                <td style={{...S.td,fontWeight:500}}>{lp.name}</td>
                <td style={S.td}><span style={S.tag}>{lp.type}</span></td>
                <td style={{...S.td,fontVariantNumeric:"tabular-nums"}}>{fmt(lp.commitment)}</td>
                <td style={{...S.td,fontVariantNumeric:"tabular-nums"}}>{fmt(lp.contributed)}</td>
                <td style={{...S.td,fontVariantNumeric:"tabular-nums",color:"#10B981"}}>{fmt(lp.distributions)}</td>
                <td style={{...S.td,fontVariantNumeric:"tabular-nums"}}>{fmt(lp.nav)}</td>
                <td style={{...S.td,...moicStyle(tvpi)}}>{fmtX(tvpi)}</td>
              </tr>);
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

  // ── Fund Metrics ──────────────────────────────────────────────
  const Metrics = () => {
    const cashflowBars=CASHFLOWS.map(c=>({label:c.label.split(" ")[0]+" "+c.label.split(" ")[1],amount:c.amount,color:c.type==="call"?"#EF4444":"#10B981"}));
    const chartData=HISTORICAL_METRICS.filter(y=>y.tvpi!==null);
    return (
      <div>
        <div style={S.pageTitle}>Fund Performance Metrics</div>
        <div style={S.pageSub}>Gross and net performance · {FUND.vintage} vintage · as of {new Date().toLocaleDateString("en-US",{month:"long",year:"numeric"})}</div>
        <div style={{...S.card,marginBottom:14}}>
          <div style={S.secH}>Current performance summary</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:1,background:"var(--color-border-tertiary)",borderRadius:8,overflow:"hidden"}}>
            {[
              {label:"TVPI (Gross)",gross:fmtX(metrics.tvpi),   net:fmtX(metrics.netTvpi),               desc:"Total value / paid-in capital"},
              {label:"DPI",         gross:fmtX(metrics.dpi),    net:fmtX(metrics.dpi*0.88),              desc:"Distributions / paid-in capital"},
              {label:"RVPI",        gross:fmtX(metrics.rvpi),   net:fmtX(metrics.rvpi*0.9),              desc:"Unrealized value / paid-in capital"},
              {label:"IRR",         gross:pct(metrics.grossIRR),net:pct(metrics.netIRR),                 desc:"Internal rate of return"},
              {label:"Paid-In",     gross:fmt(metrics.paidIn),  net:fmt(metrics.paidIn),                 desc:"Capital called from LPs"},
              {label:"Total Value", gross:fmt(metrics.totalValue),net:fmt(metrics.totalValue-metrics.mgmtFees-metrics.carry),desc:"NAV + distributions"},
            ].map((m,i)=>(
              <div key={i} style={{padding:"16px",background:"#fff"}}>
                <div style={{fontSize:11,color:"var(--color-text-tertiary)",marginBottom:8}}>{m.label}</div>
                <div style={{display:"flex",gap:12,alignItems:"baseline"}}>
                  <div><div style={{fontSize:9,color:"var(--color-text-tertiary)",marginBottom:2}}>GROSS</div><div style={{fontSize:18,fontWeight:600,color:"var(--color-text-primary)"}}>{m.gross}</div></div>
                  <div style={{width:"0.5px",height:32,background:"var(--color-border-tertiary)"}}/>
                  <div><div style={{fontSize:9,color:"var(--color-text-tertiary)",marginBottom:2}}>NET</div><div style={{fontSize:18,fontWeight:600,color:"var(--color-text-secondary)"}}>{m.net}</div></div>
                </div>
                <div style={{fontSize:10,color:"var(--color-text-tertiary)",marginTop:6}}>{m.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Year-over-year table */}
        <div style={S.card}>
          <div style={S.secH}>Year-over-year performance</div>
          <div style={{overflowX:"auto"}}>
            <table style={S.tbl}>
              <thead style={{background:"var(--color-background-secondary)"}}>
                <tr>{["Year","TVPI","DPI","RVPI","IRR","NAV","Paid-In","Distributions","Carry"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {HISTORICAL_METRICS.filter(y=>TAX_YEARS.includes(y.year)).map((y,i)=>(
                  <tr key={y.year} style={{background:y.year===taxYear?"rgba(200,145,90,0.08)":i%2===0?"#fff":"#FAF7F3"}}>
                    <td style={{...S.td,fontWeight:600}}>
                      {y.year}
                      {y.year===CURRENT_YEAR&&<span style={{fontSize:10,marginLeft:6,color:"#C8915A"}}>(current)</span>}
                      {y.tvpi===null&&<span style={{fontSize:10,marginLeft:6,color:"#A89A8C"}}>(pending)</span>}
                    </td>
                    <td style={{...S.td,...(y.tvpi!=null?(y.tvpi>=2?S.moicUp:y.tvpi>=1?S.moicFlat:S.moicDown):{}),fontVariantNumeric:"tabular-nums"}}>{dash(y.tvpi!=null?fmtX(y.tvpi):null)}</td>
                    <td style={{...S.td,fontVariantNumeric:"tabular-nums"}}>{dash(y.dpi!=null?fmtX(y.dpi):null)}</td>
                    <td style={{...S.td,fontVariantNumeric:"tabular-nums"}}>{dash(y.rvpi!=null?fmtX(y.rvpi):null)}</td>
                    <td style={{...S.td,color:y.irr!=null?(y.irr>=0?"#10B981":"#EF4444"):"#A89A8C",fontVariantNumeric:"tabular-nums"}}>{y.irr!=null?`${y.irr>=0?"+":""}${y.irr.toFixed(1)}%`:"—"}</td>
                    <td style={{...S.td,fontVariantNumeric:"tabular-nums"}}>{dash(y.nav!=null?fmt(y.nav):null)}</td>
                    <td style={{...S.td,fontVariantNumeric:"tabular-nums"}}>{fmt(y.paidIn)}</td>
                    <td style={{...S.td,fontVariantNumeric:"tabular-nums",color:y.distributions>0?"#10B981":"inherit"}}>{dash(y.distributions!=null?(y.distributions>0?fmt(y.distributions):"—"):null)}</td>
                    <td style={{...S.td,fontVariantNumeric:"tabular-nums"}}>{dash(y.carry!=null?(y.carry>0?fmt(y.carry):"—"):null)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={S.grid2}>
          <div style={S.card}>
            <div style={S.secH}>TVPI & DPI by year</div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} margin={{top:4,right:8,left:0,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-tertiary)" vertical={false}/>
                <XAxis dataKey="year" tick={{fontSize:10}}/>
                <YAxis tickFormatter={v=>v+"x"} tick={{fontSize:9}}/>
                <Tooltip formatter={(v,n)=>[fmtX(v),n.toUpperCase()]} contentStyle={{fontSize:11,borderRadius:6}}/>
                <Legend wrapperStyle={{fontSize:11}}/>
                <Bar dataKey="tvpi" name="TVPI" fill="#C8915A" radius={[3,3,0,0]}/>
                <Bar dataKey="dpi"  name="DPI"  fill="#10B981" radius={[3,3,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={S.card}>
            <div style={S.secH}>NAV over years</div>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData} margin={{top:4,right:8,left:0,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-tertiary)" vertical={false}/>
                <XAxis dataKey="year" tick={{fontSize:10}}/>
                <YAxis tickFormatter={v=>"$"+(v/1e6).toFixed(0)+"M"} tick={{fontSize:9}}/>
                <Tooltip formatter={v=>[fmt(v),"NAV"]} contentStyle={{fontSize:11,borderRadius:6}}/>
                <Line type="monotone" dataKey="nav" stroke="#C8915A" strokeWidth={2} dot={{r:4,fill:"#C8915A"}}/>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={S.card}>
          <div style={S.secH}>Fee & carry summary</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
            {[
              {h:"Management Fees",  v:fmt(metrics.mgmtFees), sub:"2% p.a. on committed"},
              {h:"Carried Interest", v:fmt(metrics.carry),    sub:"20% of profits above cost"},
              {h:"Net Paid-In",      v:fmt(metrics.paidIn),   sub:"LP contributed capital"},
              {h:"Net to LPs",       v:fmt(metrics.totalValue-metrics.mgmtFees-metrics.carry),sub:"After fees & carry"},
            ].map((m,i)=>(<div key={i} style={{padding:"12px",background:"var(--color-background-secondary)",borderRadius:8}}><div style={{fontSize:10,color:"var(--color-text-tertiary)",marginBottom:4}}>{m.h}</div><div style={{fontSize:16,fontWeight:500,color:"var(--color-text-primary)"}}>{m.v}</div><div style={{fontSize:10,color:"var(--color-text-tertiary)",marginTop:2}}>{m.sub}</div></div>))}
          </div>
        </div>
      </div>
    );
  };

  // ── Documents ──────────────────────────────────────────────────
  const Documents = () => (
    <div>
      <div style={S.pageTitle}>Documents & Reporting</div>
      <div style={S.pageSub}>K-1s, financial reports, and LP communications</div>
      <div style={{...S.card,marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <Calendar size={14} color="var(--color-text-secondary)"/>
            <span style={{fontSize:13,fontWeight:500,color:"var(--color-text-primary)"}}>Tax year:</span>
          </div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {TAX_YEARS.map(y=>(
              <button key={y} onClick={()=>setTaxYear(y)} style={S.yearTab(taxYear===y)}>{y}</button>
            ))}
          </div>
          <div style={{marginLeft:"auto",fontSize:11,color:"var(--color-text-tertiary)"}}>
            Filing deadline: <strong style={{color:"var(--color-text-primary)"}}>March 15, {taxYear+1}</strong>
          </div>
        </div>
      </div>
      <div style={S.grid2}>
        {[
          {title:"K-1 Tax Documents",      desc:`Annual Schedule K-1 for each LP showing allocated income, losses, deductions, and credits.`, year:`${taxYear} tax year`,        status:"pending",color:"#F59E0B"},
          {title:"Financial Reports",       desc:"Audited and unaudited financial statements including balance sheet, P&L, and capital account statements.", year:`FY ${taxYear}`, status:"ready",  color:"#10B981"},
          {title:"Capital Call Notices",    desc:"Formal notices to LPs for capital contributions with wiring instructions and deadlines.", year:"Most recent: Call 5",          status:"sent",   color:"#10B981"},
          {title:"Distribution Notices",    desc:"Notices to LPs accompanying distributions with tax withholding details.", year:`${taxYear} distributions`,                    status:"sent",   color:"#10B981"},
          {title:"Quarterly LP Reports",    desc:"Portfolio update, NAV summary, notable events, and outlook for limited partners.", year:`Q4 ${taxYear}`,                      status:"draft",  color:"#C8915A"},
          {title:"Annual Meeting Materials",desc:"Annual meeting deck, fund overview, portfolio deep-dives, and outlook presentation.", year:`${taxYear} annual meeting`,         status:"pending",color:"#F59E0B"},
        ].map((d,i)=>(
          <div key={i} style={{...S.card,display:"flex",flexDirection:"column",gap:10}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div style={{fontSize:13,fontWeight:500}}>{d.title}</div>
              <span style={S.badge(d.color)}>{d.status}</span>
            </div>
            <div style={{fontSize:11,color:"var(--color-text-secondary)",lineHeight:1.6}}>{d.desc}</div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:"auto"}}>
              <span style={{fontSize:11,color:"var(--color-text-tertiary)"}}>{d.year}</span>
              <button style={{fontSize:11,padding:"5px 12px",border:"0.5px solid var(--color-border-secondary)",borderRadius:6,background:"transparent",color:"var(--color-text-secondary)",cursor:"pointer"}}>{d.status==="ready"||d.status==="sent"?"Download →":"Generate →"}</button>
            </div>
          </div>
        ))}
      </div>
      <div style={{...S.card,background:"var(--color-background-secondary)",border:"0.5px dashed var(--color-border-secondary)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
          <div>
            <div style={{fontSize:12,fontWeight:500,marginBottom:2,color:"var(--color-text-secondary)"}}>K-1 Generation — Tax Year {taxYear}</div>
            <div style={{fontSize:11,color:"var(--color-text-tertiary)",lineHeight:1.6}}>Generate Schedule K-1 for all {lps.length} LPs. Fields are pre-filled and fully editable. Changes save automatically.</div>
          </div>
          <div style={{fontSize:11,color:"var(--color-text-tertiary)",textAlign:"right",flexShrink:0,marginLeft:16}}>
            {TAX_YEARS.slice(-4).map(y=>{
              const filed=Object.keys(k1Data?.[y]||{}).length;
              return <div key={y} style={{marginBottom:2}}>{y}: <span style={{color:filed>0?"#10B981":"var(--color-text-tertiary)",fontWeight:filed>0?500:400}}>{filed>0?`${filed} LP${filed>1?"s":""} saved`:"not started"}</span></div>;
            })}
          </div>
        </div>
        <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
          {lps.map(lp=>{
            const saved=!!(k1Data?.[taxYear]?.[lp.id]);
            return (
              <button key={lp.id} onClick={()=>setShowK1(lp)}
                style={{fontSize:12,padding:"8px 16px",background:saved?"#10B981":"#2A1D16",color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontWeight:500}}>
                {saved?"✓ ":""}{lp.name.split(" ")[0]} {taxYear} K-1 →
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  // ── LP Portal ──────────────────────────────────────────────────
  const LPPortal = () => {
    const [selectedLP, setSelectedLP] = useState(null);
    if(!selectedLP) return (
      <div>
        <div style={S.pageTitle}>LP Portal</div>
        <div style={S.pageSub}>Select a limited partner to view their personalized statement</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
          {lps.map(lp=>{
            const tvpi=(lp.nav+lp.distributions)/lp.contributed;
            return (
              <div key={lp.id} onClick={()=>setSelectedLP(lp)} style={{...S.card,cursor:"pointer",borderTop:`3px solid ${tvpi>=2?"#10B981":tvpi>=1?"#C8915A":"#EF4444"}`}}>
                <div style={{fontSize:13,fontWeight:600,marginBottom:4}}>{lp.name}</div>
                <div style={{marginBottom:12}}><span style={S.tag}>{lp.type}</span></div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  {[{l:"Commitment",v:fmt(lp.commitment)},{l:"NAV",v:fmt(lp.nav)},{l:"Distributed",v:fmt(lp.distributions)},{l:"TVPI",v:fmtX(tvpi),color:tvpi>=2?"#10B981":tvpi>=1?"#C8915A":"#EF4444"}].map((m,i)=>(
                    <div key={i}><div style={{fontSize:10,color:"var(--color-text-tertiary)",marginBottom:2}}>{m.l}</div><div style={{fontSize:14,fontWeight:500,color:m.color||"var(--color-text-primary)"}}>{m.v}</div></div>
                  ))}
                </div>
                <div style={{marginTop:12,fontSize:11,color:"#C8915A",fontWeight:500}}>View statement →</div>
              </div>
            );
          })}
        </div>
      </div>
    );
    const lp=selectedLP;
    const tvpi=(lp.nav+lp.distributions)/lp.contributed;
    const dpi=lp.distributions/lp.contributed;
    const rvpi=lp.nav/lp.contributed;
    const ownershipPct=lp.contributed/lpMetrics.totalContributed;
    const capitalCalls=CASHFLOWS.filter(c=>c.type==="call").map(c=>({...c,lpAmount:Math.abs(c.amount)*ownershipPct}));
    const distItems=CASHFLOWS.filter(c=>c.type==="dist").map(c=>({...c,lpAmount:c.amount*ownershipPct}));
    return (
      <div>
        <button onClick={()=>setSelectedLP(null)} style={{fontSize:12,padding:"6px 12px",border:"0.5px solid var(--color-border-secondary)",borderRadius:6,background:"transparent",color:"var(--color-text-secondary)",cursor:"pointer",marginBottom:16}}>← All LPs</button>
        <div style={{...S.card,background:"#2A1D16",border:"none",marginBottom:14}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginBottom:4,letterSpacing:"0.06em",textTransform:"uppercase"}}>LP Statement — {FUND.name}</div>
              <div style={{fontSize:22,fontWeight:600,color:"#F1EFE8",marginBottom:4}}>{lp.name}</div>
              <span style={{fontSize:11,padding:"3px 10px",borderRadius:4,background:"rgba(200,145,90,0.2)",color:"#E8C9A8"}}>{lp.type}</span>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginBottom:4}}>As of {new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}</div>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}>{FUND.vintage} Vintage · {FUND.strategy}</div>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:1,marginTop:20,background:"rgba(255,255,255,0.06)",borderRadius:8,overflow:"hidden"}}>
            {[
              {l:"Commitment",  v:fmt(lp.commitment),   sub:"Total committed"},
              {l:"Called",      v:fmt(lp.contributed),  sub:pct(lp.contributed/lp.commitment)+" called"},
              {l:"Distributed", v:fmt(lp.distributions),sub:"Returned to LP",    color:"#86EFAC"},
              {l:"Current NAV", v:fmt(lp.nav),          sub:"Estimated value"},
              {l:"TVPI",        v:fmtX(tvpi),           sub:"Total value multiple",color:tvpi>=2?"#86EFAC":tvpi>=1?"#E8C9A8":"#FCA5A5"},
            ].map((m,i)=>(<div key={i} style={{padding:"14px 16px",background:"rgba(0,0,0,0.2)"}}><div style={{fontSize:9,color:"rgba(255,255,255,0.35)",marginBottom:6,letterSpacing:"0.06em",textTransform:"uppercase"}}>{m.l}</div><div style={{fontSize:18,fontWeight:600,color:m.color||"#F1EFE8",fontVariantNumeric:"tabular-nums"}}>{m.v}</div><div style={{fontSize:10,color:"rgba(255,255,255,0.35)",marginTop:4}}>{m.sub}</div></div>))}
          </div>
        </div>
        <div style={S.grid2}>
          <div style={S.card}>
            <div style={S.secH}>Performance metrics</div>
            {[
              {l:"TVPI (Total Value / Paid-In)",    v:fmtX(tvpi), desc:"For every $1 invested, current total value"},
              {l:"DPI (Distributions / Paid-In)",   v:fmtX(dpi),  desc:"Capital already returned to you"},
              {l:"RVPI (Residual Value / Paid-In)", v:fmtX(rvpi), desc:"Unrealized value remaining in fund"},
              {l:"Fund ownership (by capital)",     v:pct(ownershipPct),desc:"Your share of total LP contributions"},
            ].map((m,i)=>(<div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:"0.5px solid var(--color-border-tertiary)"}}><div><div style={{fontSize:12,fontWeight:500}}>{m.l}</div><div style={{fontSize:10,color:"var(--color-text-tertiary)",marginTop:2}}>{m.desc}</div></div><div style={{fontSize:16,fontWeight:600,color:m.l.includes("TVPI")?(tvpi>=1?"#10B981":"#EF4444"):"var(--color-text-primary)",fontVariantNumeric:"tabular-nums"}}>{m.v}</div></div>))}
          </div>
          <div style={S.card}>
            <div style={S.secH}>Capital account statement</div>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:11,color:"var(--color-text-tertiary)",marginBottom:8}}>Capital calls</div>
              {capitalCalls.map((c,i)=>(<div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"0.5px solid var(--color-border-tertiary)",fontSize:12}}><span style={{color:"var(--color-text-secondary)"}}>{fmtDate(c.date)} · {c.label}</span><span style={{color:"#EF4444",fontVariantNumeric:"tabular-nums"}}>({fmt(c.lpAmount)})</span></div>))}
            </div>
            <div>
              <div style={{fontSize:11,color:"var(--color-text-tertiary)",marginBottom:8}}>Distributions received</div>
              {distItems.map((c,i)=>(<div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"0.5px solid var(--color-border-tertiary)",fontSize:12}}><span style={{color:"var(--color-text-secondary)"}}>{fmtDate(c.date)} · {c.label}</span><span style={{color:"#10B981",fontVariantNumeric:"tabular-nums"}}>{fmt(c.lpAmount)}</span></div>))}
            </div>
            <div style={{display:"flex",justifyContent:"space-between",padding:"12px 0 0",marginTop:4,fontSize:13,fontWeight:600}}><span>Net capital account</span><span style={{fontVariantNumeric:"tabular-nums"}}>{fmt(lp.nav)}</span></div>
          </div>
        </div>
        <div style={S.card}>
          <div style={S.secH}>Fund overview</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
            {[{l:"Fund TVPI",v:fmtX(metrics.tvpi),sub:"Gross"},{l:"Fund DPI",v:fmtX(metrics.dpi),sub:"Gross"},{l:"Gross IRR",v:pct(metrics.grossIRR),sub:"Since inception"},{l:"Active cos",v:portfolio.filter(p=>p.status==="active").length,sub:"Active investments"}].map((m,i)=>(<div key={i} style={{padding:"12px",background:"var(--color-background-secondary)",borderRadius:8}}><div style={{fontSize:10,color:"var(--color-text-tertiary)",marginBottom:4}}>{m.l}</div><div style={{fontSize:18,fontWeight:600,color:"var(--color-text-primary)"}}>{m.v}</div><div style={{fontSize:10,color:"var(--color-text-tertiary)",marginTop:2}}>{m.sub}</div></div>))}
          </div>
          <div style={{marginTop:14,padding:"12px",background:"#FAF7F3",borderRadius:8,fontSize:11,color:"var(--color-text-tertiary)",lineHeight:1.7}}>
            This statement is provided for informational purposes only and is based on unaudited estimates. Past performance is not indicative of future results. NAV figures represent the GP's estimate of fair value and may differ from amounts realized upon sale.
          </div>
        </div>
      </div>
    );
  };

  // ── K-1 Modal ──────────────────────────────────────────────────
  const K1Modal = ({ lp, onClose }) => {
    if(!lp) return null;
    const ownershipPct=lp.contributed/lpMetrics.totalContributed;
    const ordinaryIncome=Math.max(0,(metrics.totalValue-metrics.paidIn)*ownershipPct*0.4);
    const capitalGains=Math.max(0,(metrics.totalValue-metrics.paidIn)*ownershipPct*0.6);
    const beginningCapital=lp.contributed-lp.distributions*0.3;
    const contributions=lp.contributed*0.15;
    const currentEarnings=ordinaryIncome+capitalGains;
    const withdrawals=lp.distributions;
    const endingCapital=lp.nav;
    const liabNonrecourse=lp.nav*0.12;
    const liabQualified=lp.nav*0.05;

    const Field = ({id,defaultVal,style={}}) => {
      const saved=getK1Field(lp.id,id,defaultVal);
      return (
        <input defaultValue={saved} onBlur={e=>saveK1Field(lp.id,id,e.target.value)}
          style={{border:"none",borderBottom:"1px solid #000",outline:"none",background:"transparent",fontFamily:"Arial,Helvetica,sans-serif",width:"100%",padding:"1px 2px",boxSizing:"border-box",...style}}/>
      );
    };
    const CB = ({filled=false})=>(
      <span style={{display:"inline-block",width:9,height:9,border:"1px solid #000",marginRight:3,verticalAlign:"middle",fontSize:8,textAlign:"center",lineHeight:"9px",background:filled?"#333":"transparent",color:filled?"#fff":"transparent"}}>{filled?"✓":""}</span>
    );
    const PH = {background:"#000",color:"#fff",padding:"2px 4px",fontSize:8.5,fontWeight:700,display:"flex",alignItems:"center",gap:6};
    const PHG = {background:"#e0e0e0",padding:"2px 4px",fontSize:8.5,fontWeight:700,display:"flex",alignItems:"center",gap:6};

    return (
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:2000,display:"flex",alignItems:"flex-start",justifyContent:"center",overflow:"auto",padding:"20px 16px"}} onClick={onClose}>
        <div style={{background:"#fff",maxWidth:820,width:"100%",fontFamily:"Arial,Helvetica,sans-serif"}} onClick={e=>e.stopPropagation()}>
          <div style={{background:"#2A1D16",padding:"10px 18px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <span style={{color:"#E8C9A8",fontSize:13,fontWeight:500}}>Schedule K-1 (Form 1065) {taxYear} — {lp.name}</span>
              <span style={{marginLeft:12,fontSize:11,color:"rgba(255,255,255,0.4)"}}>Filing deadline March 15, {taxYear+1}</span>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>window.print()} style={{padding:"5px 14px",background:"#C8915A",color:"#fff",border:"none",borderRadius:5,fontSize:12,cursor:"pointer",fontWeight:500}}>Print / Save PDF</button>
              <button onClick={onClose} style={{padding:"5px 12px",background:"transparent",color:"rgba(255,255,255,0.55)",border:"0.5px solid rgba(255,255,255,0.2)",borderRadius:5,fontSize:12,cursor:"pointer"}}>Close</button>
            </div>
          </div>
          <div style={{padding:20,fontSize:8}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
              <span style={{fontSize:7,color:"#555"}}>651121</span>
              <div style={{display:"flex",gap:12,fontSize:7.5}}>
                <label><CB/> Final K-1</label>
                <label><CB/> Amended K-1</label>
                <span style={{fontSize:7}}>OMB No. 1545-0123</span>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",border:"1px solid #000"}}>
              {/* LEFT */}
              <div style={{borderRight:"1px solid #000"}}>
                <div style={{padding:"4px 6px",borderBottom:"0.5px solid #000"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                    <div><div style={{fontSize:10,fontWeight:700}}>Schedule K-1</div><div style={{fontSize:9,fontWeight:700}}>(Form 1065)</div><div style={{fontSize:7}}>Department of the Treasury · Internal Revenue Service</div></div>
                    <div style={{fontSize:22,fontWeight:900,userSelect:"none"}}>{taxYear}</div>
                  </div>
                  <div style={{fontSize:7,marginTop:2}}>For calendar year {taxYear}</div>
                </div>
                <div style={{padding:"4px 6px",borderBottom:"0.5px solid #000"}}>
                  <div style={{fontSize:11,fontWeight:900}}>Partner's Share of Income, Deductions, Credits, etc.</div>
                  <div style={{fontSize:7}}>▶ See back of form and separate instructions.</div>
                </div>
                <div style={PHG}><span style={{fontWeight:900,background:"#000",color:"#fff",padding:"0 4px",marginRight:2}}>Part I</span> Information About the Partnership</div>
                <div style={{padding:"3px 5px",borderBottom:"0.5px solid #000"}}>
                  <div style={{fontSize:7,marginBottom:2}}><strong>A</strong> Partnership's employer identification number</div>
                  <Field id="ein" defaultVal={FUND.ein} style={{fontSize:11,fontWeight:700,letterSpacing:1}}/>
                </div>
                <div style={{padding:"3px 5px",borderBottom:"0.5px solid #000",minHeight:44}}>
                  <div style={{fontSize:7,marginBottom:2}}><strong>B</strong> Partnership's name, address, city, state, and ZIP code</div>
                  <Field id="pName"    defaultVal={FUND.name}    style={{fontSize:10,fontWeight:600}}/>
                  <Field id="pAddress" defaultVal={FUND.address} style={{fontSize:8}}/>
                  <Field id="pCity"    defaultVal={FUND.city}    style={{fontSize:8}}/>
                </div>
                <div style={{padding:"3px 5px",borderBottom:"0.5px solid #000"}}>
                  <div style={{fontSize:7,marginBottom:1}}><strong>C</strong> IRS center where partnership filed return ▶</div>
                  <Field id="irsCenter" defaultVal="e-file" style={{fontSize:8}}/>
                </div>
                <div style={{padding:"3px 5px",borderBottom:"0.5px solid #000"}}><div style={{fontSize:7}}><strong>D</strong> <CB/> Check if this is a publicly traded partnership (PTP)</div></div>
                <div style={PHG}><span style={{fontWeight:900,background:"#000",color:"#fff",padding:"0 4px",marginRight:2}}>Part II</span> Information About the Partner</div>
                <div style={{padding:"3px 5px",borderBottom:"0.5px solid #000"}}>
                  <div style={{fontSize:7,marginBottom:2}}><strong>E</strong> Partner's SSN or TIN</div>
                  <Field id="partnerTIN" defaultVal={`**-***${String(lp.id).slice(-4).padStart(4,"0")}`} style={{fontSize:11,fontWeight:700}}/>
                </div>
                <div style={{padding:"3px 5px",borderBottom:"0.5px solid #000",minHeight:40}}>
                  <div style={{fontSize:7,marginBottom:2}}><strong>F</strong> Partner's name and address</div>
                  <Field id="partnerName"    defaultVal={lp.name}                     style={{fontSize:10,fontWeight:600}}/>
                  <Field id="partnerAddress" defaultVal={lp.type+" · Limited Partner"} style={{fontSize:8}}/>
                </div>
                <div style={{padding:"3px 5px",borderBottom:"0.5px solid #000"}}><div style={{fontSize:7}}><strong>G</strong> <CB/> General partner &nbsp;&nbsp; <CB filled/> Limited partner</div></div>
                <div style={{padding:"3px 5px",borderBottom:"0.5px solid #000"}}><div style={{fontSize:7}}><strong>H1</strong> <CB filled/> Domestic partner &nbsp;&nbsp; <CB/> Foreign partner</div></div>
                <div style={{padding:"3px 5px",borderBottom:"0.5px solid #000"}}>
                  <div style={{fontSize:7,marginBottom:1}}><strong>I1</strong> What type of entity is this partner?</div>
                  <Field id="entityType" defaultVal={lp.type} style={{fontSize:8}}/>
                </div>
                <div style={{padding:"3px 5px",borderBottom:"0.5px solid #000"}}><div style={{fontSize:7}}><strong>I2</strong> If this partner is a retirement plan, check here ▶ <CB/></div></div>
                <div style={{padding:"3px 5px",borderBottom:"0.5px solid #000"}}>
                  <div style={{fontSize:7,fontWeight:700,marginBottom:2}}><strong>J</strong> Partner's share of profit, loss, and capital:</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 55px 55px",gap:2,fontSize:7,alignItems:"center"}}>
                    <div/><div style={{textAlign:"center",fontWeight:700}}>Beginning</div><div style={{textAlign:"center",fontWeight:700}}>Ending</div>
                    {["Profit","Loss","Capital"].map(r=>[
                      <div key={r+"l"}>{r}</div>,
                      <Field key={r+"b"} id={`j${r}B`} defaultVal={pct(ownershipPct)} style={{fontSize:8,textAlign:"center"}}/>,
                      <Field key={r+"e"} id={`j${r}E`} defaultVal={pct(ownershipPct)} style={{fontSize:8,textAlign:"center"}}/>,
                    ])}
                  </div>
                </div>
                <div style={{padding:"3px 5px",borderBottom:"0.5px solid #000"}}>
                  <div style={{fontSize:7,fontWeight:700,marginBottom:2}}><strong>K</strong> Partner's share of liabilities:</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 55px 55px",gap:2,fontSize:7,alignItems:"center"}}>
                    <div/><div style={{textAlign:"center",fontWeight:700}}>Beginning</div><div style={{textAlign:"center",fontWeight:700}}>Ending</div>
                    <div>Nonrecourse</div>
                    <Field id="kNRB" defaultVal={"$"+Math.round(liabNonrecourse*0.9).toLocaleString()} style={{fontSize:8,textAlign:"right"}}/>
                    <Field id="kNRE" defaultVal={"$"+Math.round(liabNonrecourse).toLocaleString()}     style={{fontSize:8,textAlign:"right"}}/>
                    <div>Qualified nonrecourse</div>
                    <Field id="kQNRB" defaultVal={"$"+Math.round(liabQualified*0.9).toLocaleString()} style={{fontSize:8,textAlign:"right"}}/>
                    <Field id="kQNRE" defaultVal={"$"+Math.round(liabQualified).toLocaleString()}     style={{fontSize:8,textAlign:"right"}}/>
                    <div>Recourse</div>
                    <Field id="kRB" defaultVal="" style={{fontSize:8,textAlign:"right"}}/>
                    <Field id="kRE" defaultVal="" style={{fontSize:8,textAlign:"right"}}/>
                  </div>
                </div>
                <div style={{padding:"3px 5px",borderBottom:"0.5px solid #000"}}>
                  <div style={{fontSize:7,fontWeight:700,textAlign:"center",marginBottom:3}}><strong>L</strong> Partner's Capital Account Analysis</div>
                  {[
                    {id:"lBeg",  label:"Beginning capital account",            val:d$(beginningCapital)},
                    {id:"lCon",  label:"Capital contributed during the year",  val:d$(contributions)},
                    {id:"lInc",  label:"Current year net income (loss)",        val:d$(currentEarnings)},
                    {id:"lOth",  label:"Other increase (decrease)",             val:""},
                    {id:"lWith", label:"Withdrawals and distributions",         val:dParen(-withdrawals)},
                  ].map(r=>(
                    <div key={r.id} style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:2}}>
                      <span style={{fontSize:7,flex:1}}>{r.label} . . .</span>
                      <Field id={r.id} defaultVal={r.val} style={{width:80,flexShrink:0,fontSize:8,fontWeight:600,textAlign:"right",fontVariantNumeric:"tabular-nums"}}/>
                    </div>
                  ))}
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",borderTop:"1px solid #000",paddingTop:2,marginTop:2}}>
                    <span style={{fontSize:7,fontWeight:700,flex:1}}>Ending capital account . . .</span>
                    <Field id="lEnd" defaultVal={d$(endingCapital)} style={{width:80,flexShrink:0,fontSize:10,fontWeight:700,textAlign:"right",fontVariantNumeric:"tabular-nums"}}/>
                  </div>
                </div>
                <div style={{padding:"3px 5px",borderBottom:"0.5px solid #000"}}><div style={{fontSize:7}}><strong>M</strong> Partner contribute property with built-in gain? <CB/> Yes &nbsp; <CB filled/> No</div></div>
                <div style={{padding:"3px 5px"}}>
                  <div style={{fontSize:7,fontWeight:700,marginBottom:2}}><strong>N</strong> Net Unrecognized Section 704(c) Gain or (Loss)</div>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}><span style={{fontSize:7}}>Beginning . . .</span><Field id="n704B" defaultVal="" style={{width:70,fontSize:8,textAlign:"right"}}/></div>
                  <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:7}}>Ending . . . . .</span><Field id="n704E" defaultVal="" style={{width:70,fontSize:8,textAlign:"right"}}/></div>
                </div>
              </div>
              {/* RIGHT — Part III */}
              <div style={{display:"flex",flexDirection:"column"}}>
                <div style={PH}><span style={{fontWeight:900,padding:"0 4px",border:"1px solid #fff",marginRight:2}}>Part III</span><span style={{fontSize:8}}>Partner's Share of Current Year Income,<br/>Deductions, Credits, and Other Items</span></div>
                <div style={{flex:1,padding:"2px 4px"}}>
                  {[
                    {n:"1",  l:"Ordinary business income (loss)",             id:"b1",   v:d$(ordinaryIncome),  bold:true},
                    {n:"2",  l:"Net rental real estate income (loss)",         id:"b2",   v:""},
                    {n:"3",  l:"Other net rental income (loss)",               id:"b3",   v:""},
                    {n:"4a", l:"Guaranteed payments for services",             id:"b4a",  v:""},
                    {n:"4b", l:"Guaranteed payments for capital",              id:"b4b",  v:""},
                    {n:"4c", l:"Total guaranteed payments",                    id:"b4c",  v:""},
                    {n:"5",  l:"Interest income",                              id:"b5",   v:""},
                    {n:"6a", l:"Ordinary dividends",                           id:"b6a",  v:""},
                    {n:"6b", l:"Qualified dividends",                          id:"b6b",  v:""},
                    {n:"6c", l:"Dividend equivalents",                         id:"b6c",  v:""},
                    {n:"7",  l:"Royalties",                                    id:"b7",   v:""},
                    {n:"8",  l:"Net short-term capital gain (loss)",           id:"b8",   v:""},
                    {n:"9a", l:"Net long-term capital gain (loss)",            id:"b9a",  v:d$(capitalGains),    bold:true},
                    {n:"9b", l:"Collectibles (28%) gain (loss)",               id:"b9b",  v:""},
                    {n:"9c", l:"Unrecaptured section 1250 gain",               id:"b9c",  v:""},
                    {n:"10", l:"Net section 1231 gain (loss)",                 id:"b10",  v:""},
                    {n:"11", l:"Other income (loss)",                          id:"b11",  v:""},
                    {n:"12", l:"Section 179 deduction",                        id:"b12",  v:""},
                    {n:"13", l:"Other deductions",                             id:"b13",  v:""},
                    {n:"14", l:"Self-employment earnings (loss)",              id:"b14",  v:""},
                    {n:"15", l:"Credits",                                      id:"b15",  v:""},
                    {n:"16", l:"Schedule K-3 attached if checked ▶",          id:null,   v:null, checkbox:true},
                    {n:"17", l:"Alternative minimum tax (AMT) items",          id:"b17",  v:""},
                    {n:"18", l:"Tax-exempt income / nondeductible expenses",   id:"b18",  v:""},
                    {n:"19", l:"Distributions",                                id:"b19",  v:d$(withdrawals),     bold:true},
                    {n:"20", l:"Other information",                            id:"b20",  v:"See stmt"},
                    {n:"21", l:"Foreign taxes paid or accrued",                id:"b21",  v:""},
                  ].map((item,i)=>(
                    <div key={i} style={{display:"grid",gridTemplateColumns:"16px 1fr 85px",gap:2,padding:"2px 2px",borderBottom:"0.5px solid #ddd",alignItems:"start",minHeight:18}}>
                      <div style={{fontSize:8,fontWeight:700,paddingTop:2}}>{item.n}</div>
                      <div style={{fontSize:7,lineHeight:1.3,fontWeight:item.bold?700:400,paddingTop:2}}>{item.l}</div>
                      {item.checkbox?<div style={{paddingTop:2}}><CB/></div>:<Field id={item.id} defaultVal={item.v||""} style={{fontSize:9,fontWeight:item.bold?700:600,textAlign:"right",fontVariantNumeric:"tabular-nums"}}/>}
                    </div>
                  ))}
                  <div style={{padding:"3px 3px",borderBottom:"0.5px solid #ddd"}}>
                    <div style={{fontSize:7,marginBottom:2}}><CB/> <strong>22</strong> More than one activity for at-risk purposes*</div>
                    <div style={{fontSize:7}}><CB/> <strong>23</strong> More than one activity for passive activity purposes*</div>
                  </div>
                  <div style={{padding:"2px 3px",fontSize:6.5,fontStyle:"italic"}}>*See attached statement for additional information.</div>
                  <div style={{display:"flex",justifyContent:"flex-end",marginTop:4,paddingRight:4}}>
                    <div style={{border:"1px solid #000",padding:"3px 5px",fontSize:7,writingMode:"vertical-rl",textOrientation:"mixed",transform:"rotate(180deg)",height:60,display:"flex",alignItems:"center",justifyContent:"center"}}>For IRS Use Only</div>
                  </div>
                </div>
              </div>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",marginTop:4,fontSize:7,color:"#444"}}>
              <span>For Paperwork Reduction Act Notice, see the Instructions for Form 1065.</span>
              <span>www.irs.gov/Form1065</span>
              <span>Cat. No. 11394R</span>
              <span style={{fontWeight:700}}>Schedule K-1 (Form 1065) {taxYear}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const VIEWS = {overview:<Overview/>,portfolio:<Portfolio/>,lps:<LPView/>,metrics:<Metrics/>,documents:<Documents/>,lpportal:<LPPortal/>};

  return (
    <div style={S.page}>
      <div style={S.layout}>
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
          {NAV_ITEMS.map(n=>(
            <div key={n.id} style={S.sbItem(view===n.id)} onClick={()=>{setView(n.id);setSelectedCompany(null);}}>
              <n.icon size={14} strokeWidth={1.75}/><span>{n.label}</span>
            </div>
          ))}
          <div style={S.sbLabel}>Fund</div>
          <div style={{padding:"0 16px"}}>
            {[{l:"Size",v:fmt(FUND.size)},{l:"Called",v:pct(metrics.paidIn/FUND.size)},{l:"LPs",v:lps.length},{l:"Companies",v:portfolio.length},{l:"Tax Year",v:taxYear}].map(r=>(
              <div key={r.l} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"0.5px solid rgba(255,255,255,0.05)",fontSize:11}}>
                <span style={{color:"rgba(255,255,255,0.35)"}}>{r.l}</span>
                <span style={{color:"rgba(255,255,255,0.65)"}}>{r.v}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={S.main}>{VIEWS[view]}</div>
      </div>

      {showAddCompany && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setShowAddCompany(false)}>
          <div style={{background:"#fff",borderRadius:12,padding:28,width:480,maxWidth:"90vw"}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:16,fontWeight:600,marginBottom:20}}>Add Portfolio Company</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              {[{label:"Company name *",key:"name",type:"text",placeholder:"e.g. Acme Corp"},{label:"Sector",key:"sector",type:"text",placeholder:"e.g. Deep Tech"},{label:"Invested ($) *",key:"invested",type:"number",placeholder:"e.g. 2000000"},{label:"Current mark ($)",key:"currentMark",type:"number",placeholder:"Leave blank = cost"},{label:"Ownership (%)",key:"ownership",type:"number",placeholder:"e.g. 8.5"},{label:"Investment date",key:"date",type:"date",placeholder:""}].map(f=>(
                <div key={f.key}><label style={{fontSize:11,fontWeight:500,color:"var(--color-text-secondary)",display:"block",marginBottom:4}}>{f.label}</label><input type={f.type} placeholder={f.placeholder} value={companyForm[f.key]} onChange={e=>setCompanyForm(p=>({...p,[f.key]:e.target.value}))} style={S.input}/></div>
              ))}
              <div><label style={{fontSize:11,fontWeight:500,color:"var(--color-text-secondary)",display:"block",marginBottom:4}}>Stage</label><select value={companyForm.stage} onChange={e=>setCompanyForm(p=>({...p,stage:e.target.value}))} style={{...S.input,background:"#fff"}}>{["Pre-Seed","Seed","Series A","Series B","Series C","Growth","Exited"].map(s=><option key={s}>{s}</option>)}</select></div>
            </div>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:20}}>
              <button onClick={()=>setShowAddCompany(false)} style={{padding:"8px 16px",border:"0.5px solid var(--color-border-secondary)",borderRadius:8,background:"transparent",fontSize:13,cursor:"pointer"}}>Cancel</button>
              <button onClick={handleAddCompany} style={{padding:"8px 18px",background:"#2A1D16",color:"#E8C9A8",border:"none",borderRadius:8,fontSize:13,cursor:"pointer",fontWeight:500}}>Add Company →</button>
            </div>
          </div>
        </div>
      )}

      {showAddLP && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setShowAddLP(false)}>
          <div style={{background:"#fff",borderRadius:12,padding:28,width:480,maxWidth:"90vw"}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:16,fontWeight:600,marginBottom:20}}>Add Limited Partner</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              {[{label:"LP Name *",key:"name",type:"text",placeholder:"e.g. Greenwood Endowment"},{label:"Commitment ($) *",key:"commitment",type:"number",placeholder:"e.g. 10000000"},{label:"Contributed ($)",key:"contributed",type:"number",placeholder:"e.g. 8000000"},{label:"Distributions ($)",key:"distributions",type:"number",placeholder:"e.g. 1000000"},{label:"Current NAV ($)",key:"nav",type:"number",placeholder:"e.g. 12000000"}].map(f=>(
                <div key={f.key}><label style={{fontSize:11,fontWeight:500,color:"var(--color-text-secondary)",display:"block",marginBottom:4}}>{f.label}</label><input type={f.type} placeholder={f.placeholder} value={lpForm[f.key]} onChange={e=>setLpForm(p=>({...p,[f.key]:e.target.value}))} style={S.input}/></div>
              ))}
              <div><label style={{fontSize:11,fontWeight:500,color:"var(--color-text-secondary)",display:"block",marginBottom:4}}>LP Type</label><select value={lpForm.type} onChange={e=>setLpForm(p=>({...p,type:e.target.value}))} style={{...S.input,background:"#fff"}}>{["Family Office","Endowment","Pension Fund","Individual","Corporate","Sovereign Wealth","Fund of Funds"].map(t=><option key={t}>{t}</option>)}</select></div>
            </div>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:20}}>
              <button onClick={()=>setShowAddLP(false)} style={{padding:"8px 16px",border:"0.5px solid var(--color-border-secondary)",borderRadius:8,background:"transparent",fontSize:13,cursor:"pointer"}}>Cancel</button>
              <button onClick={handleAddLP} style={{padding:"8px 18px",background:"#2A1D16",color:"#E8C9A8",border:"none",borderRadius:8,fontSize:13,cursor:"pointer",fontWeight:500}}>Add LP →</button>
            </div>
          </div>
        </div>
      )}

      <K1Modal lp={showK1} onClose={()=>setShowK1(null)}/>
    </div>
  );
}
