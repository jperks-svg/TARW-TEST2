import type { ArchitectureSnapshot, ValueLineItem, ValueProjection, CustomerValue, QualitativeValue } from '../types';
import type { QuickWin } from './opportunities';
import { assessMaturity } from './maturity';

const DEFAULT_COST_PER_GB = 3.50;

export function calculateCustomerValue(snapshot: ArchitectureSnapshot, costPerGBPerDay: number = DEFAULT_COST_PER_GB): CustomerValue {
  const lineItems = calculateCurrentValue(snapshot, costPerGBPerDay);
  const projections = calculateProjectedValue(snapshot, costPerGBPerDay);
  const qualitativeValues = calculateQualitativeValue(snapshot);

  const currentAnnualValue = lineItems.reduce((sum, item) => sum + item.annualValue, 0);
  const projectedAnnualValue = projections.reduce((sum, item) => sum + item.additionalAnnualValue, 0);

  return {
    costPerGBPerDay,
    currentAnnualValue,
    projectedAnnualValue,
    valueLineItems: lineItems,
    projections,
    qualitativeValues,
  };
}

function calculateCurrentValue(snapshot: ArchitectureSnapshot, costPerGB: number): ValueLineItem[] {
  const items: ValueLineItem[] = [];

  const dailyReductionGB = snapshot.totalDailyIngestGB - snapshot.totalDailyOutgestGB;
  if (dailyReductionGB > 0) {
    const annualSavings = dailyReductionGB * costPerGB * 365;
    items.push({
      id: 'volume-reduction',
      category: 'cost-reduction',
      title: 'Data Volume Reduction',
      description: `Reducing ${dailyReductionGB.toFixed(1)} GB/day through filtering, sampling, and transformation before delivery to destinations.`,
      annualValue: annualSavings,
      evidence: `Ingest: ${snapshot.totalDailyIngestGB.toFixed(1)} GB/day → Outgest: ${snapshot.totalDailyOutgestGB.toFixed(1)} GB/day (${((dailyReductionGB / snapshot.totalDailyIngestGB) * 100).toFixed(0)}% reduction)`,
      formula: {
        expression: 'Daily Reduction × Cost/GB × 365 days',
        variables: [
          { label: 'Daily Reduction', value: `${dailyReductionGB.toFixed(1)} GB` },
          { label: 'Cost/GB/day', value: `$${costPerGB.toFixed(2)}` },
          { label: 'Days/year', value: '365' },
        ],
        result: `$${annualSavings.toLocaleString(undefined, { maximumFractionDigits: 0 })}/year`,
      },
    });
  }

  if (snapshot.uniqueDestinationTypes.length > 1) {
    const replicationFactor = snapshot.uniqueDestinationTypes.length - 1;
    const avoidedCollectionCost = snapshot.totalDailyIngestGB * 0.5 * replicationFactor * 365;
    items.push({
      id: 'multi-destination',
      category: 'flexibility',
      title: 'Multi-Destination Routing',
      description: `Routing data to ${snapshot.uniqueDestinationTypes.length} destination types from a single collection point, avoiding duplicate collection infrastructure.`,
      annualValue: avoidedCollectionCost,
      evidence: `${snapshot.destinationCount} destinations across ${snapshot.uniqueDestinationTypes.length} types (${snapshot.uniqueDestinationTypes.join(', ')})`,
      formula: {
        expression: 'Daily Ingest × 50% avoided duplication × (Dest Types − 1) × 365',
        variables: [
          { label: 'Daily Ingest', value: `${snapshot.totalDailyIngestGB.toFixed(1)} GB` },
          { label: 'Duplication factor', value: '50% (estimated agent/infra cost per extra dest)' },
          { label: 'Additional dest types', value: `${replicationFactor}` },
          { label: 'Days/year', value: '365' },
        ],
        result: `$${avoidedCollectionCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}/year`,
      },
    });
  }

  if (snapshot.hasEdge && snapshot.edgeNodeCount > 0) {
    const monthlySavingsPerNode = 500;
    const agentConsolidationSavings = snapshot.edgeNodeCount * monthlySavingsPerNode * 12;
    items.push({
      id: 'edge-consolidation',
      category: 'operational',
      title: 'Edge Agent Consolidation',
      description: `${snapshot.edgeNodeCount} Edge nodes replacing multiple legacy collection agents per endpoint.`,
      annualValue: agentConsolidationSavings,
      evidence: `${snapshot.edgeNodeCount} Edge nodes deployed, estimated $${monthlySavingsPerNode}/node/month operational savings vs. managing multiple agents`,
      formula: {
        expression: 'Edge Nodes × Monthly Savings/Node × 12 months',
        variables: [
          { label: 'Edge Nodes', value: `${snapshot.edgeNodeCount}` },
          { label: 'Monthly savings/node', value: `$${monthlySavingsPerNode} (agent licensing + management overhead)` },
          { label: 'Months/year', value: '12' },
        ],
        result: `$${agentConsolidationSavings.toLocaleString(undefined, { maximumFractionDigits: 0 })}/year`,
      },
    });
  }

  if (snapshot.hasLake) {
    const savingsRate = 0.85;
    const lakeRetentionSavings = snapshot.totalDailyIngestGB * (costPerGB * savingsRate) * 365;
    items.push({
      id: 'lake-retention',
      category: 'cost-reduction',
      title: 'Cost-Optimized Retention (Lake)',
      description: 'Full-fidelity data retained in Cribl Lake at ~85% lower cost than SIEM hot storage while remaining searchable.',
      annualValue: lakeRetentionSavings,
      evidence: `${snapshot.totalDailyIngestGB.toFixed(1)} GB/day eligible for tiered retention in Lake vs. SIEM pricing`,
      formula: {
        expression: 'Daily Ingest × Cost/GB × 85% savings rate × 365',
        variables: [
          { label: 'Daily Ingest', value: `${snapshot.totalDailyIngestGB.toFixed(1)} GB` },
          { label: 'Cost/GB/day', value: `$${costPerGB.toFixed(2)}` },
          { label: 'Savings rate', value: '85% (Lake vs. SIEM hot storage)' },
          { label: 'Days/year', value: '365' },
        ],
        result: `$${lakeRetentionSavings.toLocaleString(undefined, { maximumFractionDigits: 0 })}/year`,
      },
    });
  }

  if (snapshot.hasSearch && snapshot.searchDailyAvg > 0) {
    const minutesSaved = 15;
    const workingDays = 250;
    const searchProductivityValue = snapshot.searchDailyAvg * minutesSaved * workingDays;
    items.push({
      id: 'search-productivity',
      category: 'operational',
      title: 'Federated Search Productivity',
      description: `${snapshot.searchDailyAvg.toFixed(0)} searches/day across all data stores from a single interface, reducing tool-hopping.`,
      annualValue: searchProductivityValue,
      evidence: `${snapshot.searchDailyAvg.toFixed(1)} avg daily searches × ${minutesSaved} min saved per search × ${workingDays} working days`,
      formula: {
        expression: 'Daily Searches × Minutes Saved/Search × Working Days/Year',
        variables: [
          { label: 'Daily Searches', value: `${snapshot.searchDailyAvg.toFixed(1)}` },
          { label: 'Minutes saved/search', value: `${minutesSaved} min (no tool-hopping between SIEM, S3, Lake)` },
          { label: 'Working days/year', value: `${workingDays}` },
        ],
        result: `${(snapshot.searchDailyAvg * minutesSaved * workingDays / 60).toFixed(0)} engineer-hours/year saved`,
      },
    });
  }

  const pqDestinations = snapshot.destinations.filter(d => d.pqEnabled);
  if (pqDestinations.length > 0) {
    const pqDataVolume = pqDestinations.reduce((sum, d) => sum + d.dailyVolumeGB, 0);
    const outageAssumedDays = 30;
    const dataLossPreventionValue = pqDataVolume * costPerGB * outageAssumedDays;
    items.push({
      id: 'resilience-pq',
      category: 'risk-mitigation',
      title: 'Data Loss Prevention (Persistent Queues)',
      description: `${pqDestinations.length} destinations protected with persistent queues ensuring zero data loss during outages.`,
      annualValue: dataLossPreventionValue,
      evidence: `${pqDataVolume.toFixed(1)} GB/day protected across ${pqDestinations.length} destinations`,
      formula: {
        expression: 'Protected Volume × Cost/GB × Assumed Outage Days/Year',
        variables: [
          { label: 'Protected daily volume', value: `${pqDataVolume.toFixed(1)} GB/day` },
          { label: 'Cost/GB/day', value: `$${costPerGB.toFixed(2)}` },
          { label: 'Assumed outage days/year', value: `${outageAssumedDays} (industry avg for cumulative destination downtime)` },
        ],
        result: `$${dataLossPreventionValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}/year in avoided data loss`,
      },
    });
  }

  if (snapshot.uniqueDestinationTypes.length >= 2) {
    const annualDestinationSpend = snapshot.totalDailyOutgestGB * costPerGB * 365;
    const leveragePercent = 10;
    const negotiationLeverage = annualDestinationSpend * (leveragePercent / 100);
    items.push({
      id: 'vendor-flexibility',
      category: 'flexibility',
      title: 'Vendor Negotiation Leverage',
      description: 'Ability to route data to alternative destinations provides leverage in vendor renewal negotiations.',
      annualValue: negotiationLeverage,
      evidence: `Multi-destination capability across ${snapshot.uniqueDestinationTypes.length} types provides credible migration alternative`,
      formula: {
        expression: 'Annual Destination Spend × Leverage %',
        variables: [
          { label: 'Annual destination spend', value: `$${annualDestinationSpend.toLocaleString(undefined, { maximumFractionDigits: 0 })} (${snapshot.totalDailyOutgestGB.toFixed(1)} GB/day × $${costPerGB.toFixed(2)} × 365)` },
          { label: 'Leverage %', value: `${leveragePercent}% (conservative: credible alternative reduces renewal premium)` },
        ],
        result: `$${negotiationLeverage.toLocaleString(undefined, { maximumFractionDigits: 0 })}/year estimated renewal savings`,
      },
    });
  }

  return items;
}

