import { useState, useMemo } from "react";
import { Sparkles, FileText, Send, Banknote, ClipboardCheck, Search, Printer } from "lucide-react";

// ==============================================================================
// REPORT STUDIO: Automated fund back-office
// Generates quarterly LP report packages, capital call notices, distribution
// notices, and audit-ready valuation memos, live from fund data in seconds.
// Standards: ILPA Reporting Template (2016/2024), IPEV (2022), IRS Form 1065 ctx.
// ==============================================================================

const fmt    = n => n==null?"-":Math.abs(n)>=1e6?"$"+(n/1e6).toFixed(2)+"M":Math.abs(n)>=1e3?"$"+(n/1e3).toFixed(0)+"K":"$"+Math.round(n).toLocaleString();
const fmtFull= n => n==null?"-":"$"+Math.round(n).toLocaleString("en-US");
const fmtX   = n => n==null||!isFinite(n)?"-":n.toFixed(2)+"x";
const pct    = n => n==null||!isFinite(n)?"-":(n*100).toFixed(1)+"%";
const fmtD   = d => d?new Date(d).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}):"-";

// ---- Quarter utilities -------------------------------------------------------
function quarterOf(dateStr){ const d=new Date(dateStr); return {y:d.getFullYear(), q:Math.floor(d.getMonth()/3)+1}; }
function quarterLabel(qt){ return `Q${qt.q} ${qt.y}`; }
function quarterRange(qt){
  const start=new Date(qt.y,(qt.q-1)*3,1);
  const end  =new Date(qt.y,qt.q*3,0,23,59,59);
  return {start,end};
}
function inQuarter(dateStr,qt){ const t=new Date(dateStr).getTime(); const{start,end}=quarterRange(qt); return t>=start.getTime()&&t<=end.getTime(); }
function listQuarters(vintageYear){
  const out=[]; const now=new Date(); const curY=now.getFullYear(), curQ=Math.floor(now.getMonth()/3)+1;
  for(let y=vintageYear;y<=curY;y++) for(let q=1;q<=4;q++){ if(y===curY&&q>curQ)break; out.push({y,q}); }
  return out.reverse();
}

// ---- Auto-commentary engine (deterministic draft; GP review required) --------
function generateCommentary({metrics, portfolio, cashflows, qt, fund}){
  const active   = portfolio.filter(p=>p.status==="active");
  const exited   = portfolio.filter(p=>p.status==="exited");
  const top      = [...active].sort((a,b)=>(b.moic||0)-(a.moic||0))[0];
  const laggard  = [...active].sort((a,b)=>(a.moic||0)-(b.moic||0))[0];
  const qCalls   = cashflows.filter(c=>c.type==="call"&&inQuarter(c.date,qt));
  const qDists   = cashflows.filter(c=>c.type==="dist"&&inQuarter(c.date,qt));
  const calledPct= metrics.paidIn/(fund.size||1);

  const paras = [];
  paras.push(
    `As of quarter end, ${fund.name} reports a gross TVPI of ${fmtX(metrics.tvpi)} (${fmtX(metrics.netTvpi)} net of fees and carried interest), a DPI of ${fmtX(metrics.dpi)}, and a gross IRR of ${pct(metrics.grossIRR)} since first capital call. Total fund NAV stands at ${fmt(metrics.unrealized)} across ${active.length} active portfolio companies, with cumulative distributions of ${fmt(metrics.distributions)} returned to limited partners.`
  );
  if(top){
    paras.push(
      `Portfolio performance ${top.moic>=2?"was led by":"was anchored by"} ${top.name} (${top.sector.split(" / ")[0]}), currently marked at ${fmtX(top.moic)} MOIC on ${fmt(top.invested)} invested.` +
      (exited.length?` The fund has fully realized ${exited.length} position${exited.length>1?"s":""} to date, including ${exited[0].name} at ${fmtX(exited[0].moic)} (${fmt(exited[0].realized)} in proceeds).`:"") +
      (laggard&&laggard.moic<1?` ${laggard.name} remains marked below cost at ${fmtX(laggard.moic)}; the GP continues to monitor the position and will adjust the mark per IPEV guidance if conditions warrant.`:"")
    );
  }
  paras.push(
    `The fund has called ${pct(calledPct)} of committed capital (${fmt(metrics.paidIn)} of ${fmt(fund.size)}), leaving ${fmt(metrics.remaining)} in dry powder for follow-on reserves and new positions.` +
    (qCalls.length?` During the quarter, ${qCalls.length} capital call${qCalls.length>1?"s were":" was"} issued totaling ${fmt(qCalls.reduce((a,c)=>a+Math.abs(c.amount),0))}.`:"") +
    (qDists.length?` ${qDists.length} distribution${qDists.length>1?"s":""} totaling ${fmt(qDists.reduce((a,c)=>a+c.amount,0))} ${qDists.length>1?"were":"was"} paid to limited partners during the period.`:` No distributions were paid during the period.`)
  );
  const safes = portfolio.filter(p=>p.instrumentType==="safe"||p.hasSafes);
  if(safes.length){
    paras.push(
      `Note on SAFE holdings: ${safes.length} position${safes.length>1?"s are":" is"} held via unconverted SAFE instruments and carried at cost per ASC 820 / IPEV Section 3.1. The GP separately maintains probability-weighted economic estimates for these positions (see the Valuation Methodology appendix); regulatory TVPI above reflects cost basis only and may understate economic value.`
    );
  }
  return paras;
}

