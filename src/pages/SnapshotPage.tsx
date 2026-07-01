import { Database, Server, ArrowRightLeft, HardDrive, Layers, Search } from 'lucide-react';
import Card from '../components/Card';
import MetricCard from '../components/MetricCard';
import StatusBadge from '../components/StatusBadge';
import { formatBytes, getInputTypeLabel, getOutputTypeLabel } from '../utils/analysis';
import type { ArchitectureSnapshot } from '../types';

interface Props {
  snapshot: ArchitectureSnapshot | null;
}

export default function SnapshotPage({ snapshot }: Props) {
  if (!snapshot) {
    return (
      <div className="page">
        <div className="empty-state">
          <h2>No Discovery Data</h2>
          <p>Run the discovery process first to generate your telemetry snapshot.</p>
        </div>
      </div>
    );
  }

  const streamGroups = snapshot.groups.filter(g => !g.isFleet && g.id !== 'default_search');
  const edgeGroups = snapshot.groups.filter(g => g.isFleet);
  const activeSources = snapshot.sources.filter(s => s.status === 'active');
  const dormantSources = snapshot.sources.filter(s => s.status === 'dormant');
  const activeDestinations = snapshot.destinations.filter(d => d.status === 'active');
  const dormantDestinations = snapshot.destinations.filter(d => d.status === 'dormant');

  return (
    <div className="page">
      <div className="page-header">
        <h1>Current Telemetry Snapshot</h1>
        <p className="page-description">
          Auto-generated overview of your telemetry architecture — sources, destinations, volumes, and product adoption.
        </p>
      </div>

      <div className="metrics-grid">
        <MetricCard label="Daily Ingest" value={formatBytes(snapshot.totalDailyIngestGB)} icon={<Database size={20} />} />
        <MetricCard label="Daily Outgest" value={formatBytes(snapshot.totalDailyOutgestGB)} icon={<HardDrive size={20} />} />
        <MetricCard label="Active Sources" value={activeSources.length} detail={dormantSources.length > 0 ? `${dormantSources.length} dormant` : undefined} icon={<Server size={20} />} />
        <MetricCard label="Active Destinations" value={activeDestinations.length} detail={dormantDestinations.length > 0 ? `${dormantDestinations.length} dormant` : undefined} icon={<ArrowRightLeft size={20} />} />
        <MetricCard label="Destination Types" value={snapshot.uniqueDestinationTypes.length} icon={<Layers size={20} />} />
        <MetricCard label="Search Datasets" value={snapshot.searchDatasets.length} icon={<Search size={20} />} />
      </div>

      <div className="grid grid-3 mt-4">
        <Card title="Product Adoption">
          <table className="data-table">
            <tbody>
              <tr>
                <td>Stream</td>
                <td><StatusBadge status={streamGroups.length > 0 ? 'active' : 'inactive'} /></td>
                <td>{streamGroups.length} group(s)</td>
              </tr>
              <tr>
                <td>Edge</td>
                <td><StatusBadge status={snapshot.hasEdge ? 'active' : edgeGroups.length > 0 ? 'dormant' : 'inactive'} /></td>
                <td>{edgeGroups.length > 0 ? `${edgeGroups.length} fleet(s), ${snapshot.edgeNodeCount} active node(s)` : 'Not deployed'}</td>
              </tr>
              <tr>
                <td>Lake</td>
                <td><StatusBadge status={snapshot.hasLake ? 'active' : 'inactive'} /></td>
                <td>{snapshot.hasLake ? 'Configured' : 'Not in use'}</td>
              </tr>
              <tr>
                <td>Search</td>
                <td><StatusBadge status={snapshot.hasSearch ? 'active' : 'inactive'} /></td>
                <td>{snapshot.searchDatasets.length} dataset(s)</td>
              </tr>
            </tbody>
          </table>
        </Card>

        <Card title="Worker Groups">
          {streamGroups.length === 0 && edgeGroups.length === 0 ? (
            <p className="text-muted">No groups found</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr><th>Group</th><th>Type</th></tr>
              </thead>
              <tbody>
                {streamGroups.map(g => (
                  <tr key={g.id}><td>{g.id}</td><td>Stream</td></tr>
                ))}
                {edgeGroups.map(g => (
                  <tr key={g.id}><td>{g.id}</td><td>Edge</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Destination Types">
          {snapshot.uniqueDestinationTypes.length === 0 ? (
            <p className="text-muted">No active destinations</p>
          ) : (
            <ul className="type-list">
              {snapshot.uniqueDestinationTypes.map(type => {
                const count = activeDestinations.filter(d => d.type === type).length;
                return (
                  <li key={type}>
                    <span className="type-label">{getOutputTypeLabel(type)}</span>
                    <span className="type-count">{count}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <Card title="Sources" subtitle={`${activeSources.length} active, ${dormantSources.length} configured-dormant`} className="mt-4">
        <div className="table-scroll">
          <table className="data-table data-table-full">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Group</th>
                <th>Product</th>
                <th>Category</th>
                <th>Est. Daily Volume</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.sources
                .sort((a, b) => b.dailyVolumeGB - a.dailyVolumeGB)
                .slice(0, 50)
                .map(source => (
                  <tr key={source.id}>
                    <td>{source.name}</td>
                    <td>{getInputTypeLabel(source.type)}</td>
                    <td>{source.group}</td>
                    <td className="capitalize">{source.product}</td>
                    <td className="capitalize">{source.dataCategory}</td>
                    <td>{source.dailyVolumeGB > 0 ? formatBytes(source.dailyVolumeGB) : '—'}</td>
                    <td><StatusBadge status={source.status} /></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Destinations" subtitle={`${activeDestinations.length} active, ${dormantDestinations.length} configured-dormant`} className="mt-4">
        <div className="table-scroll">
          <table className="data-table data-table-full">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Group</th>
                <th>Est. Daily Volume</th>
                <th>PQ Enabled</th>
                <th>Backpressure</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.destinations
                .sort((a, b) => b.dailyVolumeGB - a.dailyVolumeGB)
                .slice(0, 50)
                .map(dest => (
                  <tr key={dest.id}>
                    <td>{dest.name}</td>
                    <td>{getOutputTypeLabel(dest.type)}</td>
                    <td>{dest.group}</td>
                    <td>{dest.dailyVolumeGB > 0 ? formatBytes(dest.dailyVolumeGB) : '—'}</td>
                    <td>{dest.pqEnabled ? '✓' : '—'}</td>
                    <td>{dest.hasBackpressure ? <span className="text-danger">Yes</span> : '—'}</td>
                    <td><StatusBadge status={dest.status} /></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
