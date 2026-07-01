import type { RiskSeverity } from '../types';

interface Props {
  severity: RiskSeverity;
}

export default function SeverityBadge({ severity }: Props) {
  const colors = {
    high: 'badge-danger',
    medium: 'badge-warning',
    low: 'badge-info',
  };

  return (
    <span className={`badge ${colors[severity]}`}>
      {severity}
    </span>
  );
}