// ---- Ask Frontier: deterministic query engine over live fund data ------------
function answerQuery(q, {lps, portfolio, cashflows, metrics, fund}){
  const s=q.toLowerCase().trim();
  if(!s) return null;
  const findLP = ()=> lps.find(lp=>lp.name.toLowerCase().split(/[\s,]+/).some(w=>w.length>3&&s.includes(w.toLowerCase())));
  const findCo = ()=> portfolio.find(p=>s.includes(p.name.toLowerCase()));
  const lp=findLP(), co=findCo();
  const totCommit=lps.reduce((a,l)=>a+l.commitment,0), totContrib=lps.reduce((a,l)=>a+l.contributed,0);

  if(/unfunded|remaining commit|uncalled/.test(s)){
    if(lp) return {t:`${lp.name}: unfunded commitment`, b:`${fmtFull(lp.commitment-lp.contributed)} remaining of ${fmtFull(lp.commitment)} committed (${pct(lp.contributed/lp.commitment)} called to date).`};
    return {t:"Fund: uncalled capital", b:`${fmtFull(fund.size-metrics.paidIn)} of ${fmtFull(fund.size)} remains uncalled (${pct(metrics.paidIn/fund.size)} called).`};
  }
  if(/tvpi|total value/.test(s)){
    if(lp){const v=(lp.nav+lp.distributions)/lp.contributed; return {t:`${lp.name}: TVPI`, b:`${fmtX(v)}, computed as (${fmt(lp.nav)} NAV + ${fmt(lp.distributions)} distributed) divided by ${fmt(lp.contributed)} contributed.`};}
    return {t:"Fund TVPI", b:`Gross ${fmtX(metrics.tvpi)} · Net ${fmtX(metrics.netTvpi)} (after ${fmt(metrics.mgmtFees)} fees and ${fmt(metrics.carry)} carry).`};
  }
  if(/\bdpi\b|distributed to paid/.test(s)){
    if(lp) return {t:`${lp.name}: DPI`, b:`${fmtX(lp.distributions/lp.contributed)} (${fmt(lp.distributions)} returned on ${fmt(lp.contributed)} contributed).`};
    return {t:"Fund DPI", b:`${fmtX(metrics.dpi)}, with ${fmt(metrics.distributions)} distributed on ${fmt(metrics.paidIn)} paid-in.`};
  }
  if(/\birr\b/.test(s)) return {t:"Fund IRR", b:`Gross ${pct(metrics.grossIRR)} · Net approx. ${pct(metrics.netIRR)}. Computed via Newton-Raphson on dated cashflows; terminal value equals unrealized NAV only, so distributions are never double-counted.`};
  if(/rvpi|residual/.test(s)) return {t:"Fund RVPI", b:`${fmtX(metrics.rvpi)}, with ${fmt(metrics.unrealized)} unrealized on ${fmt(metrics.paidIn)} paid-in.`};
  if(/best|top perform|highest moic|winner/.test(s)){
    const sorted=[...portfolio].sort((a,b)=>(b.moic||0)-(a.moic||0)).slice(0,3);
    return {t:"Top performers by MOIC", rows:sorted.map(p=>[p.name, fmtX(p.moic), p.status==="exited"?`realized ${fmt(p.realized)}`:`marked ${fmt(p.currentMark)}`])};
  }
  if(/worst|laggard|lowest|below cost|underperform/.test(s)){
    const below=portfolio.filter(p=>p.status==="active"&&p.moic<1);
    if(!below.length) return {t:"Positions below cost", b:"No active positions are currently marked below cost."};
    return {t:"Positions marked below cost", rows:below.map(p=>[p.name, fmtX(p.moic), `${fmt(p.currentMark)} on ${fmt(p.invested)} invested`])};
  }
  if(/distribut/.test(s)){
    const dists=cashflows.filter(c=>c.type==="dist");
    if(lp){const share=lp.contributed/totContrib; return {t:`${lp.name}: distribution history`, rows:dists.map(d=>[fmtD(d.date), d.label, fmtFull(d.amount*share)])};}
    return {t:"Fund distributions", rows:dists.map(d=>[fmtD(d.date), d.label, fmtFull(d.amount)])};
  }
  if(/capital call|call history|calls/.test(s)){
    const calls=cashflows.filter(c=>c.type==="call");
    if(lp){const share=lp.commitment/totCommit; return {t:`${lp.name}: capital call history`, rows:calls.map(c=>[fmtD(c.date), c.label, fmtFull(Math.abs(c.amount)*share)])};}
    return {t:"Fund capital calls", rows:calls.map(c=>[fmtD(c.date), c.label, fmtFull(Math.abs(c.amount))])};
  }
  if(/own(ership)?/.test(s)&&co) return {t:`${co.name}: ownership`, b:`The fund holds ${co.ownership}% of ${co.name} (${co.stage}), acquired ${fmtD(co.date)} for ${fmt(co.invested)}.`};
  if(/sector|exposure|concentrat/.test(s)){
    const m={}; portfolio.forEach(p=>{const k=p.sector.split(" / ")[0]; m[k]=(m[k]||0)+(p.currentMark||p.realized||0);});
    const tot=Object.values(m).reduce((a,v)=>a+v,0);
    return {t:"Sector exposure by value", rows:Object.entries(m).sort((a,b)=>b[1]-a[1]).map(([k,v])=>[k, fmt(v), pct(v/tot)])};
  }
  if(/exit/.test(s)){
    const ex=portfolio.filter(p=>p.status==="exited");
    if(!ex.length) return {t:"Exits", b:"No positions have been exited to date."};
    return {t:"Realized exits", rows:ex.map(p=>[p.name, fmtD(p.exitDate), `${fmt(p.realized)} (${fmtX(p.moic)})`])};
  }
  if(/fees|carry|carried/.test(s)) return {t:"Fees & carry", b:`Management fees to date: ${fmt(metrics.mgmtFees)} (2% p.a. model). Accrued carried interest: ${fmt(metrics.carry)} (20% of ${fmt(metrics.totalValue-metrics.paidIn)} profit). Net-to-LP total value: ${fmt(metrics.totalValue-metrics.mgmtFees-metrics.carry)}.`};
  if(/nav|value/.test(s)){
    if(co) return {t:`${co.name}: current mark`, b:co.status==="exited"?`Exited ${fmtD(co.exitDate)} for ${fmt(co.realized)} (${fmtX(co.moic)}).`:`Marked at ${fmt(co.currentMark)} (${fmtX(co.moic)} on ${fmt(co.invested)} invested).`};
    if(lp) return {t:`${lp.name}: capital account NAV`, b:`${fmtFull(lp.nav)} current NAV · ${fmtFull(lp.distributions)} distributed to date · ${fmtX((lp.nav+lp.distributions)/lp.contributed)} TVPI.`};
    return {t:"Fund NAV", b:`${fmt(metrics.unrealized)} unrealized across ${portfolio.filter(p=>p.status==="active").length} active companies. Total value including distributions: ${fmt(metrics.totalValue)}.`};
  }
  if(lp) return {t:`${lp.name}: summary`, b:`${lp.type} · ${fmtFull(lp.commitment)} committed · ${fmtFull(lp.contributed)} contributed (${fmtFull(lp.commitment-lp.contributed)} unfunded) · ${fmtFull(lp.distributions)} distributed · ${fmtFull(lp.nav)} NAV · ${fmtX((lp.nav+lp.distributions)/lp.contributed)} TVPI.`};
  if(co) return {t:`${co.name}: summary`, b:`${co.sector} · ${co.stage} · invested ${fmt(co.invested)} on ${fmtD(co.date)} for ${co.ownership}% · ${co.status==="exited"?`exited for ${fmt(co.realized)}`:`marked ${fmt(co.currentMark)}`} · ${fmtX(co.moic)} MOIC.`};
  return {t:"Try asking:", rows:[
    ["\"What is Greenwood's unfunded commitment?\"","",""],
    ["\"Show me all capital calls\" · \"Pacific's distribution history\"","",""],
    ["\"Top performers\" · \"Which companies are below cost?\"","",""],
    ["\"Sector exposure\" · \"Fund IRR\" · \"How much do we own of Mohan?\"","",""],
  ]};
}

