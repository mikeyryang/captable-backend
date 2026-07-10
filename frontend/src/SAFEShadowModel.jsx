import { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, CartesianGrid, Legend } from "recharts";

const fmt  = n => n==null?"—":n>=1e6?"$"+(n/1e6).toFixed(2)+"M":n>=1e3?"$"+(n/1e3).toFixed(0)+"K":"$"+Math.round(n).toLocaleString();
const fmtX = n => n==null?"—":n.toFixed(2)+"x";
const pct  = n => (n*100).toFixed(2)+"%";

// ── Shadow mark engine ────────────────────────────────────────────────────────
// Per IPEV Board Valuation Guidelines (2022) §1.4 and §6.2
function calcShadowMark(safe, scenarios) {
  return scenarios.reduce((sum, s) => {
    let val = 0;
    const amt        = Number(safe.amount)           || 0;
    const cap        = Number(safe.cap)              || 0;
    const disc       = Number(safe.discount)         || 0;
    const currentVal = Number(safe.currentValuation) || 0;
    const bullVal    = Number(safe.bullValuation)    || currentVal;

    switch(s.type) {
      case "cap_base":
        // Converts at cap using current 409A / most recent valuation
        val = cap > 0 && currentVal > 0
          ? currentVal > cap
            ? (amt / cap) * currentVal   // above cap — mark up
            : amt                         // below cap — carry at cost
          : amt;
        break;
      case "cap_bull":
        // Bull case: converts at cap using bull valuation
        val = cap > 0 && bullVal > 0
          ? bullVal > cap
            ? (amt / cap) * bullVal
            : amt
          : amt;
        break;
      case "discount":
        // Converts using discount rate (no cap)
        val = disc > 0 ? amt / (1 - disc / 100) : amt;
        break;
      case "cost":
        val = amt;
        break;
      case "zero":
        val = 0;
        break;
      default:
        val = amt;
    }
    return sum + val * (s.probability / 100);
  }, 0);
}

function calcConversionAtExit(safe, exitVal) {
  const cap  = Number(safe.cap)      || 0;
  const amt  = Number(safe.amount)   || 0;
  const disc = Number(safe.discount) || 0;
  if (!exitVal || !amt) return { ownership: 0, value: 0, moic: 0 };

  let conversionPrice;
  if (cap > 0 && disc > 0) {
    // Both cap and discount — take lower (better for investor)
    const capPrice  = cap;
    const discPrice = exitVal * (1 - disc / 100);
    conversionPrice = Math.min(capPrice, discPrice);
  } else if (cap > 0) {
    conversionPrice = Math.min(cap, exitVal);
  } else if (disc > 0) {
    conversionPrice = exitVal * (1 - disc / 100);
  } else {
    conversionPrice = exitVal;
  }

  const ownership = conversionPrice > 0 ? amt / conversionPrice : 0;
  const value     = ownership * exitVal;
  const moic      = amt > 0 ? value / amt : 0;
  return { ownership, value, moic };
}

