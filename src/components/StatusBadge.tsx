interface Props {
  status: 'active' | 'inactive' | 'dormant' | 'error';
}

export default function StatusBadge({ status }: Props) {
  const colors = {
    active: 'badge-success',
    inactive: 'badge-muted',
    dormant: 'badge-warning',
    error: 'badge-danger',
  };

  const labels = {
    active: 'Active',
    inactive: 'Inactive',
    dormant: 'Configured - Dormant',
    error: 'Error',
  };

  return (
    <span className={`badge ${colors[status]}`}>
      {labels[status]}
    </span>
  );
}