// ---- Shared print-document shell (white, Arial, professional output) ---------
function DocShell({ children, onClose, printLabel="Print / Save PDF", headerTitle }){
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:3000,display:"flex",alignItems:"flex-start",justifyContent:"center",overflow:"auto",padding:"20px 16px"}} onClick={onClose}>
      <div style={{background:"#fff",maxWidth:820,width:"100%",fontFamily:"Arial,Helvetica,sans-serif",borderRadius:4}} onClick={e=>e.stopPropagation()}>
        <div style={{background:"#1A0F0A",padding:"10px 18px",display:"flex",justifyContent:"space-between",alignItems:"center"}} className="no-print">
          <span style={{color:"#E8C9A8",fontSize:13,fontWeight:500}}>{headerTitle}</span>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>window.print()} style={{padding:"5px 14px",background:"#C8915A",color:"#fff",border:"none",borderRadius:5,fontSize:12,cursor:"pointer",fontWeight:500,display:"flex",alignItems:"center",gap:6}}><Printer size={12}/>{printLabel}</button>
            <button onClick={onClose} style={{padding:"5px 12px",background:"transparent",color:"rgba(255,255,255,0.55)",border:"0.5px solid rgba(255,255,255,0.2)",borderRadius:5,fontSize:12,cursor:"pointer"}}>Close</button>
          </div>
        </div>
        <div style={{padding:"28px 36px",color:"#1a1a1a"}}>{children}</div>
      </div>
    </div>
  );
}
const DH1 = ({children})=><div style={{fontSize:20,fontWeight:800,color:"#1A0F0A",marginBottom:2}}>{children}</div>;
const DSub= ({children})=><div style={{fontSize:11,color:"#888",marginBottom:16}}>{children}</div>;
const DSec= ({children})=><div style={{fontSize:11,fontWeight:700,color:"#1A0F0A",textTransform:"uppercase",letterSpacing:"0.08em",borderBottom:"2px solid #C8915A",paddingBottom:4,margin:"20px 0 10px"}}>{children}</div>;
const DRow= ({l,v,bold,color})=>(
  <div style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"0.5px solid #eee",fontSize:12}}>
    <span style={{color:"#555"}}>{l}</span><span style={{fontWeight:bold?700:500,color:color||"#1a1a1a",fontVariantNumeric:"tabular-nums"}}>{v}</span>
  </div>
);
function DTable({headers,rows}){
  return (
    <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,marginBottom:6}}>
      <thead><tr>{headers.map(h=><th key={h} style={{textAlign:"left",padding:"6px 8px",background:"#1A0F0A",color:"#fff",fontSize:10,fontWeight:700}}>{h}</th>)}</tr></thead>
      <tbody>{rows.map((r,i)=>(<tr key={i} style={{background:i%2?"#FAF7F3":"#fff"}}>{r.map((c,j)=><td key={j} style={{padding:"6px 8px",borderBottom:"0.5px solid #eee",fontVariantNumeric:"tabular-nums"}}>{c}</td>)}</tr>))}</tbody>
    </table>
  );
}
const DFooter = ({fund})=>(
  <div style={{marginTop:24,paddingTop:10,borderTop:"1px solid #ddd",fontSize:9,color:"#999",lineHeight:1.6}}>
    CONFIDENTIAL. Prepared by {fund.manager} via the Frontier Fund Management Platform. Figures are unaudited estimates unless otherwise stated and are subject to the terms of the Fund's Limited Partnership Agreement. Past performance is not indicative of future results. Performance metrics follow ILPA (2016) and GIPS (2020) definitions; valuations follow the IPEV Board Valuation Guidelines (2022). This document does not constitute an offer to sell securities.
  </div>
);

