import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Loader2, CheckCircle2, Server, Database, ArrowRightLeft, Search } from 'lucide-react';
import Card from '../components/Card';
import { discoverArchitecture } from '../utils/discovery';
import type { ArchitectureSnapshot } from '../types';

interface Props {
  onDiscoveryComplete: (snapshot: ArchitectureSnapshot) => void;
  existingSnapshot: ArchitectureSnapshot | null;
}

export default function DiscoveryPage({ onDiscoveryComplete, existingSnapshot }: Props) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const runDiscovery = async () => {
    setRunning(true);
    setError(null);
    setProgress([]);

    try {
      const snapshot = await discoverArchitecture((msg) => {
        setProgress(prev => [...prev, msg]);
      });
      onDiscoveryComplete(snapshot);
      navigate('/snapshot');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Discovery failed');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Telemetry Architecture Discovery</h1>
        <p className="page-description">
          Automatically scan your Cribl environment to build a complete telemetry architecture snapshot.
          This replaces the manual pre-workshop questionnaire by pulling live data from your Stream, Edge, Lake, and Search configurations.
        </p>
      </div>

      <div className="grid grid-2">
        <Card title="What Gets Discovered">
          <ul className="feature-list">
            <li><Server size={16} /> Worker groups and Edge fleets</li>
            <li><Database size={16} /> All configured sources and destinations</li>
            <li><ArrowRightLeft size={16} /> Active data flows and routing rules</li>
            <li><Search size={16} /> Cribl Lake and Search configurations</li>
          </ul>
          <div className="info-box">
            <strong>How it works:</strong> The app reads your current Cribl configuration via the platform API.
            No data is modified — this is a read-only discovery process.
          </div>
        </Card>

        <Card title="Run Discovery">
          {existingSnapshot && !running && (
            <div className="info-box info-box-success">
              <CheckCircle2 size={16} />
              <span>
                Previous discovery found {existingSnapshot.sourceCount} sources and {existingSnapshot.destinationCount} destinations.
                You can re-run to refresh or proceed to the snapshot.
              </span>
            </div>
          )}

          <button
            className="btn btn-primary btn-lg"
            onClick={runDiscovery}
            disabled={running}
          >
            {running ? (
              <>
                <Loader2 size={18} className="spin" />
                Running Discovery...
              </>
            ) : (
              <>
                <Play size={18} />
                {existingSnapshot ? 'Re-run Discovery' : 'Start Discovery'}
              </>
            )}
          </button>

          {progress.length > 0 && (
            <div className="progress-log">
              {progress.map((msg, i) => (
                <div key={i} className="progress-line">
                  <CheckCircle2 size={14} />
                  <span>{msg}</span>
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="error-box">
              <strong>Error:</strong> {error}
            </div>
          )}
        </Card>
      </div>

      <Card title="Workshop Context" className="mt-4">
        <p>
          This app automates the <strong>Telemetry Architecture Review Workshop</strong> discovery phase.
          Instead of spending 45-60 minutes reviewing architecture manually during the workshop,
          this app produces the telemetry snapshot, risk analysis, and strategic recommendations
          in advance — so the workshop can focus on conversation, validation, and future-state design.
        </p>
        <div className="grid grid-3 mt-3">
          <div className="stat-box">
            <div className="stat-label">Workshop Time Saved</div>
            <div className="stat-value">~2 hours</div>
            <div className="stat-detail">Discovery + snapshot creation</div>
          </div>
          <div className="stat-box">
            <div className="stat-label">Deliverables Generated</div>
            <div className="stat-value">4</div>
            <div className="stat-detail">Snapshot, risks, recommendations, exec summary</div>
          </div>
          <div className="stat-box">
            <div className="stat-label">Workshop Focus</div>
            <div className="stat-value">Q&A</div>
            <div className="stat-detail">Conversation over data collection</div>
          </div>
        </div>
      </Card>
    </div>
  );
}
