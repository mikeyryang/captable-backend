import { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { AlertTriangle, CheckCircle, Clock, Users } from "lucide-react";

const fmt    = n => n==null?"—":n>=1e6?"$"+(n/1e6).toFixed(2)+"M":n>=1e3?"$"+(n/1e3).toFixed(0)+"K":"$"+Math.round(n).toLocaleString();
const pct    = n => (n*100).toFixed(1)+"%";
const fmtX   = n => n==null?"—":n.toFixed(2)+"x";
const fmtDate= d => d?new Date(d).toLocaleDateString("en-US",{month:"short",year:"numeric"}):"—";

// Per ILPA Model LPA Section 8 and NVCA Model Venture Fund LPA Article V
// Equalization interest: compensates OG LPs for time value of early capital
// Catch-up: ensures GP carry is not diluted by subsequent closings

function yearsElapsed(fromDate, toDate) {
  if (!fromDate || !toDate) return 0;
  return (new Date(toDate).getTime() - new Date(fromDate).getTime()) / (365.25*24*3600*1000);
}

function calcEqualization(lp, allCashflows, fundFirstClose, equalizationRate) {
  if (!lp.entryDate || !fundFirstClose) return null;
  if (lp.entryDate <= fundFirstClose) return { isFounder: true };

  const priorCalls = allCashflows.filter(c=>
    c.type==="call" && c.date < lp.entryDate
  );
  const priorDists = allCashflows.filter(c=>
    c.type==="dist" && c.date < lp.entryDate
  );

  const lpOwnershipPct = lp.commitment / (lp.commitment + 40000000); // simplified
  const rate = (equalizationRate || 8) / 100;

  let catchUpContribution = 0;
  let equalizationInterest = 0;
  const callBreakdown = [];

  priorCalls.forEach(call => {
    const lpShare = Math.abs(call.amount) * lpOwnershipPct;
    const years = yearsElapsed(call.date, lp.entryDate);
    const interest = lpShare * (Math.pow(1+rate, years) - 1);
    catchUpContribution += lpShare;
    equalizationInterest += interest;
    callBreakdown.push({
      date: call.date,
      label: call.label,
      lpShare,
      years: years.toFixed(2),
      interest,
      interestFactor: (Math.pow(1+rate,years)-1).toFixed(3),
    });
  });

  const mgmtFeeEqualization = catchUpContribution * 0.02 * (yearsElapsed(fundFirstClose, lp.entryDate));
  const distOffset = priorDists.reduce((a,d)=>a+d.amount*lpOwnershipPct,0);
  const gpCatchUp  = Math.max(0,(catchUpContribution*0.20)); // 20% carry on backdated economics

  const totalEqualization = catchUpContribution + equalizationInterest + mgmtFeeEqualization + gpCatchUp - distOffset;
  const adjustedContributed = lp.contributed + equalizationInterest;

  return {
    isFounder: false,
    lpOwnershipPct,
    catchUpContribution,
    equalizationInterest,
    mgmtFeeEqualization,
    distOffset,
    gpCatchUp,
    totalEqualization,
    adjustedContributed,
    callBreakdown,
    fairTVPI: lp.contributed>0?(lp.nav+lp.distributions)/lp.contributed:0,
    unfairTVPI: adjustedContributed>0?(lp.nav+lp.distributions)/adjustedContributed:0,
  };
}

// ── LP Equalization Panel ─────────────────────────────────────────────────────
export default function LPEqualization({ lps, cashflows, onClose }) {
  const [fundFirstClose, setFundFirstClose] = useState("2021-09-01");
  const [equalizationRate, setEqualizationRate] = useState(8);
  const [selectedLP, setSelectedLP] = useState(null);
  const [entryDates, setEntryDates] = useState({});

  // Merge entry dates into LPs (allow override per LP)
  const lpsWithDates = lps.map(lp=>({
    ...lp,
    entryDate: entryDates[lp.id] || lp.entryDate || fundFirstClose,
  }));

  const equalizations = useMemo(()=>
    lpsWithDates.map(lp=>({
      lp,
      eq: calcEqualization(lp, cashflows, fundFirstClose, equalizationRate),
    }))
  ,[lpsWithDates, cashflows, fundFirstClose, equalizationRate]);

  const subsequentLPs = equalizations.filter(e=>e.eq&&!e.eq.isFounder);
  const founderLPs    = equalizations.filter(e=>e.eq?.isFounder);

  const S = {
    overlay: {position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:3000,display:"flex",alignItems:"flex-start",justifyContent:"center",overflow:"auto",padding:"20px 16px"},
    modal:   {background:"var(--color-background-primary)",borderRadius:14,width:"100%",maxWidth:1000,fontFamily:"system-ui,sans-serif"},
    hdr:     {background:"#1A0F0A",borderRadius:"14px 14px 0 0",padding:"16px 24px",display:"flex",justifyContent:"space-between",alignItems:"center"},
    card:    {background:"var(--color-background-secondary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:10,padding:"14px 16px",marginBottom:12},
    label:   {display:"block",fontSize:11,fontWeight:500,color:"var(--color-text-secondary)",marginBottom:4},
    input:   {width:"100%",padding:"7px 10px",border:"0.5px solid var(--color-border-secondary)",borderRadius:7,fontSize:12,boxSizing:"border-box",outline:"none",background:"var(--color-background-primary)",color:"var(--color-text-primary)"},
    th:      {padding:"7px 10px",textAlign:"left",color:"var(--color-text-secondary)",fontWeight:500,borderBottom:"0.5px solid var(--color-border-tertiary)",fontSize:11},
    td:      {padding:"8px 10px",color:"var(--color-text-primary)",borderBottom:"0.5px solid var(--color-border-tertiary)",fontSize:12},
    secH:    {fontSize:12,fontWeight:600,color:"var(--color-text-secondary)",marginBottom:10,textTransform:"uppercase",letterSpacing:"0.06em"},
  };

  const detail = selectedLP ? equalizations.find(e=>e.lp.id===selectedLP) : null;

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e=>e.stopPropagation()}>
        <div style={S.hdr}>
          <div>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginBottom:2,textTransform:"uppercase",letterSpacing:"0.06em"}}>LP Equalization Calculator</div>
            <div style={{fontSize:18,fontWeight:700,color:"#F1EFE8"}}>Time-Weighted LP Entry Analysis</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.4)",marginTop:2}}>Per ILPA Model LPA §8 · NVCA Article V · Equalization interest + catch-up provisions</div>
          </div>
          <button onClick={onClose} style={{padding:"6px 14px",background:"rgba(255,255,255,0.08)",border:"0.5px solid rgba(255,255,255,0.15)",borderRadius:6,color:"rgba(255,255,255,0.6)",fontSize:12,cursor:"pointer"}}>Close</button>
        </div>

        <div style={{padding:"16px 20px"}}>

          {/* Config */}
          <div style={{...S.card,display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16,marginBottom:16}}>
            <div>
              <label style={S.label}>Fund first close date</label>
              <input type="date" value={fundFirstClose} onChange={e=>setFundFirstClose(e.target.value)} style={S.input}/>
            </div>
            <div>
              <label style={S.label}>Equalization interest rate (% p.a.)</label>
              <input type="number" value={equalizationRate} onChange={e=>setEqualizationRate(parseFloat(e.target.value)||8)} style={S.input}/>
            </div>
            <div style={{padding:"10px 0"}}>
              <div style={{fontSize:11,color:"var(--color-text-secondary)",marginBottom:4}}>Standard rates per ILPA</div>
              <div style={{fontSize:12,color:"var(--color-text-primary)"}}>Early-stage VC: <strong>8–10%</strong></div>
              <div style={{fontSize:12,color:"var(--color-text-primary)"}}>Buyout funds: <strong>6–8%</strong></div>
            </div>
          </div>

          {/* LP entry dates */}
          <div style={S.card}>
            <div style={S.secH}>LP Entry Dates</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
              {lpsWithDates.map(lp=>(
                <div key={lp.id}>
                  <label style={S.label}>{lp.name.split(" ")[0]} entry date</label>
                  <input type="date" value={entryDates[lp.id]||fundFirstClose} onChange={e=>setEntryDates(p=>({...p,[lp.id]:e.target.value}))} style={S.input}/>
                </div>
              ))}
            </div>
          </div>

          {/* Summary table */}
          <div style={{...S.card,padding:0,overflow:"hidden"}}>
            <div style={{padding:"12px 16px 0",fontSize:12,fontWeight:600,color:"var(--color-text-secondary)",textTransform:"uppercase",letterSpacing:"0.06em"}}>Equalization Summary</div>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
              <thead style={{background:"var(--color-background-secondary)"}}>
                <tr>{["LP","Type","Entry Date","Status","Catch-Up","Equal. Interest","Mgmt Fee Eq.","Dist Offset","GP Catch-Up","Total Payment","View"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {equalizations.map(({lp,eq},i)=>{
                  if(!eq) return null;
                  const isFounder = eq.isFounder;
                  return (
                    <tr key={lp.id} style={{background:i%2===0?"#fff":"#FAF7F3",cursor:"pointer"}} onClick={()=>setSelectedLP(selectedLP===lp.id?null:lp.id)}>
                      <td style={{...S.td,fontWeight:500}}>{lp.name}</td>
                      <td style={S.td}><span style={{fontSize:10,padding:"2px 6px",borderRadius:4,background:"rgba(200,145,90,0.1)",color:"#C8915A"}}>{lp.type}</span></td>
                      <td style={S.td}>{fmtDate(lp.entryDate||fundFirstClose)}</td>
                      <td style={S.td}>
                        {isFounder
                          ? <span style={{fontSize:10,padding:"2px 6px",borderRadius:4,background:"rgba(16,185,129,0.1)",color:"#10B981",fontWeight:500}}>Founding LP</span>
                          : <span style={{fontSize:10,padding:"2px 6px",borderRadius:4,background:"rgba(99,102,241,0.1)",color:"#6366F1",fontWeight:500}}>Subsequent</span>
                        }
                      </td>
                      <td style={{...S.td,fontVariantNumeric:"tabular-nums"}}>{isFounder?"—":fmt(eq.catchUpContribution)}</td>
                      <td style={{...S.td,fontVariantNumeric:"tabular-nums",color:isFounder?"inherit":"#C8915A"}}>{isFounder?"—":fmt(eq.equalizationInterest)}</td>
                      <td style={{...S.td,fontVariantNumeric:"tabular-nums"}}>{isFounder?"—":fmt(eq.mgmtFeeEqualization)}</td>
                      <td style={{...S.td,fontVariantNumeric:"tabular-nums",color:"#10B981"}}>{isFounder?"—":`(${fmt(eq.distOffset)})`}</td>
                      <td style={{...S.td,fontVariantNumeric:"tabular-nums"}}>{isFounder?"—":fmt(eq.gpCatchUp)}</td>
                      <td style={{...S.td,fontWeight:600,fontVariantNumeric:"tabular-nums",color:isFounder?"inherit":"#6366F1"}}>{isFounder?"$0":fmt(eq.totalEqualization)}</td>
                      <td style={S.td}>{!isFounder&&<span style={{fontSize:11,color:"#C8915A",cursor:"pointer"}}>{selectedLP===lp.id?"▲ Hide":"▼ Detail"}</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* LP Detail drilldown */}
          {detail&&!detail.eq.isFounder&&(
            <div style={S.card}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
                <div>
                  <div style={S.secH}>Equalization Detail — {detail.lp.name}</div>
                  <div style={{fontSize:12,color:"var(--color-text-secondary)"}}>Entry: {fmtDate(detail.lp.entryDate||fundFirstClose)} · Rate: {equalizationRate}% p.a. · Standard: ILPA Model LPA §8</div>
                </div>
              </div>

              {/* Capital call breakdown */}
              <div style={{marginBottom:14}}>
                <div style={{fontSize:11,fontWeight:600,color:"var(--color-text-secondary)",marginBottom:8}}>Equalization Interest by Capital Call</div>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                  <thead><tr>{["Call Date","Description","LP Share","Years Before Entry","Interest Factor","Equalization Interest"].map(h=><th key={h} style={{...S.th,fontSize:10}}>{h}</th>)}</tr></thead>
                  <tbody>
                    {detail.eq.callBreakdown.map((c,i)=>(
                      <tr key={i} style={{background:i%2===0?"transparent":"rgba(200,145,90,0.03)"}}>
                        <td style={S.td}>{fmtDate(c.date)}</td>
                        <td style={S.td}>{c.label}</td>
                        <td style={{...S.td,fontVariantNumeric:"tabular-nums"}}>{fmt(c.lpShare)}</td>
                        <td style={{...S.td,fontVariantNumeric:"tabular-nums"}}>{c.years} yrs</td>
                        <td style={{...S.td,fontVariantNumeric:"tabular-nums",color:"var(--color-text-secondary)"}}>({equalizationRate}%^{c.years})−1 = {c.interestFactor}</td>
                        <td style={{...S.td,fontWeight:600,fontVariantNumeric:"tabular-nums",color:"#C8915A"}}>{fmt(c.interest)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Payment summary */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                <div>
                  <div style={{fontSize:11,fontWeight:600,color:"var(--color-text-secondary)",marginBottom:8}}>Total Payment Calculation</div>
                  {[
                    {l:"Catch-up contribution (pro-rata share of all prior calls)",v:fmt(detail.eq.catchUpContribution),color:"var(--color-text-primary)"},
                    {l:"Equalization interest (paid to existing LPs)",v:fmt(detail.eq.equalizationInterest),color:"#C8915A"},
                    {l:"Management fee equalization (backdated fees)",v:fmt(detail.eq.mgmtFeeEqualization),color:"var(--color-text-primary)"},
                    {l:"GP carry catch-up (20% on backdated economics)",v:fmt(detail.eq.gpCatchUp),color:"var(--color-text-primary)"},
                    {l:"Less: distributions already paid (offset)",v:`(${fmt(detail.eq.distOffset)})`,color:"#10B981"},
                  ].map((r,i)=>(
                    <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"0.5px solid var(--color-border-tertiary)",fontSize:12}}>
                      <span style={{color:"var(--color-text-secondary)",flex:1,paddingRight:8}}>{r.l}</span>
                      <span style={{color:r.color,fontWeight:500,fontVariantNumeric:"tabular-nums"}}>{r.v}</span>
                    </div>
                  ))}
                  <div style={{display:"flex",justifyContent:"space-between",padding:"10px 0 0",fontSize:13,fontWeight:700,borderTop:"1px solid var(--color-border-secondary)",marginTop:4}}>
                    <span>Total equalization payment</span>
                    <span style={{color:"#6366F1",fontVariantNumeric:"tabular-nums"}}>{fmt(detail.eq.totalEqualization)}</span>
                  </div>
                </div>
                <div>
                  <div style={{fontSize:11,fontWeight:600,color:"var(--color-text-secondary)",marginBottom:8}}>TVPI Impact — With vs Without Equalization</div>
                  <div style={{background:"var(--color-background-secondary)",borderRadius:8,padding:"12px"}}>
                    <div style={{marginBottom:10}}>
                      <div style={{fontSize:10,color:"var(--color-text-tertiary)",marginBottom:2}}>Without equalization (unfair windfall)</div>
                      <div style={{fontSize:22,fontWeight:700,color:"#EF4444",fontVariantNumeric:"tabular-nums"}}>{fmtX(detail.eq.unfairTVPI)}</div>
                      <div style={{fontSize:10,color:"var(--color-text-tertiary)"}}>LP benefits from pre-entry returns at no cost</div>
                    </div>
                    <div style={{borderTop:"0.5px solid var(--color-border-tertiary)",paddingTop:10}}>
                      <div style={{fontSize:10,color:"var(--color-text-tertiary)",marginBottom:2}}>With equalization (fair entry)</div>
                      <div style={{fontSize:22,fontWeight:700,color:"#10B981",fontVariantNumeric:"tabular-nums"}}>{fmtX(detail.eq.fairTVPI)}</div>
                      <div style={{fontSize:10,color:"var(--color-text-tertiary)"}}>TVPI matches fund-level return — fair treatment</div>
                    </div>
                  </div>
                  <div style={{marginTop:10,padding:"8px 10px",background:"rgba(99,102,241,0.08)",borderRadius:7,fontSize:11,color:"#6366F1",lineHeight:1.6}}>
                    The equalization interest ({fmt(detail.eq.equalizationInterest)}) is distributed pro-rata to founding LPs — compensating them for the time value of early capital deployed before this LP joined.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* For prospective LPs */}
          <div style={{...S.card,border:"0.5px solid rgba(200,145,90,0.3)",background:"rgba(200,145,90,0.05)"}}>
            <div style={S.secH}>For Prospective LPs — Entry Economics</div>
            <div style={{fontSize:12,color:"var(--color-text-secondary)",marginBottom:12,lineHeight:1.7}}>
              Any LP joining Valkyrie Fund I after the first close ({fmtDate(fundFirstClose)}) must pay an equalization payment to ensure fair treatment of founding LPs. The payment is calculated automatically based on their entry date, commitment size, and the equalization rate above. This framework ensures:
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              {[
                {icon:"✓",text:"Founding LPs are compensated for early risk — their TVPI is not diluted by later entrants",color:"#10B981"},
                {icon:"✓",text:"New LPs enter at fair value — they pay for the returns generated before they joined",color:"#10B981"},
                {icon:"✓",text:"GP carry is protected — catch-up provisions ensure the GP's economics are not diluted",color:"#10B981"},
                {icon:"✓",text:"All calculations are transparent, auditable, and documented per ILPA Model LPA §8",color:"#10B981"},
              ].map((r,i)=>(
                <div key={i} style={{display:"flex",gap:8,padding:"8px 10px",background:"rgba(16,185,129,0.06)",borderRadius:7,border:"0.5px solid rgba(16,185,129,0.2)"}}>
                  <span style={{color:r.color,fontWeight:700,flexShrink:0}}>{r.icon}</span>
                  <span style={{fontSize:12,color:"var(--color-text-secondary)",lineHeight:1.5}}>{r.text}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