// ---- Document 1: Quarterly LP Report ------------------------------------------
function QuarterlyReport({ lp, qt, lps, portfolio, cashflows, metrics, fund, onClose }){
  const totCommit=lps.reduce((a,l)=>a+l.commitment,0), totContrib=lps.reduce((a,l)=>a+l.contributed,0);
  const callShare=lp.commitment/totCommit, distShare=lp.contributed/totContrib;
  const qCalls=cashflows.filter(c=>c.type==="call"&&inQuarter(c.date,qt));
  const qDists=cashflows.filter(c=>c.type==="dist"&&inQuarter(c.date,qt));
  const lpTVPI=(lp.nav+lp.distributions)/lp.contributed;
  const commentary=generateCommentary({metrics,portfolio,cashflows,qt,fund});
  const hasSafes=portfolio.some(p=>p.instrumentType==="safe"||p.hasSafes);
  return (
    <DocShell onClose={onClose} headerTitle={`Quarterly Report · ${lp.name} · ${quarterLabel(qt)}`}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div>
          <DH1>{fund.name}</DH1>
          <DSub>Quarterly Report to Limited Partners · {quarterLabel(qt)} · {fund.vintage} Vintage · {fund.strategy}</DSub>
        </div>
        <div style={{textAlign:"right",fontSize:10,color:"#888"}}>
          <div style={{fontWeight:700,color:"#C8915A",fontSize:11,letterSpacing:"0.08em"}}>CONFIDENTIAL</div>
          <div>Prepared for:</div>
          <div style={{fontWeight:700,color:"#1a1a1a",fontSize:12}}>{lp.name}</div>
          <div>{lp.type} · Limited Partner</div>
        </div>
      </div>

      <DSec>1. Fund Performance Summary</DSec>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:1,background:"#ddd",borderRadius:4,overflow:"hidden",marginBottom:8}}>
        {[
          {l:"Gross TVPI",v:fmtX(metrics.tvpi)},{l:"Net TVPI",v:fmtX(metrics.netTvpi)},{l:"DPI",v:fmtX(metrics.dpi)},{l:"RVPI",v:fmtX(metrics.rvpi)},
          {l:"Gross IRR",v:pct(metrics.grossIRR)},{l:"Net IRR",v:pct(metrics.netIRR)},{l:"Fund NAV",v:fmt(metrics.unrealized)},{l:"Dry Powder",v:fmt(metrics.remaining)},
        ].map((m,i)=>(<div key={i} style={{background:"#fff",padding:"10px 12px"}}><div style={{fontSize:9,color:"#999",marginBottom:3,textTransform:"uppercase"}}>{m.l}</div><div style={{fontSize:15,fontWeight:700,fontVariantNumeric:"tabular-nums"}}>{m.v}</div></div>))}
      </div>

      <DSec>2. Your Capital Account</DSec>
      <DRow l="Total commitment" v={fmtFull(lp.commitment)}/>
      <DRow l="Contributed capital to date" v={fmtFull(lp.contributed)}/>
      <DRow l="Unfunded commitment" v={fmtFull(lp.commitment-lp.contributed)}/>
      <DRow l="Cumulative distributions received" v={fmtFull(lp.distributions)} color="#0d7d4d"/>
      <DRow l="Capital account NAV (quarter end)" v={fmtFull(lp.nav)} bold/>
      <DRow l="Your TVPI" v={fmtX(lpTVPI)} bold color={lpTVPI>=1?"#0d7d4d":"#c0392b"}/>
      <DRow l="Your DPI" v={fmtX(lp.distributions/lp.contributed)}/>
      <DRow l="Share of contributed capital" v={pct(distShare)}/>

      <DSec>3. Activity During {quarterLabel(qt)}</DSec>
      {qCalls.length===0&&qDists.length===0
        ? <div style={{fontSize:12,color:"#777",padding:"4px 0 8px"}}>No capital calls or distributions occurred during the period.</div>
        : <DTable headers={["Date","Activity","Fund Amount","Your Pro-Rata"]} rows={[
            ...qCalls.map(c=>[fmtD(c.date), c.label, fmtFull(Math.abs(c.amount)), "("+fmtFull(Math.abs(c.amount)*callShare)+")"]),
            ...qDists.map(d=>[fmtD(d.date), d.label, fmtFull(d.amount), fmtFull(d.amount*distShare)]),
          ]}/>
      }

      <DSec>4. Portfolio Summary</DSec>
      <DTable headers={["Company","Sector","Stage","Invested","Mark / Realized","MOIC","Status"]}
        rows={portfolio.map(p=>[p.name, p.sector.split(" / ")[0], p.stage, fmt(p.invested), p.status==="exited"?fmt(p.realized)+" (realized)":fmt(p.currentMark), fmtX(p.moic), p.status])}/>

      <DSec>5. Manager Commentary</DSec>
      <div style={{fontSize:9,color:"#b8860b",marginBottom:6,fontStyle:"italic"}}>Auto-generated draft from fund data; subject to GP review and sign-off before distribution.</div>
      {commentary.map((p,i)=><p key={i} style={{fontSize:12,lineHeight:1.7,color:"#333",marginBottom:8}}>{p}</p>)}

      <DSec>6. Valuation Methodology</DSec>
      <p style={{fontSize:11,lineHeight:1.7,color:"#444"}}>
        Portfolio company valuations are determined in accordance with the IPEV Board Valuation Guidelines (2022) and ASC 820. Priced equity positions are marked using the price of the most recent arm's-length transaction where available (IPEV Section 3.3), or an appropriate multiple or DCF methodology otherwise. Realized positions reflect actual proceeds.
        {hasSafes && " Unconverted SAFE instruments are carried at cost (IPEV Section 3.1); the GP separately maintains probability-weighted economic estimates for these positions, available on request, which are unaudited and excluded from the regulatory figures above."}
        {" "}Performance metrics follow ILPA and GIPS definitions; IRR is computed on dated cashflows with terminal value equal to unrealized NAV.
      </p>
      <DFooter fund={fund}/>
    </DocShell>
  );
}

// ---- Document 2: Capital Call Notice ------------------------------------------
function CallNotice({ lp, callAmount, dueDate, purpose, lps, metrics, fund, onClose }){
  const totCommit=lps.reduce((a,l)=>a+l.commitment,0);
  const share=lp.commitment/totCommit;
  const lpCall=callAmount*share;
  const wire=JSON.parse(localStorage.getItem("vk_wire")||"{}");
  const saveWire=(k,v)=>{const w=JSON.parse(localStorage.getItem("vk_wire")||"{}");w[k]=v;localStorage.setItem("vk_wire",JSON.stringify(w));};
  const W=({k,ph})=><input defaultValue={wire[k]||""} placeholder={ph} onBlur={e=>saveWire(k,e.target.value)} style={{border:"none",borderBottom:"1px solid #999",outline:"none",fontFamily:"inherit",fontSize:12,width:"100%",padding:"1px 2px"}}/>;
  return (
    <DocShell onClose={onClose} headerTitle={`Capital Call Notice · ${lp.name}`}>
      <div style={{display:"flex",justifyContent:"space-between"}}>
        <div><DH1>Capital Call Notice</DH1><DSub>{fund.name} · Notice date: {fmtD(new Date().toISOString())}</DSub></div>
        <div style={{textAlign:"right",fontSize:10,color:"#888"}}><div style={{fontWeight:700,color:"#c0392b",fontSize:11}}>ACTION REQUIRED</div><div>Payment due: <strong style={{color:"#1a1a1a"}}>{fmtD(dueDate)}</strong></div></div>
      </div>
      <p style={{fontSize:12,lineHeight:1.7,color:"#333"}}>
        Dear {lp.name},<br/><br/>
        Pursuant to Section 4 of the Limited Partnership Agreement of {fund.name}, the General Partner hereby issues a capital call in the aggregate amount of <strong>{fmtFull(callAmount)}</strong>. Your pro-rata share, based on your commitment of {fmtFull(lp.commitment)} ({pct(share)} of total commitments), is set forth below.
        {purpose?` The proceeds of this call will be used for: ${purpose}.`:""}
      </p>
      <DSec>Your Capital Call</DSec>
      <DRow l="Total fund call amount" v={fmtFull(callAmount)}/>
      <DRow l={`Your pro-rata share (${pct(share)})`} v={fmtFull(lpCall)} bold color="#c0392b"/>
      <DRow l="Payment due date" v={fmtD(dueDate)} bold/>
      <DSec>Your Commitment Status After This Call</DSec>
      <DRow l="Total commitment" v={fmtFull(lp.commitment)}/>
      <DRow l="Contributed prior to this call" v={fmtFull(lp.contributed)}/>
      <DRow l="This capital call" v={fmtFull(lpCall)}/>
      <DRow l="Cumulative contributed after this call" v={fmtFull(lp.contributed+lpCall)} bold/>
      <DRow l="Remaining unfunded commitment" v={fmtFull(Math.max(0,lp.commitment-lp.contributed-lpCall))} bold/>
      <DSec>Wire Instructions</DSec>
      <div style={{display:"grid",gridTemplateColumns:"140px 1fr",gap:"8px 12px",fontSize:12,alignItems:"baseline",marginBottom:4}}>
        <span style={{color:"#555"}}>Bank name:</span><W k="bank" ph="________________"/>
        <span style={{color:"#555"}}>ABA / Routing:</span><W k="aba" ph="________________"/>
        <span style={{color:"#555"}}>Account number:</span><W k="acct" ph="________________"/>
        <span style={{color:"#555"}}>Account name:</span><W k="acctName" ph={fund.name}/>
        <span style={{color:"#555"}}>Reference:</span><W k="ref" ph={`${lp.name} Capital Call`}/>
      </div>
      <p style={{fontSize:11,color:"#666",lineHeight:1.6}}>Please reference your LP name on all wires. Late contributions are subject to the default provisions of the LPA. Contact the GP with any questions.</p>
      <div style={{marginTop:22,fontSize:12}}>
        <div style={{marginBottom:26}}>Sincerely,</div>
        <div style={{borderTop:"1px solid #999",width:220,paddingTop:4}}>General Partner, {fund.manager}</div>
      </div>
      <DFooter fund={fund}/>
    </DocShell>
  );
}