// ── SAFE Stack Modeler ────────────────────────────────────────────────────────
export function SAFEStackModeler({ company, onClose }) {
  const [safes, setSafes] = useState([
    { id:1, label:"SAFE-1", amount:0, cap:0, discount:0,
      currentValuation:0, bullValuation:0, date:"", note:"" }
  ]);

  const EXIT_POINTS = [5e6, 10e6, 25e6, 50e6, 100e6, 200e6, 500e6];

  const [scenarios, setScenarios] = useState([
    { id:1, label:"Converts at cap — bull case",     type:"cap_bull",  probability:25 },
    { id:2, label:"Converts at cap — base case",     type:"cap_base",  probability:35 },
    { id:3, label:"Converts at discount",            type:"discount",  probability:15 },
    { id:4, label:"Stagnates (carried at cost)",     type:"cost",      probability:17 },
    { id:5, label:"Company fails",                   type:"zero",      probability:8  },
  ]);

  const totalProb = scenarios.reduce((a,s)=>a+s.probability, 0);

  function addSafe() {
    setSafes(prev=>[...prev,{id:Date.now(),label:`SAFE-${prev.length+1}`,amount:0,cap:0,discount:0,currentValuation:0,bullValuation:0,date:"",note:""}]);
  }
  function setSafe(id, key, val) {
    const NUMERIC = ["amount","cap","discount","currentValuation","bullValuation"];
    const parsed  = NUMERIC.includes(key) ? (parseFloat(String(val).replace(/[^0-9.]/g,""))||0) : val;
    setSafes(prev=>prev.map(s=>s.id===id?{...s,[key]:parsed}:s));
  }
  function removeSafe(id) { setSafes(prev=>prev.filter(s=>s.id!==id)); }
  function setScenarioPct(id, val) {
    setScenarios(prev=>prev.map(s=>s.id===id?{...s,probability:parseFloat(val)||0}:s));
  }

  const shadowPerSafe = useMemo(()=>
    safes.map(safe=>({...safe, shadowMark: calcShadowMark(safe, scenarios)}))
  ,[safes, scenarios]);

  const totalInvested  = safes.reduce((a,s)=>a+s.amount, 0);
  const totalShadow    = shadowPerSafe.reduce((a,s)=>a+s.shadowMark, 0);
  const totalHidden    = totalShadow - totalInvested;

  const conversionCurve = useMemo(()=>
    EXIT_POINTS.map(exit=>{
      const totOwn = safes.reduce((sum,safe)=>sum+calcConversionAtExit(safe,exit).ownership, 0);
      const totVal = safes.reduce((sum,safe)=>sum+calcConversionAtExit(safe,exit).value, 0);
      return {
        exit: "$"+(exit/1e6).toFixed(0)+"M",
        exitVal: exit,
        ownership: totOwn,
        value: totVal,
        moic: totalInvested>0 ? totVal/totalInvested : 0,
      };
    })
  ,[safes, totalInvested]);

  const S = {
    overlay: {position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:3000,display:"flex",alignItems:"flex-start",justifyContent:"center",overflow:"auto",padding:"20px 16px"},
    modal:   {background:"#1C1410",borderRadius:14,width:"100%",maxWidth:1040,fontFamily:"system-ui,sans-serif",border:"0.5px solid rgba(200,145,90,0.2)"},
    hdr:     {background:"#0F0A07",borderRadius:"14px 14px 0 0",padding:"16px 24px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:"0.5px solid rgba(255,255,255,0.08)"},
    body:    {padding:"16px 20px"},
    card:    {background:"rgba(255,255,255,0.04)",border:"0.5px solid rgba(255,255,255,0.1)",borderRadius:10,padding:"14px 16px",marginBottom:12},
    lbl:     {display:"block",fontSize:11,fontWeight:500,color:"rgba(255,255,255,0.5)",marginBottom:4},
    inp:     {width:"100%",padding:"7px 10px",border:"0.5px solid rgba(255,255,255,0.15)",borderRadius:7,fontSize:12,boxSizing:"border-box",outline:"none",background:"rgba(255,255,255,0.06)",color:"#F1EFE8",fontFamily:"inherit"},
    g4:      {display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:10},
    g3:      {display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10},
    g2:      {display:"grid",gridTemplateColumns:"1fr 1fr",gap:14},
    secH:    {fontSize:11,fontWeight:600,color:"rgba(255,255,255,0.4)",marginBottom:10,textTransform:"uppercase",letterSpacing:"0.07em"},
    th:      {padding:"6px 10px",textAlign:"left",color:"rgba(255,255,255,0.4)",fontWeight:500,borderBottom:"0.5px solid rgba(255,255,255,0.08)",fontSize:10},
    td:      {padding:"7px 10px",color:"#F1EFE8",borderBottom:"0.5px solid rgba(255,255,255,0.06)",fontSize:12},
  };

  // Uncontrolled input — saves on blur so user can type freely without losing focus
  const Field = ({label, fieldKey, safeId, placeholder="", isText=false}) => {
    const numVal = safes.find(s=>s.id===safeId)?.[fieldKey];
    const display = isText ? (numVal||"") : (numVal ? String(numVal) : "");
    return (
      <div>
        <label style={S.lbl}>{label}</label>
        <input
          type={isText?"text":"text"}
          inputMode={isText?"text":"numeric"}
          placeholder={placeholder}
          defaultValue={display}
          key={`${safeId}-${fieldKey}-${display}`}
          onBlur={e=>{
            if(isText) setSafe(safeId, fieldKey, e.target.value);
            else setSafe(safeId, fieldKey, parseFloat(e.target.value)||0);
          }}
          style={S.inp}
        />
      </div>
    );
  };

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e=>e.stopPropagation()}>

        {/* Header */}
        <div style={S.hdr}>
          <div>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.35)",marginBottom:3,textTransform:"uppercase",letterSpacing:"0.07em"}}>SAFE Stack Modeler — IPEV §1.4 / §6.2</div>
            <div style={{fontSize:18,fontWeight:700,color:"#F1EFE8"}}>{company?.name||"Portfolio Company"}</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.35)",marginTop:2}}>Shadow marks are GP estimates — disclosed separately from GAAP regulatory marks (cost)</div>
          </div>
          <button onClick={onClose} style={{padding:"6px 14px",background:"rgba(255,255,255,0.06)",border:"0.5px solid rgba(255,255,255,0.12)",borderRadius:6,color:"rgba(255,255,255,0.5)",fontSize:12,cursor:"pointer"}}>Close</button>
        </div>

        <div style={S.body}>

          {/* Summary header — dark cards, always readable */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:16}}>
            <div style={{background:"rgba(255,255,255,0.06)",border:"0.5px solid rgba(255,255,255,0.12)",borderRadius:10,padding:"14px 16px"}}>
              <div style={{fontSize:10,color:"rgba(255,255,255,0.45)",marginBottom:6,textTransform:"uppercase",letterSpacing:"0.06em"}}>Regulatory Mark (GAAP)</div>
              <div style={{fontSize:24,fontWeight:700,color:"#F1EFE8",fontVariantNumeric:"tabular-nums"}}>{fmt(totalInvested)}</div>
              <div style={{fontSize:10,color:"rgba(255,255,255,0.35)",marginTop:4}}>Carried at cost · ASC 820 / IPEV §3.1</div>
            </div>
            <div style={{background:"rgba(200,145,90,0.12)",border:"0.5px solid rgba(200,145,90,0.3)",borderRadius:10,padding:"14px 16px"}}>
              <div style={{fontSize:10,color:"rgba(255,255,255,0.45)",marginBottom:6,textTransform:"uppercase",letterSpacing:"0.06em"}}>Economic Shadow Mark (GP Estimate)</div>
              <div style={{fontSize:24,fontWeight:700,color:"#C8915A",fontVariantNumeric:"tabular-nums"}}>{fmt(totalShadow)}</div>
              <div style={{fontSize:10,color:"rgba(255,255,255,0.35)",marginTop:4}}>Probability-weighted · IPEV §6.2 · Unaudited</div>
            </div>
            <div style={{background:totalHidden>=0?"rgba(16,185,129,0.10)":"rgba(239,68,68,0.10)",border:`0.5px solid ${totalHidden>=0?"rgba(16,185,129,0.3)":"rgba(239,68,68,0.3)"}`,borderRadius:10,padding:"14px 16px"}}>
              <div style={{fontSize:10,color:"rgba(255,255,255,0.45)",marginBottom:6,textTransform:"uppercase",letterSpacing:"0.06em"}}>Hidden Value (Shadow − Cost)</div>
              <div style={{fontSize:24,fontWeight:700,color:totalHidden>=0?"#10B981":"#EF4444",fontVariantNumeric:"tabular-nums"}}>{fmt(totalHidden)}</div>
              <div style={{fontSize:10,color:"rgba(255,255,255,0.35)",marginTop:4}}>{totalHidden>=0?"Not visible in regulatory TVPI":"Enter valuation data above to model"}</div>
            </div>
          </div>

          <div style={S.g2}>
            {/* Left column */}
            <div>
              {/* SAFE notes */}
              <div style={S.card}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                  <div style={S.secH}>SAFE Notes</div>
                  <button onClick={addSafe} style={{padding:"5px 12px",background:"rgba(200,145,90,0.2)",color:"#C8915A",border:"0.5px solid rgba(200,145,90,0.3)",borderRadius:6,fontSize:11,cursor:"pointer",fontWeight:500}}>+ Add SAFE</button>
                </div>
                {safes.map((safe,i)=>(
                  <div key={safe.id} style={{border:"0.5px solid rgba(255,255,255,0.08)",borderRadius:8,padding:"10px 12px",marginBottom:10,background:"rgba(255,255,255,0.02)"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                      <input value={safe.label} onChange={e=>setSafe(safe.id,"label",e.target.value)}
                        style={{...S.inp,width:90,fontSize:11,fontWeight:600,padding:"4px 8px"}}/>
                      <div style={{display:"flex",gap:8,alignItems:"center"}}>
                        <span style={{fontSize:10,color:"rgba(255,255,255,0.4)"}}>Shadow: <strong style={{color:"#C8915A"}}>{fmt(shadowPerSafe.find(s=>s.id===safe.id)?.shadowMark)}</strong></span>
                        {safes.length>1&&<button onClick={()=>removeSafe(safe.id)} style={{fontSize:11,color:"#EF4444",background:"none",border:"none",cursor:"pointer"}}>✕</button>}
                      </div>
                    </div>
                    <div style={{...S.g4,marginBottom:8}}>
                      <Field label="Amount ($)"    fieldKey="amount"   safeId={safe.id} placeholder="e.g. 500000"/>
                      <Field label="Cap ($)"       fieldKey="cap"      safeId={safe.id} placeholder="e.g. 16000000"/>
                      <Field label="Discount (%)"  fieldKey="discount" safeId={safe.id} placeholder="e.g. 20"/>
                      <Field label="Date"          fieldKey="date"     safeId={safe.id} isText={true} placeholder="e.g. 2022-03"/>
                    </div>
                    <div style={S.g2}>
                      <Field label="Current 409A / Valuation ($)" fieldKey="currentValuation" safeId={safe.id} placeholder="e.g. 40000000"/>
                      <Field label="Bull case valuation ($)"       fieldKey="bullValuation"    safeId={safe.id} placeholder="e.g. 120000000"/>
                    </div>
                    <div style={{marginTop:8,fontSize:10,color:"rgba(255,255,255,0.35)",lineHeight:1.5}}>
                      Company val {Number(safe.currentValuation)>0?"($"+((Number(safe.currentValuation))/1e6).toFixed(1)+"M)":""} vs cap ({fmt(Number(safe.cap))}): base → {Number(safe.currentValuation)>Number(safe.cap)?fmt((Number(safe.amount)/Number(safe.cap))*Number(safe.currentValuation)):"carry at cost (val ≤ cap)"} · bull → {Number(safe.bullValuation)>Number(safe.cap)?fmt((Number(safe.amount)/Number(safe.cap))*Number(safe.bullValuation)):"carry at cost (val ≤ cap)"}
                    </div>
                  </div>
                ))}
              </div>

              {/* Probability scenarios */}
              <div style={S.card}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <div style={S.secH}>Scenario Weights</div>
                  <span style={{fontSize:11,color:totalProb===100?"#10B981":"#EF4444",fontWeight:600}}>
                    {totalProb}% {totalProb===100?"✓":"≠ 100%"}
                  </span>
                </div>
                {scenarios.map(s=>(
                  <div key={s.id} style={{display:"grid",gridTemplateColumns:"1fr auto",gap:8,alignItems:"center",marginBottom:7}}>
                    <div style={{fontSize:11,color:"rgba(255,255,255,0.6)"}}>{s.label}</div>
                    <div style={{display:"flex",alignItems:"center",gap:4}}>
                      <input type="number" min="0" max="100" value={s.probability}
                        onChange={e=>setScenarioPct(s.id,e.target.value)}
                        style={{...S.inp,width:52,textAlign:"center",padding:"5px 6px"}}/>
                      <span style={{fontSize:11,color:"rgba(255,255,255,0.3)"}}>%</span>
                    </div>
                  </div>
                ))}
                <div style={{marginTop:10,padding:"8px 10px",background:"rgba(99,102,241,0.08)",borderRadius:6,border:"0.5px solid rgba(99,102,241,0.2)",fontSize:10,color:"rgba(99,102,241,0.9)",lineHeight:1.5}}>
                  Bull/base cap scenarios use the 409A and bull valuations entered per SAFE above. Enter those values to see a meaningful shadow mark.
                </div>
              </div>
            </div>

            {/* Right column */}
            <div>
              {/* Conversion curve */}
              <div style={S.card}>
                <div style={S.secH}>Conversion Ownership at Exit Valuations</div>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={conversionCurve} margin={{top:4,right:8,left:0,bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false}/>
                    <XAxis dataKey="exit" tick={{fontSize:9,fill:"rgba(255,255,255,0.4)"}}/>
                    <YAxis yAxisId="left"  tickFormatter={v=>pct(v)} tick={{fontSize:9,fill:"rgba(255,255,255,0.4)"}}/>
                    <YAxis yAxisId="right" orientation="right" tickFormatter={v=>"$"+(v/1e6).toFixed(0)+"M"} tick={{fontSize:9,fill:"rgba(255,255,255,0.4)"}}/>
                    <Tooltip contentStyle={{fontSize:11,borderRadius:6,background:"#1C1410",border:"0.5px solid rgba(255,255,255,0.15)",color:"#F1EFE8"}} formatter={(v,n)=>n==="ownership"?pct(v):[fmt(v),n]}/>
                    <Legend wrapperStyle={{fontSize:10,color:"rgba(255,255,255,0.5)"}}/>
                    <Line yAxisId="left"  type="monotone" dataKey="ownership" name="Ownership %" stroke="#6366F1" strokeWidth={2} dot={{r:3,fill:"#6366F1"}}/>
                    <Line yAxisId="right" type="monotone" dataKey="value"     name="Value $"     stroke="#C8915A" strokeWidth={2} dot={{r:3,fill:"#C8915A"}}/>
                  </LineChart>
                </ResponsiveContainer>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,marginTop:10}}>
                  <thead><tr>{["Exit Val","Ownership","Value","MOIC"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {conversionCurve.map((r,i)=>(
                      <tr key={i}>
                        <td style={{...S.td,fontWeight:500}}>{r.exit}</td>
                        <td style={{...S.td,color:"#6366F1",fontVariantNumeric:"tabular-nums"}}>{pct(r.ownership)}</td>
                        <td style={{...S.td,fontVariantNumeric:"tabular-nums"}}>{fmt(r.value)}</td>
                        <td style={{...S.td,color:r.moic>=2?"#10B981":r.moic>=1?"#F59E0B":"#EF4444",fontVariantNumeric:"tabular-nums"}}>{fmtX(r.moic)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Shadow breakdown bar */}
              <div style={S.card}>
                <div style={S.secH}>Shadow Mark vs Cost — Per SAFE</div>
                <ResponsiveContainer width="100%" height={110}>
                  <BarChart data={shadowPerSafe.map(s=>({name:s.label,cost:s.amount,hidden:Math.max(0,s.shadowMark-s.amount)}))} margin={{top:4,right:8,left:0,bottom:0}}>
                    <XAxis dataKey="name" tick={{fontSize:9,fill:"rgba(255,255,255,0.4)"}}/>
                    <YAxis tickFormatter={v=>"$"+(v/1e6).toFixed(1)+"M"} tick={{fontSize:9,fill:"rgba(255,255,255,0.4)"}}/>
                    <Tooltip contentStyle={{fontSize:11,borderRadius:6,background:"#1C1410",border:"0.5px solid rgba(255,255,255,0.15)",color:"#F1EFE8"}} formatter={(v,n)=>[fmt(v),n==="cost"?"Cost basis":"Hidden value"]}/>
                    <Legend wrapperStyle={{fontSize:10,color:"rgba(255,255,255,0.5)"}}/>
                    <Bar dataKey="cost"   name="Cost basis"   fill="#4A3020" radius={[3,3,0,0]} stackId="a"/>
                    <Bar dataKey="hidden" name="Hidden value" fill="#C8915A" radius={[3,3,0,0]} stackId="a"/>
                  </BarChart>
                </ResponsiveContainer>

                {/* IPEV disclosure */}
                <div style={{marginTop:10,padding:"10px 12px",background:"rgba(99,102,241,0.08)",border:"0.5px solid rgba(99,102,241,0.2)",borderRadius:7,fontSize:10,color:"rgba(200,200,255,0.75)",lineHeight:1.6}}>
                  <strong style={{color:"rgba(99,102,241,0.9)"}}>IPEV §6.2 Disclosure:</strong> Shadow marks are GP probability-weighted estimates. They are unaudited, not used for K-1 preparation or formal LP reporting, and subject to revision at each valuation date. Regulatory marks (cost basis) are used for all GAAP and SEC reporting.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Dual TVPI Panel ───────────────────────────────────────────────────────────
export function DualTVPI({ portfolio, cashflows, metrics }) {
  const safeCompanies = portfolio.filter(p=>p.instrumentType==="safe"||p.hasSafes);
  if (safeCompanies.length === 0) return null;

  const safeInvested  = safeCompanies.reduce((a,p)=>a+p.invested,0);
  const safeShadow    = safeCompanies.reduce((a,p)=>a+(p.shadowMark||p.invested),0);
  const pricedMark    = portfolio.filter(p=>p.status==="active"&&p.instrumentType!=="safe"&&!p.hasSafes).reduce((a,p)=>a+p.currentMark,0);
  const exitedValue   = portfolio.filter(p=>p.status==="exited").reduce((a,p)=>a+(p.realized||0),0);
  const distributions = (cashflows||[]).filter(c=>c.type==="dist").reduce((a,c)=>a+c.amount,0);
  const paidIn        = metrics?.paidIn||0;

  const regTV   = metrics?.totalValue||0;
  const econTV  = pricedMark + safeShadow + exitedValue + distributions;
  const regTVPI = paidIn>0?regTV/paidIn:0;
  const econTVPI= paidIn>0?econTV/paidIn:0;
  const hidden  = econTV - regTV;

  return (
    <div style={{background:"#1A0F0A",borderRadius:12,padding:"16px 20px",marginBottom:14,border:"0.5px solid rgba(200,145,90,0.25)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
        <div>
          <div style={{fontSize:10,color:"rgba(255,255,255,0.4)",letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:3}}>Dual TVPI Framework — IPEV §6.2</div>
          <div style={{fontSize:11,color:"rgba(255,255,255,0.3)"}}>Regulatory mark vs GP economic estimate · {safeCompanies.length} SAFE investment{safeCompanies.length>1?"s":""} in portfolio</div>
        </div>
        <div style={{fontSize:10,color:"rgba(255,255,255,0.25)",textAlign:"right",lineHeight:1.5}}>Unaudited GP estimate<br/>Not for formal LP reporting</div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1px 1fr 1px 1fr",gap:0,background:"rgba(255,255,255,0.05)",borderRadius:10,overflow:"hidden"}}>
        {[
          {l:"Regulatory TVPI",          v:fmtX(regTVPI),  sub:"GAAP-compliant · SAFEs at cost",      color:"#F1EFE8",  note:"Used for K-1s and audited statements"},
          null,
          {l:"Economic TVPI (GP Estimate)",v:fmtX(econTVPI),sub:"SAFEs at shadow mark · Unaudited",   color:"#C8915A",  note:"For LP communication only"},
          null,
          {l:"Hidden Value (SAFE Portfolio)",v:fmt(hidden), sub:"Not visible in regulatory TVPI",      color:"#10B981",  note:"Shadow − cost basis"},
        ].map((m,i)=>
          m===null
            ? <div key={i} style={{background:"rgba(255,255,255,0.06)"}}/>
            : <div key={i} style={{padding:"14px 18px"}}>
                <div style={{fontSize:9,color:"rgba(255,255,255,0.35)",marginBottom:6,letterSpacing:"0.06em",textTransform:"uppercase"}}>{m.l}</div>
                <div style={{fontSize:26,fontWeight:700,color:m.color,fontVariantNumeric:"tabular-nums"}}>{m.v}</div>
                <div style={{fontSize:10,color:"rgba(255,255,255,0.35)",marginTop:4}}>{m.sub}</div>
                <div style={{fontSize:9,color:"rgba(255,255,255,0.2)",marginTop:2}}>{m.note}</div>
              </div>
        )}
      </div>
    </div>
  );
}
