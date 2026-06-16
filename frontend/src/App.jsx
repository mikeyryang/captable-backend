import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import CapTableApp from './cap_table_func.jsx'
import FundDashboard from './fund_dashboard.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <div style={{ minHeight: '100vh' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 24px', background: '#2A1D16',
          borderBottom: '0.5px solid rgba(255,255,255,0.08)',
          position: 'sticky', top: 0, zIndex: 100,
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#E8C9A8', marginRight: 16, letterSpacing: '0.04em' }}>
            VALKYRIE FUND
          </span>
          {[
            { to: '/', label: 'Fund Dashboard' },
            { to: '/captable', label: 'Cap Table Tool' },
          ].map(({ to, label }) => (
            <NavLink key={to} to={to} end style={({ isActive }) => ({
              fontSize: 12, padding: '5px 14px', borderRadius: 6, textDecoration: 'none',
              fontWeight: isActive ? 500 : 400,
              background: isActive ? 'rgba(200,145,90,0.18)' : 'transparent',
              color: isActive ? '#E8C9A8' : 'rgba(255,255,255,0.45)',
              border: '0.5px solid ' + (isActive ? 'rgba(200,145,90,0.4)' : 'transparent'),
              transition: 'all .12s',
            })}>
              {label}
            </NavLink>
          ))}
        </div>
        <Routes>
          <Route path="/" element={<FundDashboard />} />
          <Route path="/captable" element={<CapTableApp />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