function calculateQualitativeValue(snapshot: ArchitectureSnapshot): QualitativeValue[] {
  const items: QualitativeValue[] = [];

  if (snapshot.hasSearch && snapshot.searchDailyAvg > 0) {
    items.push({
      id: 'qual-mttr',
      category: 'time-savings',
      title: 'Reduced Mean Time to Resolution',
      description: 'Federated search eliminates tool-hopping between SIEM, object store, and Lake during investigations. Analysts query one interface instead of 3-4.',
      metric: `~${(snapshot.searchDailyAvg * 15).toFixed(0)} min/day saved across the team`,
      evidence: `${snapshot.searchDailyAvg.toFixed(0)} searches/day × ~15 min saved per search (no context-switching between tools)`,
    });
  }

  if (snapshot.uniqueDestinationTypes.length >= 2) {
    items.push({
      id: 'qual-vendor-independence',
      category: 'agility',
      title: 'Vendor Independence',
      description: 'Data is collected once and routed anywhere. Switching or adding a SIEM, analytics platform, or security tool is a routing change — not a re-architecture.',
      metric: `${snapshot.uniqueDestinationTypes.length} destination types active — migration path available for any one of them`,
      evidence: `Currently routing to: ${snapshot.uniqueDestinationTypes.join(', ')}`,
    });
  }

  if (snapshot.destinationCount > snapshot.uniqueDestinationTypes.length) {
    items.push({
      id: 'qual-onboarding',
      category: 'time-savings',
      title: 'Faster Tool Onboarding',
      description: 'New destinations receive data in minutes via route addition. No new agents, no source-side changes, no collection redesign.',
      metric: 'Minutes to onboard a new tool vs. weeks for traditional agent-based collection',
      evidence: `${snapshot.destinationCount} destinations already served from existing collection infrastructure`,
    });
  }

  const pqDestinations = snapshot.destinations.filter(d => d.pqEnabled);
  if (pqDestinations.length > 0) {
    items.push({
      id: 'qual-zero-loss',
      category: 'risk-posture',
      title: 'Zero Data Loss Guarantee',
      description: 'Persistent queues buffer data during destination outages. When the destination recovers, queued data is delivered automatically — no gaps in coverage.',
      metric: `${pqDestinations.length} destination(s) with guaranteed delivery`,
      evidence: `Protected destinations: ${pqDestinations.map(d => d.name).join(', ')}`,
    });
  }

  if (snapshot.hasLake) {
    items.push({
      id: 'qual-retention-freedom',
      category: 'risk-posture',
      title: 'Extended Retention Without SIEM Cost',
      description: 'Full-fidelity data retained beyond SIEM hot window. Investigations, audits, and compliance queries work against months-to-years of data that would otherwise be aged out.',
      metric: 'Retention extended from days/weeks (SIEM limit) to months/years (Lake)',
      evidence: 'Cribl Lake active — data searchable without re-ingestion',
    });
  }

  if (snapshot.hasEdge && snapshot.edgeNodeCount > 0) {
    items.push({
      id: 'qual-edge-visibility',
      category: 'visibility',
      title: 'Source-Side Visibility & Control',
      description: 'Edge processing provides visibility into data before it crosses the WAN. Filter noise at source, enrich locally, and ensure only relevant data consumes bandwidth.',
      metric: `${snapshot.edgeNodeCount} edge points of presence providing source-side control`,
      evidence: `${snapshot.edgeNodeCount} Edge nodes deployed across the environment`,
    });
  }

  if (snapshot.flows.length > 5) {
    items.push({
      id: 'qual-observability-pipeline',
      category: 'visibility',
      title: 'Pipeline as Observability Layer',
      description: 'Data flows through a central observable layer. You can see what data exists, where it goes, and how it transforms — something invisible in direct agent-to-destination architectures.',
      metric: `${snapshot.flows.length} data flows visible and manageable from one control plane`,
      evidence: `${snapshot.sourceCount} sources → ${snapshot.flows.length} flows → ${snapshot.destinationCount} destinations`,
    });
  }

  const dormantSources = snapshot.dormantSourceCount;
  const dormantDests = snapshot.dormantDestinationCount;
  if (dormantSources > 0 || dormantDests > 0) {
    items.push({
      id: 'qual-dormant-awareness',
      category: 'visibility',
      title: 'Infrastructure Awareness',
      description: 'Cribl surfaces dormant or misconfigured infrastructure that would otherwise go unnoticed — configured sources not sending data, destinations with no active routes.',
      metric: `${dormantSources} dormant source(s), ${dormantDests} dormant destination(s) identified`,
      evidence: 'Dormant resources represent blind spots in traditional architectures — Cribl makes them visible',
    });
  }

  return items;
}

