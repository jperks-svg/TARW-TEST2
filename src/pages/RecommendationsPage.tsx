import { useMemo } from 'react';
import { Lightbulb, ArrowRight, Clock, Zap, Target } from 'lucide-react';
import Card from '../components/Card';
import { identifyRisks, generateRecommendations, generateTieringRecommendations } from '../utils/analysis';
import type { ArchitectureSnapshot } from '../types';

interface Props {
  snapshot: ArchitectureSnapshot | null;
}

const PRIORITY_ICONS = {
  immediate: Zap,
  'short-term': Clock,
  'long-term': Target,
};

const PRIORITY_LABELS = {
  immediate: 'Immediate (0-4 weeks)',
  'short-term': 'Short-Term (1-3 months)',
  'long-term': 'Long-Term (3-6 months)',
};

export default function RecommendationsPage({ snapshot }: Props) {
  const { recommendations, tieringRecs } = useMemo(() => {
    if (!snapshot) return { recommendations: [], tieringRecs: [] };
    const risks = identifyRisks(snapshot);
    return {
      recommendations: generateRecommendations(snapshot, risks),
      tieringRecs: generateTieringRecommendations(snapshot),
    };
  }, [snapshot]);

  if (!snapshot) {
    return (
      <div className="page">
        <div className="empty-state">
          <h2>No Discovery Data</h2>
          <p>Run the discovery process first to generate recommendations.</p>
        </div>
      </div>
    );
  }

  const immediate = recommendations.filter(r => r.priority === 'immediate');
  const shortTerm = recommendations.filter(r => r.priority === 'short-term');
  const longTerm = recommendations.filter(r => r.priority === 'long-term');

  return (
    <div className="page">
      <div className="page-header">
        <h1>Strategic Recommendations</h1>
        <p className="page-description">
          Prioritized recommendations to evolve your telemetry architecture toward a multi-destination,
          tiered, and resilient model — based on your current state and identified risks.
        </p>
      </div>

      {recommendations.length === 0 ? (
        <Card>
          <div className="empty-state">
            <Lightbulb size={32} />
            <h3>Architecture Looks Good</h3>
            <p>No major recommendations at this time. Review the tiering table below for optimization opportunities.</p>
          </div>
        </Card>
      ) : (
        <>
          {[
            { items: immediate, key: 'immediate' as const },
            { items: shortTerm, key: 'short-term' as const },
            { items: longTerm, key: 'long-term' as const },
          ].filter(g => g.items.length > 0).map(({ items, key }) => {
            const Icon = PRIORITY_ICONS[key];
            return (
              <div key={key} className="recommendation-group">
                <h2 className="group-title">
                  <Icon size={20} />
                  {PRIORITY_LABELS[key]}
                </h2>
                {items.map(rec => (
                  <Card key={rec.id} className="recommendation-card">
                    <div className="rec-header">
                      <h3>{rec.title}</h3>
                      <div className="rec-meta">
                        <span className={`badge badge-effort-${rec.effort}`}>Effort: {rec.effort}</span>
                        <span className={`badge badge-impact-${rec.impact}`}>Impact: {rec.impact}</span>
                      </div>
                    </div>
                    <p className="rec-description">{rec.description}</p>
                    <div className="rec-steps">
                      <h4>Implementation Steps</h4>
                      <ol>
                        {rec.steps.map((step, i) => (
                          <li key={i}>
                            <ArrowRight size={14} />
                            <span>{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </Card>
                ))}
              </div>
            );
          })}
        </>
      )}

      {tieringRecs.length > 0 && (
        <Card title="Data Tiering Recommendations" subtitle="Per-source routing and retention strategy" className="mt-4">
          <div className="table-scroll">
            <table className="data-table data-table-full tiering-table">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Current Destination</th>
                  <th>Tier 0 (Hot/SIEM)</th>
                  <th>Tier 1 (Warm/Lake)</th>
                  <th>Tier 2 (Cold/Archive)</th>
                  <th>Rationale</th>
                </tr>
              </thead>
              <tbody>
                {tieringRecs.slice(0, 20).map((rec, i) => (
                  <tr key={i}>
                    <td>
                      <strong>{rec.sourceName}</strong>
                      <br /><span className="text-muted">{rec.sourceType}</span>
                    </td>
                    <td>{rec.currentDestination}</td>
                    <td>
                      {rec.recommendedTier0}
                      <br /><span className="text-muted">{rec.tier0Retention}</span>
                    </td>
                    <td>
                      {rec.recommendedTier1}
                      <br /><span className="text-muted">{rec.tier1Retention}</span>
                    </td>
                    <td>
                      {rec.recommendedTier2}
                      <br /><span className="text-muted">{rec.tier2Retention}</span>
                    </td>
                    <td className="rationale-cell">{rec.rationale}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
