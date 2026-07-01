import { useMemo, useCallback } from 'react';
import { FileText, Copy, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import Card from '../components/Card';
import { identifyRisks, generateRecommendations, generateExecutiveSummary, formatBytes } from '../utils/analysis';
import { assessMaturity, MATURITY_LEVELS } from '../utils/maturity';
import type { ArchitectureSnapshot } from '../types';

interface Props {
  snapshot: ArchitectureSnapshot | null;
}

export default function DeliverablesPage({ snapshot }: Props) {
  const [copied, setCopied] = useState<string | null>(null);

  const { summary, risks, recommendations, maturity } = useMemo(() => {
    if (!snapshot) return { summary: null, risks: [], recommendations: [], maturity: null };
    const r = identifyRisks(snapshot);
    const recs = generateRecommendations(snapshot, r);
    return {
      summary: generateExecutiveSummary(snapshot, r, recs),
      risks: r,
      recommendations: recs,
      maturity: assessMaturity(snapshot),
    };
  }, [snapshot]);

  const copyToClipboard = useCallback((text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    });
  }, []);

  if (!snapshot || !summary) {
    return (
      <div className="page">
        <div className="empty-state">
          <h2>No Discovery Data</h2>
          <p>Run the discovery process first to generate deliverables.</p>
        </div>
      </div>
    );
  }

  const execSummaryText = formatExecutiveSummary(summary, snapshot, maturity);
  const futureStateText = formatFutureStateDoc(snapshot, risks, recommendations, maturity);
  const snapshotText = formatSnapshotDoc(snapshot);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Workshop Deliverables</h1>
        <p className="page-description">
          Ready-to-use documents for the Telemetry Architecture Review Workshop.
          Copy these into Google Docs or share directly with the customer team.
        </p>
      </div>

      <div className="deliverables-list">
        <DeliverableCard
          id="exec-summary"
          title="Executive Summary (EBR-Ready)"
          description="Concise narrative for executive stakeholders — current state, risks, evolution path, and next actions."
          content={execSummaryText}
          copied={copied}
          onCopy={copyToClipboard}
        />

        <DeliverableCard
          id="future-state"
          title="Future-State Architecture Recommendations"
          description="Multi-destination model, data tiering approach, routing options, and agreed next actions."
          content={futureStateText}
          copied={copied}
          onCopy={copyToClipboard}
        />

        <DeliverableCard
          id="snapshot"
          title="Current Telemetry Snapshot"
          description="One-page summary of sources, destinations, volumes, and retention for workshop validation."
          content={snapshotText}
          copied={copied}
          onCopy={copyToClipboard}
        />
      </div>
    </div>
  );
}