function calculateProjectedValue(snapshot: ArchitectureSnapshot, costPerGB: number): ValueProjection[] {
  const projections: ValueProjection[] = [];
  const maturity = assessMaturity(snapshot);
  const currentLevel = maturity.currentLevel;

  if (currentLevel < 2) {
    const multiDestValue = snapshot.totalDailyIngestGB * costPerGB * 0.4 * 365;
    projections.push({
      id: 'proj-multi-dest',
      targetLevel: 2,
      title: 'Multi-Destination Routing',
      description: 'Route data to multiple destination types simultaneously — SIEM, object store, and analytics platforms from one collection point.',
      additionalAnnualValue: multiDestValue,
      requirement: 'Add 2+ destination types, configure object store backup destination',
      formula: {
        expression: 'Daily Ingest × Cost/GB × 40% (avoided duplicate collection) × 365',
        variables: [
          { label: 'Daily Ingest', value: `${snapshot.totalDailyIngestGB.toFixed(1)} GB` },
          { label: 'Cost/GB/day', value: `$${costPerGB.toFixed(2)}` },
          { label: 'Avoided duplication', value: '40%' },
        ],
        result: `$${multiDestValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}/year`,
      },
    });

    const replayValue = snapshot.totalDailyIngestGB * costPerGB * 0.6 * 365;
    projections.push({
      id: 'proj-object-store',
      targetLevel: 2,
      title: 'Object Store Replay Capability',
      description: 'Establish S3/GCS destination for full-fidelity replay — eliminates the need for expensive hot retention beyond 30 days.',
      additionalAnnualValue: replayValue,
      requirement: 'Configure S3 or GCS destination with replay-compatible format',
      formula: {
        expression: 'Daily Ingest × Cost/GB × 60% (hot retention avoided) × 365',
        variables: [
          { label: 'Daily Ingest', value: `${snapshot.totalDailyIngestGB.toFixed(1)} GB` },
          { label: 'Cost/GB/day', value: `$${costPerGB.toFixed(2)}` },
          { label: 'Hot retention avoided', value: '60% (data moved to cold replay vs. SIEM)' },
        ],
        result: `$${replayValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}/year`,
      },
    });
  }

  if (currentLevel < 3) {
    const lakeValue = snapshot.totalDailyIngestGB * costPerGB * 0.85 * 365;
    projections.push({
      id: 'proj-lake',
      targetLevel: 3,
      title: 'Cribl Lake Adoption',
      description: 'Move long-term retention to Cribl Lake — searchable, indexed, at a fraction of SIEM cost. Extends retention from months to years.',
      additionalAnnualValue: lakeValue,
      requirement: 'Deploy Cribl Lake, configure tiered retention policy',
      formula: {
        expression: 'Daily Ingest × Cost/GB × 85% savings × 365',
        variables: [
          { label: 'Daily Ingest', value: `${snapshot.totalDailyIngestGB.toFixed(1)} GB` },
          { label: 'Cost/GB/day', value: `$${costPerGB.toFixed(2)}` },
          { label: 'Savings vs. SIEM', value: '85% (Lake pricing vs. hot SIEM pricing)' },
        ],
        result: `$${lakeValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}/year`,
      },
    });

    const searchValue = 50 * 15 * 250;
    projections.push({
      id: 'proj-search',
      targetLevel: 3,
      title: 'Cribl Search for Investigations',
      description: 'Federated search across Lake, S3, and live data. Analysts search from one place regardless of where data is stored.',
      additionalAnnualValue: searchValue,
      requirement: 'Enable Cribl Search, connect to Lake and object store datasets',
      formula: {
        expression: 'Est. Searches/Day × Minutes Saved × Working Days',
        variables: [
          { label: 'Estimated searches/day', value: '50 (team of 5-10 analysts)' },
          { label: 'Minutes saved/search', value: '15 min (no tool-hopping)' },
          { label: 'Working days/year', value: '250' },
        ],
        result: `${(searchValue / 60).toFixed(0)} engineer-hours/year saved (3,125 hrs)`,
      },
    });

    if (!snapshot.hasEdge) {
      const edgeValue = snapshot.totalDailyIngestGB * 0.5 * costPerGB * 365;
      projections.push({
        id: 'proj-edge',
        targetLevel: 3,
        title: 'Edge Collection Deployment',
        description: 'Deploy Cribl Edge to consolidate agents, filter at source, and reduce WAN bandwidth by 40-70%.',
        additionalAnnualValue: edgeValue,
        requirement: 'Deploy Cribl Edge to endpoint fleet, consolidate collection agents',
        formula: {
          expression: 'Daily Ingest × 50% WAN reduction × Cost/GB × 365',
          variables: [
            { label: 'Daily Ingest', value: `${snapshot.totalDailyIngestGB.toFixed(1)} GB` },
            { label: 'WAN reduction', value: '50% (conservative; typical 40-70%)' },
            { label: 'Cost/GB/day', value: `$${costPerGB.toFixed(2)}` },
          ],
          result: `$${edgeValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}/year`,
        },
      });
    }
  }

  if (currentLevel < 4) {
    const composableValue = snapshot.totalDailyIngestGB * costPerGB * 0.2 * 365;
    projections.push({
      id: 'proj-composable',
      targetLevel: 4,
      title: 'Composable Telemetry Platform',
      description: 'Full self-service telemetry platform — any team onboards new data consumers in hours without central bottleneck.',
      additionalAnnualValue: composableValue,
      requirement: 'Full product suite, operational dashboarding, enrichment services, self-service policies',
      formula: {
        expression: 'Daily Ingest × Cost/GB × 20% (operational efficiency gain) × 365',
        variables: [
          { label: 'Daily Ingest', value: `${snapshot.totalDailyIngestGB.toFixed(1)} GB` },
          { label: 'Cost/GB/day', value: `$${costPerGB.toFixed(2)}` },
          { label: 'Efficiency gain', value: '20% (self-service reduces central team bottleneck)' },
        ],
        result: `$${composableValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}/year`,
      },
    });

    const enrichmentValue = snapshot.totalDailyIngestGB * 0.3 * costPerGB * 365;
    projections.push({
      id: 'proj-enrichment',
      targetLevel: 4,
      title: 'Pipeline Enrichment Services',
      description: 'Enrich events in-flight with threat intel, asset context, and identity data — every downstream consumer benefits automatically.',
      additionalAnnualValue: enrichmentValue,
      requirement: 'Implement lookup-based enrichment in pipelines, integrate threat intel feeds',
      formula: {
        expression: 'Daily Ingest × 30% (enrichment value multiplier) × Cost/GB × 365',
        variables: [
          { label: 'Daily Ingest', value: `${snapshot.totalDailyIngestGB.toFixed(1)} GB` },
          { label: 'Enrichment multiplier', value: '30% (enriched events reduce downstream investigation time)' },
          { label: 'Cost/GB/day', value: `$${costPerGB.toFixed(2)}` },
        ],
        result: `$${enrichmentValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}/year`,
      },
    });
  }

  return projections;
}

