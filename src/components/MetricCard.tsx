import type { ReactNode } from 'react';

interface Props {
  label: string;
  value: string | number;
  icon?: ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  detail?: string;
}

export default function MetricCard({ label, value, icon, detail }: Props) {
  return (
    <div className="metric-card">
      {icon && <div className="metric-icon">{icon}</div>}
      <div className="metric-value">{value}</div>
      <div className="metric-label">{label}</div>
      {detail && <div className="metric-detail">{detail}</div>}
    </div>
  );
}
