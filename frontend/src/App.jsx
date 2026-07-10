import { useState, useEffect } from "react";
import LoginPage from "./LoginPage";
import FundDashboard from "./fund_dashboard";

const AUTH_BASE = import.meta.env.VITE_AUTH_URL || "http://localhost:8000/api/auth";

async function refreshAccessToken() {
  const refresh = localStorage.getItem("vk_refresh_token");
  if (!refresh) return null;
  try {
    const res = await fetch(`${AUTH_BASE}/token/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });
    if (!res.ok) return null;
    const { access } = await res.json();
    localStorage.setItem("vk_token", access);
    return access;
  } catch { return null; }
}

export default function App() {
  const [token,    setToken]    = useState(() => localStorage.getItem("vk_token"));
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function verifyToken() {
      const existing = localStorage.getItem("vk_token");
      if (!existing) { setChecking(false); return; }
      try {
        const res = await fetch(`${AUTH_BASE}/token/verify/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: existing }),
        });
        if (res.ok) {
          setToken(existing);
        } else {
          const newToken = await refreshAccessToken();
          if (newToken) setToken(newToken);
          else handleLogout();
        }
      } catch {
        setToken(existing);
      }
      setChecking(false);
    }
    verifyToken();
  }, []);

  function handleLogin(accessToken) { setToken(accessToken); }

  function handleLogout() {
    localStorage.removeItem("vk_token");
    localStorage.removeItem("vk_refresh_token");
    setToken(null);
  }

  if (checking) return (
    <div style={{minHeight:"100vh",background:"#1A0F0A",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{fontSize:13,color:"rgba(255,255,255,0.3)",fontFamily:"system-ui"}}>Loading…</div>
    </div>
  );

  if (!token) return <LoginPage onLogin={handleLogin}/>;
  return <FundDashboard onLogout={handleLogout}/>;
}