export function estimateQuickWinValue(win: QuickWin, snapshot: ArchitectureSnapshot, costPerGB: number): { amount: number; formula: string } {
  switch (win.id) {
    case 'dormant-lake':
      return {
        amount: snapshot.totalDailyIngestGB * costPerGB * 0.85 * 365,
        formula: `${snapshot.totalDailyIngestGB.toFixed(1)} GB/day × $${costPerGB.toFixed(2)}/GB × 85% savings × 365 days`,
      };
    case 'single-dest-fanout':
      return {
        amount: snapshot.totalDailyIngestGB * costPerGB * 0.4 * 365,
        formula: `${snapshot.totalDailyIngestGB.toFixed(1)} GB/day × $${costPerGB.toFixed(2)}/GB × 40% duplication avoided × 365 days`,
      };
    case 'dormant-object-store':
      return {
        amount: snapshot.totalDailyIngestGB * costPerGB * 0.6 * 365,
        formula: `${snapshot.totalDailyIngestGB.toFixed(1)} GB/day × $${costPerGB.toFixed(2)}/GB × 60% hot retention avoided × 365 days`,
      };
    case 'search-underused':
      return {
        amount: 0,
        formula: '50 searches/day × 15 min saved/search × 250 days = 3,125 engineer-hours/year',
      };
    case 'enable-pq': {
      const unprotectedVolume = snapshot.destinations
        .filter(d => d.status === 'active' && !d.pqEnabled)
        .reduce((sum, d) => sum + d.dailyVolumeGB, 0);
      return {
        amount: unprotectedVolume * costPerGB * 30,
        formula: `${unprotectedVolume.toFixed(1)} GB/day unprotected × $${costPerGB.toFixed(2)}/GB × 30 outage-days/year`,
      };
    }
    case 'edge-scale-up':
      return {
        amount: snapshot.totalDailyIngestGB * 0.5 * costPerGB * 365,
        formula: `${snapshot.totalDailyIngestGB.toFixed(1)} GB/day × 50% WAN reduction × $${costPerGB.toFixed(2)}/GB × 365 days`,
      };
    case 'lake-no-search':
      return {
        amount: 0,
        formula: '50 searches/day × 15 min saved/search × 250 days = 3,125 engineer-hours/year',
      };
    case 'dormant-datagen':
      return {
        amount: 0,
        formula: 'Qualitative: reduces risk of deploying untested pipeline changes to production',
      };
    default:
      return { amount: 0, formula: '' };
  }
}

export function estimateSourceAnnualCost(dailyVolumeGB: number, costPerGB: number): number {
  return dailyVolumeGB * costPerGB * 365;
}