function DeliverableCard({
  id,
  title,
  description,
  content,
  copied,
  onCopy,
}: {
  id: string;
  title: string;
  description: string;
  content: string;
  copied: string | null;
  onCopy: (text: string, id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card
      title={title}
      subtitle={description}
      actions={
        <div className="btn-group">
          <button className="btn btn-sm" onClick={() => setExpanded(!expanded)}>
            <FileText size={14} />
            {expanded ? 'Collapse' : 'Preview'}
          </button>
          <button className="btn btn-sm btn-primary" onClick={() => onCopy(content, id)}>
            {copied === id ? <CheckCircle2 size={14} /> : <Copy size={14} />}
            {copied === id ? 'Copied!' : 'Copy'}
          </button>
        </div>
      }
    >
      {expanded && (
        <div className="deliverable-preview">
          <pre>{content}</pre>
        </div>
      )}
    </Card>
  );
}

function formatExecutiveSummary(
  summary: NonNullable<ReturnType<typeof generateExecutiveSummary>>,
  _snapshot: ArchitectureSnapshot,
  maturity: ReturnType<typeof assessMaturity> | null
): string {
  let text = `EXECUTIVE SUMMARY — TELEMETRY ARCHITECTURE REVIEW\n`;
  text += `${'='.repeat(55)}\n\n`;

  if (maturity) {
    const currentDef = MATURITY_LEVELS[maturity.currentLevel];
    text += `MATURITY ASSESSMENT\n${'-'.repeat(19)}\n`;
    text += `Current Level: ${currentDef.label} — ${currentDef.title}\n`;
    text += `${currentDef.description}\n`;
    if (maturity.nextLevel) {
      text += `\nNext Level: ${maturity.nextLevel.label} — ${maturity.nextLevel.title}\n`;
      text += `${maturity.nextLevel.description}\n`;
      if (maturity.gapsToNext.length > 0) {
        text += `\nGaps to close:\n`;
        for (const gap of maturity.gapsToNext) {
          text += `  • ${gap}\n`;
        }
      }
    }
    text += '\n';
  }

  text += `CURRENT STATE\n${'-'.repeat(13)}\n`;
  text += `${summary.currentState}\n\n`;

  text += `IDENTIFIED RISKS\n${'-'.repeat(16)}\n`;
  for (const risk of summary.identifiedRisks) {
    text += `• ${risk}\n`;
  }
  text += '\n';

  text += `RECOMMENDED EVOLUTION PATH\n${'-'.repeat(25)}\n`;
  for (const rec of summary.recommendedEvolution) {
    text += `• ${rec}\n`;
  }
  text += '\n';

  if (maturity && maturity.artOfThePossible.length > 0) {
    text += `THE ART OF THE POSSIBLE\n${'-'.repeat(23)}\n`;
    for (const item of maturity.artOfThePossible.slice(0, 5)) {
      text += `• [L${item.level}] ${item.title}: ${item.businessValue}\n`;
    }
    text += '\n';
  }

  text += `POSITIVE BUSINESS OUTCOMES\n${'-'.repeat(25)}\n`;
  for (const outcome of summary.positiveOutcomes) {
    text += `• ${outcome}\n`;
  }
  text += '\n';

  text += `NEXT ACTIONS\n${'-'.repeat(12)}\n`;
  for (const action of summary.nextActions) {
    text += `• ${action.action}\n  Owner: ${action.owner} | Timeline: ${action.timeline}\n`;
  }

  return text;
}

function formatFutureStateDoc(
  snapshot: ArchitectureSnapshot,
  _risks: ReturnType<typeof identifyRisks>,
  recommendations: ReturnType<typeof generateRecommendations>,
  maturity: ReturnType<typeof assessMaturity> | null
): string {
  let text = `FUTURE-STATE ARCHITECTURE RECOMMENDATIONS\n`;
  text += `${'='.repeat(42)}\n\n`;

  if (maturity) {
    const currentDef = MATURITY_LEVELS[maturity.currentLevel];
    text += `MATURITY PROGRESSION\n${'-'.repeat(20)}\n`;
    text += `Current: ${currentDef.label} — ${currentDef.title}\n`;
    if (maturity.nextLevel) {
      text += `Target: ${maturity.nextLevel.label} — ${maturity.nextLevel.title}\n`;
      text += `\nTo reach ${maturity.nextLevel.label}, the architecture should demonstrate:\n`;
      for (const char of maturity.nextLevel.characteristics) {
        text += `  • ${char}\n`;
      }
    }
    text += '\n';
  }

  text += `OBJECTIVES\n${'-'.repeat(10)}\n`;
  if (snapshot.uniqueDestinationTypes.length <= 1) {
    text += `• Reduce single-destination dependency by implementing multi-destination routing\n`;
  }
  text += `• Preserve detection-critical telemetry in the primary SIEM while shifting long-term retention to cost-effective storage\n`;
  text += `• Maintain architectural flexibility so future tools can access data without re-plumbing sources\n\n`;

  text += `MULTI-DESTINATION MODEL (FUTURE-STATE)\n${'-'.repeat(38)}\n`;
  text += `High-level flow:\n`;
  text += `• "Lake-first" fan-out: All events land in Cribl Lake; Stream fans out a curated subset to the primary SIEM based on source, risk, and field importance.\n`;
  text += `• Per-use-case routing: Define which events (and which fields) are required for:\n`;
  text += `  - SIEM detections & dashboards → Primary destination\n`;
  text += `  - Threat hunting, forensics, compliance → Cribl Lake, accessed via Cribl Search\n\n`;

  text += `DATA TIERING APPROACH\n${'-'.repeat(20)}\n`;
  text += `Tier 0 – Hot (Primary SIEM): 30-90 days of high-value, detection-critical events\n`;
  text += `Tier 1 – Warm (Cribl Lake active): Full-fidelity events for 90-365 days\n`;
  text += `Tier 2 – Cold (Lake archive/S3 Glacier): 1-5+ years for compliance/forensics\n\n`;

  text += `ROUTING OPTIONS\n${'-'.repeat(15)}\n`;
  text += `• Option 1 – Split by event importance: Critical → SIEM + Lake; Low-value → Lake only\n`;
  text += `• Option 2 – Split by fields: All events → Lake full schema; SIEM gets reduced schema\n`;
  text += `• Option 3 – Split by retention: Recent high-value → SIEM; Long-term → Lake/S3\n\n`;

  text += `AGREED NEXT ACTIONS\n${'-'.repeat(18)}\n`;
  const immRecs = recommendations.filter(r => r.priority === 'immediate');
  if (immRecs.length > 0) {
    for (const rec of immRecs) {
      text += `• ${rec.title}\n`;
      for (const step of rec.steps.slice(0, 3)) {
        text += `  - ${step}\n`;
      }
    }
  } else {
    text += `• Define source-by-source routing and retention matrix\n`;
    text += `• Pilot dual-destination routing in Cribl Stream\n`;
    text += `• Validate financial impact using representative daily samples\n`;
  }

  text += `\nRECOMMENDED LEARNING PATH\n${'-'.repeat(24)}\n`;
  text += `• Cribl U courses: Focus on Stream routing, multi-destination outputs, and Lake configuration\n`;
  text += `• CSE/SE working sessions: Finalize hot-data definition and first pilot scope\n`;

  return text;
}

function formatSnapshotDoc(snapshot: ArchitectureSnapshot): string {
  let text = `CURRENT TELEMETRY SNAPSHOT\n`;
  text += `${'='.repeat(26)}\n\n`;

  text += `OVERVIEW\n${'-'.repeat(8)}\n`;
  text += `Total Daily Ingest: ${formatBytes(snapshot.totalDailyIngestGB)}\n`;
  text += `Total Daily Outgest: ${formatBytes(snapshot.totalDailyOutgestGB)}\n`;
  text += `Active Sources: ${snapshot.sourceCount}\n`;
  text += `Active Destinations: ${snapshot.destinationCount}\n`;
  text += `Destination Types: ${snapshot.uniqueDestinationTypes.join(', ')}\n`;
  text += `Products in Use: ${[
    snapshot.groups.some(g => !g.isFleet) ? 'Stream' : null,
    snapshot.hasEdge ? 'Edge' : null,
    snapshot.hasLake ? 'Lake' : null,
    snapshot.hasSearch ? 'Search' : null,
  ].filter(Boolean).join(', ')}\n\n`;

  text += `SOURCES\n${'-'.repeat(7)}\n`;
  const activeSources = snapshot.sources.filter(s => s.status === 'active').sort((a, b) => b.dailyVolumeGB - a.dailyVolumeGB);
  for (const source of activeSources.slice(0, 20)) {
    text += `• ${source.name} (${source.type}) — ${source.group} — ${formatBytes(source.dailyVolumeGB)}/day — ${source.dataCategory}\n`;
  }
  if (activeSources.length > 20) {
    text += `  ... and ${activeSources.length - 20} more\n`;
  }
  text += '\n';

  text += `DESTINATIONS\n${'-'.repeat(12)}\n`;
  const activeDests = snapshot.destinations.filter(d => d.status === 'active').sort((a, b) => b.dailyVolumeGB - a.dailyVolumeGB);
  for (const dest of activeDests) {
    text += `• ${dest.name} (${dest.type}) — ${dest.group} — ${formatBytes(dest.dailyVolumeGB)}/day${dest.pqEnabled ? ' [PQ]' : ''}\n`;
  }

  return text;
}