// ---- Document 3: Distribution Notice ------------------------------------------
function DistNotice({ lp, distAmount, source, rocPct, lps, fund, onClose }){
  const totContrib=lps.reduce((a,l)=>a+l.contributed,0);
  const share=lp.contributed/totContrib;
  const lpDist=distAmount*share;
  const roc=lpDist*(rocPct/100), gain=lpDist-roc;
  return (
    <DocShell onClose={onClose} headerTitle={`Distribution Notice · ${lp.name}`}>
      <div style={{display:"flex",justifyContent:"space-between"}}>
        <div><DH1>Distribution Notice</DH1><DSub>{fund.name} · Notice date: {fmtD(new Date().toISOString())}</DSub></div>
        <div style={{textAlign:"right",fontSize:10}}><div style={{fontWeight:700,color:"#0d7d4d",fontSize:11}}>PAYMENT TO YOU</div></div>
      </div>
      <p style={{fontSize:12,lineHeight:1.7,color:"#333"}}>
        Dear {lp.name},<br/><br/>
        The General Partner of {fund.name} is pleased to announce a distribution in the aggregate amount of <strong>{fmtFull(distAmount)}</strong>{source?`, arising from ${source}`:""}. Your share, based on contributed capital of {fmtFull(lp.contributed)} ({pct(share)} of total contributions), will be remitted to your account of record.
      </p>
      <DSec>Your Distribution</DSec>
      <DRow l="Total fund distribution" v={fmtFull(distAmount)}/>
      <DRow l={`Your pro-rata share (${pct(share)})`} v={fmtFull(lpDist)} bold color="#0d7d4d"/>
      <DSec>Character of Distribution (Estimated)</DSec>
      <DRow l={`Return of capital (${rocPct}%)`} v={fmtFull(roc)}/>
      <DRow l={`Gain (${100-rocPct}%)`} v={fmtFull(gain)}/>
      <div style={{fontSize:10,color:"#888",margin:"6px 0 0",lineHeight:1.6}}>Final tax character will be reported on your Schedule K-1 for the applicable tax year. This estimate is provided for planning purposes only and is not tax advice.</div>
      <DSec>Your Capital Account After Distribution</DSec>
      <DRow l="Cumulative distributions (incl. this)" v={fmtFull(lp.distributions+lpDist)}/>
      <DRow l="Updated DPI" v={fmtX((lp.distributions+lpDist)/lp.contributed)} bold/>
      <div style={{marginTop:22,fontSize:12}}>
        <div style={{marginBottom:26}}>Sincerely,</div>
        <div style={{borderTop:"1px solid #999",width:220,paddingTop:4}}>General Partner, {fund.manager}</div>
      </div>
      <DFooter fund={fund}/>
    </DocShell>
  );
}

