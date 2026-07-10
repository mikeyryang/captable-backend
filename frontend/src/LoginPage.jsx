import { useState } from "react";

const AUTH_BASE = import.meta.env.VITE_AUTH_URL || "http://localhost:8000/api/auth";

export default function LoginPage({ onLogin }) {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email || !password) { setError("Please enter your email and password."); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${AUTH_BASE}/token/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(()=>({}));
        setError(data.detail || "Invalid credentials. Please try again.");
        setLoading(false);
        return;
      }
      const { access, refresh } = await res.json();
      localStorage.setItem("vk_token", access);
      localStorage.setItem("vk_refresh_token", refresh);
      onLogin(access);
    } catch (err) {
      setError("Unable to reach the server. Make sure the backend is running.");
      setLoading(false);
    }
  }

  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#1A0F0A 0%,#2A1D16 60%,#3A2820 100%)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"system-ui,sans-serif",padding:"24px"}}>
      <div style={{width:"100%",maxWidth:420}}>
        <div style={{textAlign:"center",marginBottom:40}}>
          <div style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:56,height:56,borderRadius:14,background:"rgba(200,145,90,0.15)",border:"1px solid rgba(200,145,90,0.3)",marginBottom:16}}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L3 7v10l9 5 9-5V7L12 2z" stroke="#C8915A" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M12 2v20M3 7l9 5 9-5" stroke="#C8915A" strokeWidth="1.5" strokeLinejoin="round"/>
            </svg>
          </div>
          <div style={{fontSize:22,fontWeight:700,color:"#F1EFE8",letterSpacing:"-0.02em",marginBottom:4}}>Valkyrie Capital</div>
          <div style={{fontSize:13,color:"rgba(255,255,255,0.4)",letterSpacing:"0.06em",textTransform:"uppercase"}}>Frontier Platform</div>
        </div>
        <div style={{background:"rgba(255,255,255,0.04)",border:"0.5px solid rgba(255,255,255,0.10)",borderRadius:16,padding:"36px 32px"}}>
          <div style={{fontSize:18,fontWeight:600,color:"#F1EFE8",marginBottom:6}}>Sign in</div>
          <div style={{fontSize:13,color:"rgba(255,255,255,0.4)",marginBottom:28}}>Access is restricted to authorized personnel only.</div>
          <form onSubmit={handleSubmit}>
            <div style={{marginBottom:16}}>
              <label style={{display:"block",fontSize:12,fontWeight:500,color:"rgba(255,255,255,0.55)",marginBottom:6}}>Email address</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@valkyrie.com" autoComplete="email" autoFocus
                style={{width:"100%",boxSizing:"border-box",padding:"11px 14px",background:"rgba(255,255,255,0.06)",border:"0.5px solid rgba(255,255,255,0.15)",borderRadius:8,fontSize:14,color:"#F1EFE8",outline:"none",fontFamily:"inherit"}}
                onFocus={e=>e.target.style.borderColor="#C8915A"} onBlur={e=>e.target.style.borderColor="rgba(255,255,255,0.15)"}/>
            </div>
            <div style={{marginBottom:24}}>
              <label style={{display:"block",fontSize:12,fontWeight:500,color:"rgba(255,255,255,0.55)",marginBottom:6}}>Password</label>
              <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password"
                style={{width:"100%",boxSizing:"border-box",padding:"11px 14px",background:"rgba(255,255,255,0.06)",border:"0.5px solid rgba(255,255,255,0.15)",borderRadius:8,fontSize:14,color:"#F1EFE8",outline:"none",fontFamily:"inherit"}}
                onFocus={e=>e.target.style.borderColor="#C8915A"} onBlur={e=>e.target.style.borderColor="rgba(255,255,255,0.15)"}/>
            </div>
            {error && (
              <div style={{background:"rgba(239,68,68,0.12)",border:"0.5px solid rgba(239,68,68,0.3)",borderRadius:8,padding:"10px 14px",fontSize:13,color:"#FCA5A5",marginBottom:20}}>{error}</div>
            )}
            <button type="submit" disabled={loading}
              style={{width:"100%",padding:"12px",background:loading?"rgba(200,145,90,0.4)":"#C8915A",border:"none",borderRadius:8,fontSize:14,fontWeight:600,color:loading?"rgba(255,255,255,0.5)":"#1A0F0A",cursor:loading?"not-allowed":"pointer",fontFamily:"inherit"}}>
              {loading ? "Signing in…" : "Sign in →"}
            </button>
          </form>
        </div>
        <div style={{textAlign:"center",marginTop:24,fontSize:12,color:"rgba(255,255,255,0.2)"}}>Valkyrie Capital · Frontier Platform · Confidential</div>
      </div>
    </div>
  );
}
