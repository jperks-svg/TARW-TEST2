import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Clock, Shield, Gauge, Eye } from 'lucide-react';
import type { ArchitectureSnapshot, ValueFormula } from '../types';
import { calculateCustomerValue } from '../utils/value';

interface Props {
  snapshot: ArchitectureSnapshot | null;
  costPerGB: number;
  onCostChange: (cost: number) => void;
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

const CATEGORY_LABELS: Record<string, string> = {
  'cost-reduction': 'Cost Reduction',
  'operational': 'Operational Efficiency',
  'flexibility': 'Strategic Flexibility',
  'risk-mitigation': 'Risk Mitigation',
};

const CATEGORY_COLORS: Record<string, string> = {
  'cost-reduction': '#10b981',
  'operational': '#3b82f6',
  'flexibility': '#8b5cf6',
  'risk-mitigation': '#f59e0b',
};

const QUAL_CATEGORY_LABELS: Record<string, string> = {
  'time-savings': 'Time Savings',
  'risk-posture': 'Risk Posture',
  'agility': 'Agility',
  'visibility': 'Visibility',
};

const QUAL_CATEGORY_ICONS: Record<string, typeof Clock> = {
  'time-savings': Clock,
  'risk-posture': Shield,
  'agility': Gauge,
  'visibility': Eye,
};

function FormulaBreakdown({ formula }: { formula: ValueFormula }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="formula-container">
      <button className="formula-toggle" onClick={() => setExpanded(!expanded)}>
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span className="formula-expression">{formula.expression}</span>
        <span className="formula-result">= {formula.result}</span>
      </button>
      {expanded && (
        <div className="formula-details">
          {formula.variables.map((v, i) => (
            <div key={i} className="formula-variable">
              <span className="formula-var-label">{v.label}:</span>
              <span className="formula-var-value">{v.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ValuePage({ snapshot, costPerGB, onCostChange }: Props) {

  const value = useMemo(() => {
    if (!snapshot) return null;
    return calculateCustomerValue(snapshot, costPerGB);
  }, [snapshot, costPerGB]);

  if (!snapshot) {
    return (
      <div className="page-container">
        <h1>Customer Value</h1>
        <div className="empty-state">
          <p>Run a discovery scan first to calculate customer value.</p>
        </div>
      </div>
    );
  }

  if (!value) return null;

  const categoryTotals = value.valueLineItems.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + item.annualValue;
    return acc;
  }, {} as Record<string, number>);

  const totalProjected = value.currentAnnualValue + value.projectedAnnualValue;

  return (
    <div className="page-container">
      <h1>Customer Value</h1>
      <p className="page-subtitle">
        Measure and articulate the value delivered through your Cribl investment — both realized today and achievable at higher maturity levels.
      </p>

      {/* Cost Input */}
      <div className="value-cost-input">
        <label htmlFor="cost-per-gb">Your Cost per GB/day (USD)</label>
        <div className="cost-input-group">
          <span className="cost-prefix">$</span>
          <input
            id="cost-per-gb"
            type="number"
            min={0.01}
            step={0.25}
            value={costPerGB}
            onChange={(e) => onCostChange(Math.max(0.01, parseFloat(e.target.value) || 0.01))}
          />
          <span className="cost-suffix">/GB/day</span>
        </div>
        <p className="cost-hint">
          Adjust this to match your actual destination licensing cost (e.g., Splunk ingest pricing, Datadog per-GB, etc.). This value is used across all pages.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="value-summary-grid">
        <div className="value-summary-card current">
          <div className="value-summary-label">Current Annual Value</div>
          <div className="value-summary-amount">{formatCurrency(value.currentAnnualValue)}</div>
          <div className="value-summary-detail">{value.valueLineItems.length} quantified + {value.qualitativeValues.length} qualitative</div>
        </div>
        <div className="value-summary-card projected">
          <div className="value-summary-label">Projected Additional Value</div>
          <div className="value-summary-amount">{formatCurrency(value.projectedAnnualValue)}</div>
          <div className="value-summary-detail">At next maturity levels</div>
        </div>
        <div className="value-summary-card total">
          <div className="value-summary-label">Total Achievable Value</div>
          <div className="value-summary-amount">{formatCurrency(totalProjected)}</div>
          <div className="value-summary-detail">Current + projected growth</div>
        </div>
      </div>

      {/* Category Breakdown */}
      <section className="value-section">
        <h2>Value by Category</h2>
        <div className="value-category-bars">
          {Object.entries(categoryTotals)
            .sort(([, a], [, b]) => b - a)
            .map(([category, total]) => (
              <div key={category} className="value-category-row">
                <div className="value-category-label">
                  <span className="value-dot" style={{ backgroundColor: CATEGORY_COLORS[category] }}></span>
                  {CATEGORY_LABELS[category] || category}
                </div>
                <div className="value-category-bar-container">
                  <div
                    className="value-category-bar"
                    style={{
                      width: `${(total / value.currentAnnualValue) * 100}%`,
                      backgroundColor: CATEGORY_COLORS[category],
                    }}
                  ></div>
                </div>
                <div className="value-category-amount">{formatCurrency(total)}</div>
              </div>
            ))}
        </div>
      </section>

      {/* Current Value Detail */}
      <section className="value-section">
        <h2>Quantified Value — Current</h2>
        <p className="section-subtitle">Click any formula to see the full calculation breakdown.</p>
        <div className="value-items-grid">
          {value.valueLineItems.map((item) => (
            <div key={item.id} className="value-item-card">
              <div className="value-item-header">
                <span className="value-item-category" style={{ color: CATEGORY_COLORS[item.category] }}>
                  {CATEGORY_LABELS[item.category]}
                </span>
                <span className="value-item-amount">{formatCurrency(item.annualValue)}/yr</span>
              </div>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
              <FormulaBreakdown formula={item.formula} />
            </div>
          ))}
        </div>
      </section>

      {/* Qualitative Value */}
      {value.qualitativeValues.length > 0 && (
        <section className="value-section">
          <h2>Qualitative Value</h2>
          <p className="section-subtitle">
            Value that matters but doesn't reduce to a single dollar figure — time savings per engineer, risk posture improvements, and operational agility.
          </p>
          <div className="value-items-grid">
            {value.qualitativeValues.map((item) => {
              const Icon = QUAL_CATEGORY_ICONS[item.category] || Eye;
              return (
                <div key={item.id} className="value-item-card qualitative">
                  <div className="value-item-header">
                    <span className="value-item-category qualitative-category">
                      <Icon size={13} />
                      {QUAL_CATEGORY_LABELS[item.category]}
                    </span>
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                  <div className="qualitative-metric">
                    {item.metric}
                  </div>
                  <div className="value-item-evidence">
                    <strong>Evidence:</strong> {item.evidence}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Projected Value */}
      {value.projections.length > 0 && (
        <section className="value-section">
          <h2>Projected Value at Higher Maturity</h2>
          <p className="section-subtitle">
            Additional value achievable by progressing up the maturity model. Click formulas to see assumptions.
          </p>
          <div className="value-projections-grid">
            {value.projections.map((proj) => (
              <div key={proj.id} className="value-projection-card">
                <div className="value-projection-header">
                  <span className="value-projection-level">L{proj.targetLevel}</span>
                  <span className="value-projection-amount">+{formatCurrency(proj.additionalAnnualValue)}/yr</span>
                </div>
                <h3>{proj.title}</h3>
                <p>{proj.description}</p>
                <FormulaBreakdown formula={proj.formula} />
                <div className="value-projection-requirement">
                  <strong>To unlock:</strong> {proj.requirement}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