// ---- Document 4: Valuation Memo (audit-ready) ---------------------------------
const METHOD_LABELS = {
  cost:"Cost (IPEV 3.1)", safe_cap:"SAFE at Cap (IPEV 3.2)", safe_discount:"SAFE at Discount (IPEV 3.2)",
  recent_round:"Price of Recent Transaction (IPEV 3.3)", revenue_mult:"Revenue Multiple (IPEV 3.4)",
  ebitda_mult:"EBITDA Multiple (IPEV 3.5)", dcf:"Discounted Cash Flow (IPEV 3.6)",
  market_price:"Quoted Market Price (IPEV 3.8)", market_disc:"Market Price less Lock-up Discount (IPEV 3.8)",
  nav:"Net Asset Value (IPEV 3.9)", nav_disc:"NAV less Liquidity Discount (IPEV 3.9)",
};
function ValuationMemo({ company:p, fund, onClose }){
  const method = p.status==="exited" ? "Realized proceeds (position exited)"
    : METHOD_LABELS[p.valuationMethod] || (p.instrumentType==="safe" ? "Cost (IPEV 3.1), unconverted SAFE" : "Price of Recent Transaction (IPEV 3.3) / Cost");
  const staleDays = Math.floor((Date.now()-new Date(p.lastUpdated||p.date).getTime())/(864e5));
  const mark = p.status==="exited"?p.realized:p.currentMark;
  return (
    <DocShell onClose={onClose} headerTitle={`Valuation Memo · ${p.name}`}>
      <DH1>Valuation Memorandum</DH1>
      <DSub>{fund.name} · {p.name} · As of {fmtD(new Date().toISOString())} · Prepared via Frontier Valuation Workbench</DSub>
      <DSec>1. Position Summary</DSec>
      <DRow l="Portfolio company" v={p.name} bold/>
      <DRow l="Sector / Stage" v={`${p.sector} · ${p.stage}`}/>
      <DRow l="Initial investment date" v={fmtD(p.date)}/>
      <DRow l="Amount invested" v={fmtFull(p.invested)}/>
      <DRow l="Fully-diluted ownership" v={p.ownership+"%"}/>
      <DRow l="Status" v={p.status==="exited"?`Exited ${fmtD(p.exitDate)}`:"Active"}/>
      <DSec>2. Valuation Conclusion</DSec>
      <DRow l="Methodology applied" v={method} bold/>
      <DRow l={p.status==="exited"?"Realized proceeds":"Fair value mark"} v={fmtFull(mark)} bold/>
      <DRow l="MOIC" v={fmtX(p.moic)} bold color={p.moic>=1?"#0d7d4d":"#c0392b"}/>
      <DRow l="Unrealized gain / (loss) vs cost" v={fmtFull((mark||0)-p.invested)} color={(mark||0)>=p.invested?"#0d7d4d":"#c0392b"}/>
      <DSec>3. Basis for Conclusion</DSec>
      <p style={{fontSize:12,lineHeight:1.7,color:"#333"}}>
        {p.status==="exited"
          ? `The position was fully realized on ${fmtD(p.exitDate)} for total proceeds of ${fmtFull(p.realized)}, representing a ${fmtX(p.moic)} multiple on invested capital. No further valuation judgment is required.`
          : `The fair value of the Fund's position in ${p.name} has been determined using the methodology above, consistent with the IPEV Board Valuation Guidelines (December 2022) and ASC 820 (fair value hierarchy). ${p.instrumentType==="safe" ? `The position is held via an unconverted SAFE instrument and is accordingly carried at cost; a probability-weighted economic estimate is maintained separately by the GP and is excluded from regulatory reporting. ` : ""}The most recent observable data point for this position is ${staleDays} days old${staleDays>365?", which the GP acknowledges exceeds the 12-month staleness threshold; the mark has been reviewed for indicators of impairment or appreciation under IPEV Section 2.4":staleDays>180?", within acceptable range though approaching the recalibration threshold":""}. The GP has considered company performance, financing environment, and comparable transactions in affirming this mark.`
        }
      </p>
      {p.valuationInputs?.manualOverride && (
        <>
          <DSec>4. Manual Override Disclosure</DSec>
          <p style={{fontSize:12,lineHeight:1.7,color:"#333"}}>The calculated mark was overridden by the GP pursuant to IPEV Section 1.4. Documented reason: "{p.valuationInputs.overrideReason||"-"}". This override is recorded in the platform audit trail.</p>
        </>
      )}
      <DSec>{p.valuationInputs?.manualOverride?"5":"4"}. Sign-Off</DSec>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:24,marginTop:16,fontSize:11}}>
        <div><div style={{borderTop:"1px solid #999",paddingTop:4}}>Prepared by</div></div>
        <div><div style={{borderTop:"1px solid #999",paddingTop:4}}>Reviewed & approved: General Partner</div></div>
      </div>
      <DFooter fund={fund}/>
    </DocShell>
  );
}

