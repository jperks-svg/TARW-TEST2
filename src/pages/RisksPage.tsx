import { useMemo } from 'react';
import { AlertTriangle, Shield, DollarSign, Zap, Search, Database, RefreshCw } from 'lucide-react';
import Card from '../components/Card';
import SeverityBadge from '../components/SeverityBadge';
import { identifyRisks } from '../utils/analysis';
import type { ArchitectureSnapshot, Risk } from '../types';

interface Props {
  snapshot: ArchitectureSnapshot | null;
}

const CATEGORY_ICONS: Record<string, typeof AlertTriangle> = {
  'single-destination': Shield,
  cost: DollarSign,
  flexibility: Zap,
  investigation: Search,
  retention: Database,
  resilience: RefreshCw,
  upgrade: RefreshCw,
};

const CATEGORY_LABELS: Record<string, string> = {
  'single-destination': 'Destination Dependency',
  cost: 'Cost Exposure',
  flexibility: 'Flexibility',
  investigation: 'Investigation Capability',
  retention: 'Retention & Compliance',
  resilience: 'Resilience',
  upgrade: 'Upgrade Posture',
};

export default function RisksPage({ snapshot }: Props) {
  const risks = useMemo(() => {
    if (!snapshot) return [];
    return identifyRisks(snapshot);
  }, [snapshot]);

  if (!snapshot) {
    return (
      <div className="page">
        <div className="empty-state">
          <h2>No Discovery Data</h2>
          <p>Run the discovery process first to generate risk analysis.</p>
        </div>
      </div>
    );
  }

  const highRisks = risks.filter(r => r.severity === 'high');
  const medRisks = risks.filter(r => r.severity === 'medium');
  const lowRisks = risks.filter(r => r.severity === 'low');

  return (
    <div className="page">
      <div className="page-header">
        <h1>Risk Analysis</h1>
        <p className="page-description">
          Identified architectural risks based on your current telemetry configuration.
          These align to the TARW workshop's core risk themes: single-destination dependency, cost trajectory,
          flexibility limitations, and investigation friction.
        </p>
      </div>

      <div className="risk-summary">
        <div className="risk-count risk-high">
          <span className="count">{highRisks.length}</span>
          <span className="label">High</span>
        </div>
        <div className="risk-count risk-medium">
          <span className="count">{medRisks.length}</span>
          <span className="label">Medium</span>
        </div>
        <div className="risk-count risk-low">
          <span className="count">{lowRisks.length}</span>
          <span className="label">Low</span>
        </div>
      </div>

      {risks.length === 0 ? (
        <Card className="mt-4">
          <div className="empty-state">
            <h3>No Significant Risks Detected</h3>
            <p>Your architecture appears well-diversified. Consider running a deeper review during the workshop to validate.</p>
          </div>
        </Card>
      ) : (
        <div className="risks-list mt-4">
          {risks.map(risk => (
            <RiskCard key={risk.id} risk={risk} />
          ))}
        </div>
      )}

      <Card title="Workshop Discussion Prompts" className="mt-4">
        <p className="text-muted mb-3">
          Use these prompts during the workshop to guide the risk discussion. The goal is for the customer
          to articulate these risks in their own words.
        </p>
        <div className="discussion-prompts">
          {highRisks.length > 0 && (
            <div className="prompt-section">
              <h4>Single-Destination & Cost Risks</h4>
              <ul>
                <li>"Walk me through what happens if your primary destination is degraded or unavailable."</li>
                <li>"How has your telemetry cost changed over the last 2-3 years? What are you expecting next year?"</li>
                <li>"How easy is it today to try a new tool or switch vendors?"</li>
              </ul>
            </div>
          )}
          {risks.some(r => r.category === 'investigation') && (
            <div className="prompt-section">
              <h4>Investigation Friction</h4>
              <ul>
                <li>"In your last major incident, where did you spend the most time waiting on data?"</li>
                <li>"How many tools are typically involved in an investigation?"</li>
                <li>"Do teams ever re-ingest data to troubleshoot?"</li>
              </ul>
            </div>
          )}
          {risks.some(r => r.category === 'retention') && (
            <div className="prompt-section">
              <h4>Retention & Compliance</h4>
              <ul>
                <li>"Where are you forced to drop data or shorten retention because of cost?"</li>
                <li>"Have investigations ever failed due to missing historical data?"</li>
                <li>"What retention guarantees exist today, and what happens when limits are hit?"</li>
              </ul>
            </div>
          )}
          <div className="prompt-section">
            <h4>Architecture Maturity</h4>
            <ul>
              <li>"How often do you have to re-onboard sources or re-build integrations when tools change?"</li>
              <li>"Which pipelines are considered 'do not touch' and why?"</li>
              <li>"How are pipeline changes tested? What's the rollback process?"</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}

function RiskCard({ risk }: { risk: Risk }) {
  const Icon = CATEGORY_ICONS[risk.category] ?? AlertTriangle;
  const categoryLabel = CATEGORY_LABELS[risk.category] ?? risk.category;

  return (
    <div className={`risk-card risk-card-${risk.severity}`}>
      <div className="risk-card-header">
        <div className="risk-card-title">
          <Icon size={18} />
          <h3>{risk.title}</h3>
        </div>
        <div className="risk-card-meta">
          <span className="risk-category">{categoryLabel}</span>
          <SeverityBadge severity={risk.severity} />
        </div>
      </div>
      <p className="risk-description">{risk.description}</p>
      <div className="risk-evidence">
        <strong>Evidence:</strong> {risk.evidence}
      </div>
      <div className="risk-recommendation">
        <strong>Recommendation:</strong> {risk.recommendation}
      </div>
    </div>
  );
}
