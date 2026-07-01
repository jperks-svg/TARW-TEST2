import { NavLink, Outlet } from 'react-router-dom';
import { Compass, BarChart3, AlertTriangle, Lightbulb, Zap, TrendingUp, DollarSign, FileText } from 'lucide-react';

const NAV_ITEMS = [
  { to: '/', icon: Compass, label: 'Discovery' },
  { to: '/snapshot', icon: BarChart3, label: 'Telemetry Snapshot' },
  { to: '/risks', icon: AlertTriangle, label: 'Risk Analysis' },
  { to: '/recommendations', icon: Lightbulb, label: 'Recommendations' },
  { to: '/opportunities', icon: Zap, label: 'Opportunities' },
  { to: '/maturity', icon: TrendingUp, label: 'Maturity & Possible' },
  { to: '/value', icon: DollarSign, label: 'Customer Value' },
  { to: '/deliverables', icon: FileText, label: 'Deliverables' },
];

export default function Layout() {
  return (
    <div className="app-layout">
      <nav className="sidebar">
        <div className="sidebar-header">
          <h2>Telemetry Architecture Review</h2>
        </div>
        <ul className="nav-list">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <li key={to}>
              <NavLink to={to} className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'} end={to === '/'}>
                <Icon size={18} />
                <span>{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
