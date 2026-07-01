import { useMemo } from 'react';
import { Map, DollarSign, Zap, ArrowRight, CheckCircle2, Circle, Clock, Calendar, Timer } from 'lucide-react';
import Card from '../components/Card';
import { formatBytes } from '../utils/analysis';
import { generateSourceUseCaseMap, generateCostModel, identifyQuickWins } from '../utils/opportunities';
import { estimateQuickWinValue, estimateSourceAnnualCost } from '../utils/value';
import type { ArchitectureSnapshot } from '../types';

interface Props {
  snapshot: ArchitectureSnapshot | null;
  costPerGB: number;
}

export default function OpportunitiesPage({ snapshot, costPerGB }: Props) {
  const { useCaseMap, costModel, quickWins } = useMemo(() => {
    if (!snapshot) return { useCaseMap: [], costModel: null, quickWins: [] };
    return {
      useCaseMap: generateSourceUseCaseMap(snapshot),
      costModel: generateCostModel(snapshot),
      quickWins: identifyQuickWins(snapshot),
    };
  }, [snapshot]);

  if (!snapshot) {
    return (
      <div className="page">
        <div className="empty-state">
          <h2>No Discovery Data</h2>
          <p>Run the discovery process first to identify opportunities.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Opportunities</h1>
        <p className="page-description">
          Quick wins you can act on immediately, per-source use case mapping, and the cost
          impact of evolving to a multi-destination tiered architecture.
        </p>
      </div>

      {/* Quick Wins */}
      {quickWins.length > 0 && (
        <>
          <div className="section-header">
            <h2><Zap size={22} style={{ color: '#f59e0b' }} /> Quick Wins</h2>
            <p>Low-effort changes that unlock immediate value — most take minutes to implement.</p>
          </div>

          <div className="quick-wins-list">
            {quickWins.map(win => {
              const winEstimate = snapshot ? estimateQuickWinValue(win, snapshot, costPerGB) : null;
              return (
                <div key={win.id} className={`quick-win-card impact-${win.impact}`}>
                  <div className="quick-win-header">
                    <h3>{win.title}</h3>
                    <div className="quick-win-meta">
                      {winEstimate && winEstimate.amount > 0 && (
                        <span className="badge badge-value">
                          <DollarSign size={11} />
                          ${formatCurrency(winEstimate.amount)}/yr
                        </span>
                      )}
                      <span className={`badge badge-effort-${win.effort === 'minutes' ? 'low' : win.effort === 'hours' ? 'medium' : 'high'}`}>
                        {win.effort === 'minutes' ? <Timer size={11} /> : win.effort === 'hours' ? <Clock size={11} /> : <Calendar size={11} />}
                        {win.effort}
                      </span>
                      <span className={`badge badge-impact-${win.impact}`}>
                        Impact: {win.impact}
                      </span>
                    </div>
                  </div>
                  <p className="quick-win-desc">{win.description}</p>
                  {winEstimate && winEstimate.formula && (
                    <div className="quick-win-formula">
                      <span>{winEstimate.formula}</span>
                    </div>
                  )}
                  <div className="quick-win-action">
                    <ArrowRight size={14} />
                    <span><strong>Action:</strong> {win.action}</span>
                  </div>
                  <div className="quick-win-evidence">
                    <span>{win.evidence}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Cost Model */}
      {costModel && costModel.currentDailyGB > 0 && (
        <>
          <div className="section-header mt-4">
            <h2><DollarSign size={22} style={{ color: '#10b981' }} /> Cost/Value Model</h2>
            <p>Estimated impact of shifting from single-destination to tiered architecture.</p>
          </div>

          <div className="cost-model-grid">
            <Card className="cost-card cost-current">
              <div className="cost-card-header">Current State</div>
              <div className="cost-value">${formatCurrency(costModel.currentAnnualEstimate)}</div>
              <div className="cost-detail">est. annual / all to SIEM</div>
              <div className="cost-breakdown">
                <div className="cost-line">
                  <span>Daily Volume</span>
                  <span>{formatBytes(costModel.currentDailyGB)}</span>
                </div>
                <div className="cost-line">
                  <span>Destinations</span>
                  <span>100% → SIEM</span>
                </div>
              </div>
            </Card>

            <Card className="cost-card cost-proposed">
              <div className="cost-card-header">With Data Tiering</div>
              <div className="cost-value cost-value-savings">${formatCurrency(costModel.proposedAnnualEstimate)}</div>
              <div className="cost-detail">est. annual / tiered model</div>
              <div className="cost-breakdown">
                <div className="cost-line">
                  <span>SIEM (Hot)</span>
                  <span>{formatBytes(costModel.proposedSIEMDailyGB)}/day</span>
                </div>
                <div className="cost-line">
                  <span>Lake (Warm)</span>
                  <span>{formatBytes(costModel.proposedLakeDailyGB)}/day</span>
                </div>
                <div className="cost-line">
                  <span>Archive (Cold)</span>
                  <span>{formatBytes(costModel.proposedArchiveDailyGB)}/day</span>
                </div>
              </div>
            </Card>

            <Card className="cost-card cost-savings">
              <div className="cost-card-header">Estimated Savings</div>
              <div className="cost-value cost-value-highlight">${formatCurrency(costModel.annualSavings)}</div>
              <div className="cost-detail">{costModel.savingsPercent.toFixed(0)}% annual reduction</div>
              <div className="cost-breakdown">
                <div className="cost-line">
                  <span>Per Day</span>
                  <span>${formatCurrency(costModel.annualSavings / 365)}</span>
                </div>
                <div className="cost-line">
                  <span>Per Month</span>
                  <span>${formatCurrency(costModel.annualSavings / 12)}</span>
                </div>
              </div>
            </Card>
          </div>

          <Card className="mt-3" title="Assumptions" subtitle="Adjust these based on customer-specific contract pricing">
            <ul className="assumptions-list">
              {costModel.assumptions.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </Card>
        </>
      )}

      {/* Per-Source Use Case Map */}
      {useCaseMap.length > 0 && (
        <>
          <div className="section-header mt-4">
            <h2><Map size={22} style={{ color: '#8b5cf6' }} /> Per-Source Use Case Map</h2>
            <p>What's possible with each active data source across the Cribl product suite.</p>
          </div>

          <div className="use-case-list">
            {useCaseMap.map(source => {
              const matchedSource = snapshot!.sources.find(s => s.id === source.sourceId);
              const annualCost = matchedSource ? estimateSourceAnnualCost(matchedSource.dailyVolumeGB, costPerGB) : 0;
              return (
              <Card key={source.sourceId} className="use-case-card">
                <div className="use-case-header">
                  <div>
                    <h3>{source.sourceName}</h3>
                    <span className="text-muted">{source.sourceType} • {source.category}</span>
                  </div>
                  <div className="use-case-counts">
                    {annualCost > 0 && (
                      <span className="badge badge-value">${formatCurrency(annualCost)}/yr ingest cost</span>
                    )}
                    <span className="badge badge-success">{source.currentState.length} active</span>
                    <span className="badge badge-info">{source.possibleStates.length} possible</span>
                  </div>
                </div>

                <div className="use-case-grid">
                  {source.currentState.map((uc, i) => (
                    <div key={i} className="use-case-item active">
                      <CheckCircle2 size={14} style={{ color: '#10b981' }} />
                      <div>
                        <div className="use-case-label">{uc.label}</div>
                        <div className="use-case-desc">{uc.useCase}</div>
                      </div>
                    </div>
                  ))}
                  {source.possibleStates.map((uc, i) => (
                    <div key={i} className="use-case-item possible">
                      <Circle size={14} style={{ color: '#8b5cf6' }} />
                      <div>
                        <div className="use-case-label">{uc.label}</div>
                        <div className="use-case-desc">{uc.useCase}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function formatCurrency(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
  return value.toFixed(0);
}