// ==============================================================================
// MAIN: Report Studio view
// ==============================================================================
export default function ReportStudio({ lps, portfolio, cashflows, metrics, fund }){
  const FUND = fund || { name:"Valkyrie Fund I", vintage:2021, size:50000000, strategy:"Early Stage Technology", manager:"Valkyrie Capital" };
  const quarters = listQuarters(FUND.vintage);
  const [tab, setTab] = useState("quarterly");
  const [qt, setQt]   = useState(quarters[1]||quarters[0]); // default: last completed quarter
  const [reportLP, setReportLP] = useState(null);
  const [callCfg, setCallCfg]   = useState({amount:0, dueDate:"", purpose:""});
  const [callLP, setCallLP]     = useState(null);
  const [distCfg, setDistCfg]   = useState({amount:0, source:"", rocPct:40});
  const [distLP, setDistLP]     = useState(null);
  const [memoCo, setMemoCo]     = useState(null);
  const [query, setQuery]       = useState("");
  const [askResult, setAskResult] = useState(null);

  const S = {
    card:{background:"#fff",border:"0.5px solid var(--color-border-tertiary)",borderRadius:10,padding:"16px 18px",marginBottom:12},
    secH:{fontSize:12,fontWeight:600,color:"var(--color-text-secondary)",marginBottom:12,letterSpacing:"0.02em",textTransform:"uppercase"},
    input:{width:"100%",padding:"8px 10px",border:"0.5px solid var(--color-border-secondary)",borderRadius:8,fontSize:13,boxSizing:"border-box",outline:"none",background:"var(--color-background-primary)",color:"var(--color-text-primary)"},
    label:{display:"block",fontSize:11,fontWeight:500,color:"var(--color-text-secondary)",marginBottom:4},
    btn:{padding:"7px 14px",background:"#2A1D16",color:"#E8C9A8",border:"none",borderRadius:7,fontSize:12,cursor:"pointer",fontWeight:500},
    btnGhost:{padding:"6px 12px",border:"0.5px solid var(--color-border-secondary)",borderRadius:7,background:"transparent",fontSize:12,cursor:"pointer",color:"var(--color-text-secondary)"},
    tab:(a)=>({padding:"8px 16px",borderRadius:8,fontSize:12.5,cursor:"pointer",fontWeight:a?600:400,background:a?"#2A1D16":"var(--color-background-secondary)",color:a?"#E8C9A8":"var(--color-text-secondary)",border:"0.5px solid "+(a?"#2A1D16":"var(--color-border-tertiary)"),display:"flex",alignItems:"center",gap:7,transition:"all .12s"}),
  };
  const totCommit=lps.reduce((a,l)=>a+l.commitment,0);

  const TABS = [
    {id:"quarterly", label:"Quarterly Reports", icon:FileText},
    {id:"calls",     label:"Capital Calls",     icon:Send},
    {id:"dists",     label:"Distributions",     icon:Banknote},
    {id:"memos",     label:"Valuation Memos",   icon:ClipboardCheck},
    {id:"ask",       label:"Ask Frontier",      icon:Search},
  ];

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
        <Sparkles size={20} color="#C8915A"/>
        <div style={{fontSize:20,fontWeight:600,color:"var(--color-text-primary)"}}>Report Studio</div>
      </div>
      <div style={{fontSize:12,color:"var(--color-text-secondary)",marginBottom:16}}>
        The quarterly close, automated: LP report packages, capital call and distribution notices, and audit-ready valuation memos, generated live from fund data. ILPA / IPEV / GIPS compliant formats.
      </div>

      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
        {TABS.map(t=>(<div key={t.id} style={S.tab(tab===t.id)} onClick={()=>setTab(t.id)}><t.icon size={13}/>{t.label}</div>))}
      </div>

      {/* TAB: Quarterly Reports */}
      {tab==="quarterly" && (
        <div style={S.card}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:10}}>
            <div style={S.secH}>Quarterly LP Report Package</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {quarters.slice(0,8).map(q=>(
                <button key={quarterLabel(q)} onClick={()=>setQt(q)}
                  style={{...S.btnGhost,...(qt.y===q.y&&qt.q===q.q?{background:"#2A1D16",color:"#E8C9A8",borderColor:"#2A1D16"}:{})}}>
                  {quarterLabel(q)}
                </button>
              ))}
            </div>
          </div>
          <div style={{fontSize:12,color:"var(--color-text-secondary)",marginBottom:14,lineHeight:1.7}}>
            Each report contains the fund performance summary (8 metrics), the LP's personalized capital account, quarter activity with pro-rata amounts, the full portfolio table, auto-drafted manager commentary, and the IPEV valuation methodology appendix. What a fund administrator assembles over days, generated in one click per LP.
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:10}}>
            {lps.map(lp=>{
              const tvpi=(lp.nav+lp.distributions)/lp.contributed;
              return (
                <div key={lp.id} style={{border:"0.5px solid var(--color-border-tertiary)",borderRadius:9,padding:"12px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
                  <div style={{minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{lp.name}</div>
                    <div style={{fontSize:11,color:"var(--color-text-tertiary)",marginTop:2}}>{fmt(lp.commitment)} committed · {fmtX(tvpi)} TVPI</div>
                  </div>
                  <button style={S.btn} onClick={()=>setReportLP(lp)}>Generate →</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB: Capital Calls */}
      {tab==="calls" && (
        <div style={S.card}>
          <div style={S.secH}>Capital Call Notice Generator</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:14}}>
            <div><label style={S.label}>Total call amount ($)</label>
              <input type="text" inputMode="numeric" placeholder="e.g. 4000000" defaultValue={callCfg.amount||""} onBlur={e=>setCallCfg(p=>({...p,amount:parseFloat(e.target.value)||0}))} style={S.input}/></div>
            <div><label style={S.label}>Payment due date</label>
              <input type="date" defaultValue={callCfg.dueDate} onBlur={e=>setCallCfg(p=>({...p,dueDate:e.target.value}))} style={S.input}/></div>
            <div><label style={S.label}>Purpose (optional)</label>
              <input type="text" placeholder="e.g. follow-on investment in QuantumLeap Series B" defaultValue={callCfg.purpose} onBlur={e=>setCallCfg(p=>({...p,purpose:e.target.value}))} style={S.input}/></div>
          </div>
          {callCfg.amount>0 ? (
            <>
              <div style={{fontSize:12,color:"var(--color-text-secondary)",marginBottom:12}}>
                Per-LP allocation (commitment-basis pro-rata). Wire instructions are entered once and persist across all notices.
              </div>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                <thead><tr>{["LP","Commitment","Pro-Rata %","This Call","Unfunded After",""].map(h=><th key={h} style={{padding:"7px 10px",textAlign:"left",color:"var(--color-text-secondary)",fontWeight:500,borderBottom:"0.5px solid var(--color-border-tertiary)",fontSize:11}}>{h}</th>)}</tr></thead>
                <tbody>
                  {lps.map((lp,i)=>{
                    const share=lp.commitment/totCommit, amt=callCfg.amount*share;
                    return (
                      <tr key={lp.id} style={{background:i%2?"#FAF7F3":"#fff"}}>
                        <td style={{padding:"8px 10px",fontWeight:500}}>{lp.name}</td>
                        <td style={{padding:"8px 10px",fontVariantNumeric:"tabular-nums"}}>{fmt(lp.commitment)}</td>
                        <td style={{padding:"8px 10px",fontVariantNumeric:"tabular-nums"}}>{pct(share)}</td>
                        <td style={{padding:"8px 10px",fontWeight:600,fontVariantNumeric:"tabular-nums",color:"#C8915A"}}>{fmtFull(amt)}</td>
                        <td style={{padding:"8px 10px",fontVariantNumeric:"tabular-nums"}}>{fmtFull(Math.max(0,lp.commitment-lp.contributed-amt))}</td>
                        <td style={{padding:"8px 10px"}}><button style={S.btnGhost} onClick={()=>setCallLP(lp)}>Notice →</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          ) : <div style={{fontSize:12,color:"var(--color-text-tertiary)"}}>Enter a call amount to generate the per-LP allocation and notices.</div>}
        </div>
      )}

      {/* TAB: Distributions */}
      {tab==="dists" && (
        <div style={S.card}>
          <div style={S.secH}>Distribution Notice Generator</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:14}}>
            <div><label style={S.label}>Total distribution ($)</label>
              <input type="text" inputMode="numeric" placeholder="e.g. 6000000" defaultValue={distCfg.amount||""} onBlur={e=>setDistCfg(p=>({...p,amount:parseFloat(e.target.value)||0}))} style={S.input}/></div>
            <div><label style={S.label}>Source (optional)</label>
              <input type="text" placeholder="e.g. the sale of DataStream, Inc." defaultValue={distCfg.source} onBlur={e=>setDistCfg(p=>({...p,source:e.target.value}))} style={S.input}/></div>
            <div><label style={S.label}>Return-of-capital % (est.)</label>
              <input type="text" inputMode="numeric" placeholder="e.g. 40" defaultValue={distCfg.rocPct||""} onBlur={e=>setDistCfg(p=>({...p,rocPct:Math.min(100,Math.max(0,parseFloat(e.target.value)||0))}))} style={S.input}/></div>
          </div>
          {distCfg.amount>0 ? (
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead><tr>{["LP","Contributed","Pro-Rata %","Distribution","New DPI",""].map(h=><th key={h} style={{padding:"7px 10px",textAlign:"left",color:"var(--color-text-secondary)",fontWeight:500,borderBottom:"0.5px solid var(--color-border-tertiary)",fontSize:11}}>{h}</th>)}</tr></thead>
              <tbody>
                {(()=>{const totC=lps.reduce((a,l)=>a+l.contributed,0);
                  return lps.map((lp,i)=>{
                    const share=lp.contributed/totC, amt=distCfg.amount*share;
                    return (
                      <tr key={lp.id} style={{background:i%2?"#FAF7F3":"#fff"}}>
                        <td style={{padding:"8px 10px",fontWeight:500}}>{lp.name}</td>
                        <td style={{padding:"8px 10px",fontVariantNumeric:"tabular-nums"}}>{fmt(lp.contributed)}</td>
                        <td style={{padding:"8px 10px",fontVariantNumeric:"tabular-nums"}}>{pct(share)}</td>
                        <td style={{padding:"8px 10px",fontWeight:600,fontVariantNumeric:"tabular-nums",color:"#10B981"}}>{fmtFull(amt)}</td>
                        <td style={{padding:"8px 10px",fontVariantNumeric:"tabular-nums"}}>{fmtX((lp.distributions+amt)/lp.contributed)}</td>
                        <td style={{padding:"8px 10px"}}><button style={S.btnGhost} onClick={()=>setDistLP(lp)}>Notice →</button></td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          ) : <div style={{fontSize:12,color:"var(--color-text-tertiary)"}}>Enter a distribution amount to generate per-LP notices with estimated tax character.</div>}
        </div>
      )}

      {/* TAB: Valuation Memos */}
      {tab==="memos" && (
        <div style={S.card}>
          <div style={S.secH}>Audit-Ready Valuation Memos</div>
          <div style={{fontSize:12,color:"var(--color-text-secondary)",marginBottom:14,lineHeight:1.7}}>
            One memo per position, per quarter: methodology, basis for conclusion, staleness check, override disclosure, and GP sign-off block. Auditors request exactly this package every year; here it regenerates itself from the Valuation Workbench data.
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:10}}>
            {portfolio.map(p=>(
              <div key={p.id} style={{border:"0.5px solid var(--color-border-tertiary)",borderRadius:9,padding:"12px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
                <div style={{minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:600}}>{p.name}</div>
                  <div style={{fontSize:11,color:"var(--color-text-tertiary)",marginTop:2}}>
                    {p.status==="exited"?`Realized ${fmtX(p.moic)}`:`${fmt(p.currentMark)} · ${fmtX(p.moic)}`}
                    {p.valuationMethod?` · ${(METHOD_LABELS[p.valuationMethod]||"").split(" (")[0]}`:""}
                  </div>
                </div>
                <button style={S.btn} onClick={()=>setMemoCo(p)}>Memo →</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB: Ask Frontier */}
      {tab==="ask" && (
        <div style={S.card}>
          <div style={S.secH}>Ask Frontier: Query the Fund in Plain English</div>
          <div style={{display:"flex",gap:8,marginBottom:12}}>
            <input type="text" placeholder={`e.g. "What is Greenwood's unfunded commitment?"`}
              defaultValue={query}
              onKeyDown={e=>{ if(e.key==="Enter"){ setQuery(e.target.value); setAskResult(answerQuery(e.target.value,{lps,portfolio,cashflows,metrics,fund:FUND})); } }}
              style={{...S.input,flex:1}}/>
            <button style={S.btn} onClick={e=>{ const v=e.currentTarget.previousSibling.value; setQuery(v); setAskResult(answerQuery(v,{lps,portfolio,cashflows,metrics,fund:FUND})); }}>Ask</button>
          </div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
            {["Fund IRR","Top performers","Sector exposure","Pacific's distribution history","Which companies are below cost?","Whitfield unfunded commitment"].map(chip=>(
              <button key={chip} style={{...S.btnGhost,fontSize:11}} onClick={()=>{setQuery(chip);setAskResult(answerQuery(chip,{lps,portfolio,cashflows,metrics,fund:FUND}));}}>{chip}</button>
            ))}
          </div>
          {askResult && (
            <div style={{background:"var(--color-background-secondary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:9,padding:"14px 16px"}}>
              <div style={{fontSize:13,fontWeight:600,marginBottom:8,color:"#C8915A"}}>{askResult.t}</div>
              {askResult.b && <div style={{fontSize:13,lineHeight:1.7,color:"var(--color-text-primary)"}}>{askResult.b}</div>}
              {askResult.rows && (
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,marginTop:4}}>
                  <tbody>{askResult.rows.map((r,i)=>(<tr key={i} style={{background:i%2?"rgba(200,145,90,0.04)":"transparent"}}>{r.map((c,j)=><td key={j} style={{padding:"7px 10px",borderBottom:"0.5px solid var(--color-border-tertiary)",fontVariantNumeric:"tabular-nums",fontWeight:j===0?500:400}}>{c}</td>)}</tr>))}</tbody>
                </table>
              )}
            </div>
          )}
          <div style={{marginTop:12,fontSize:11,color:"var(--color-text-tertiary)",lineHeight:1.6}}>
            Answers are computed deterministically from the live fund database, so every figure is auditable and matches the dashboard exactly. (Roadmap: natural-language layer via Claude API server-side for free-form questions and LP self-service.)
          </div>
        </div>
      )}

      {/* Modals */}
      {reportLP && <QuarterlyReport lp={reportLP} qt={qt} lps={lps} portfolio={portfolio} cashflows={cashflows} metrics={metrics} fund={FUND} onClose={()=>setReportLP(null)}/>}
      {callLP && callCfg.amount>0 && <CallNotice lp={callLP} callAmount={callCfg.amount} dueDate={callCfg.dueDate} purpose={callCfg.purpose} lps={lps} metrics={metrics} fund={FUND} onClose={()=>setCallLP(null)}/>}
      {distLP && distCfg.amount>0 && <DistNotice lp={distLP} distAmount={distCfg.amount} source={distCfg.source} rocPct={distCfg.rocPct} lps={lps} fund={FUND} onClose={()=>setDistLP(null)}/>}
      {memoCo && <ValuationMemo company={memoCo} fund={FUND} onClose={()=>setMemoCo(null)}/>}
    </div>
  );
}
