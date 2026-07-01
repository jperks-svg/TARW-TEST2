import type { ArchitectureSnapshot, ValueLineItem, ValueProjection, CustomerValue } from '../types';
import { assessMaturity } from './maturity';

const DEFAULT_COST_PER_GB = 3.50;

export function calculateCustomerValue(snapshot: ArchitectureSnapshot, costPerGBPerDay: number = DEFAULT_COST_PER_GB): CustomerValue {
  const lineItems = calculateCurrentValue(snapshot, costPerGBPerDay);
  const projections = calculateProjectedValue(snapshot, costPerGBPerDay);

  const currentAnnualValue = lineItems.reduce((sum, item) => sum + item.annualValue, 0);
  const projectedAnnualValue = projections.reduce((sum, item) => sum + item.additionalAnnualValue, 0);

  return {
    costPerGBPerDay,
    currentAnnualValue,
    projectedAnnualValue,
    valueLineItems: lineItems,
    projections,
  };
}

function calculateCurrentValue(snapshot: ArchitectureSnapshot, costPerGB: number): ValueLineItem[] {
  const items: ValueLineItem[] = [];

  // Volume reduction value: difference between ingest and outgest
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
    });
  }

  // Multi-destination routing value: data replicated without re-collection
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
    });
  }

  // Edge collection value
  if (snapshot.hasEdge && snapshot.edgeNodeCount > 0) {
    const agentConsolidationSavings = snapshot.edgeNodeCount * 500 * 12;
    items.push({
      id: 'edge-consolidation',
      category: 'operational',
      title: 'Edge Agent Consolidation',
      description: `${snapshot.edgeNodeCount} Edge nodes replacing multiple legacy collection agents per endpoint.`,
      annualValue: agentConsolidationSavings,
      evidence: `${snapshot.edgeNodeCount} Edge nodes deployed, estimated $500/node/month operational savings vs. managing multiple agents`,
    });
  }

  // Lake value: cheaper retention
  if (snapshot.hasLake) {
    const lakeRetentionSavings = snapshot.totalDailyIngestGB * (costPerGB * 0.85) * 365;
    items.push({
      id: 'lake-retention',
      category: 'cost-reduction',
      title: 'Cost-Optimized Retention (Lake)',
      description: 'Full-fidelity data retained in Cribl Lake at ~85% lower cost than SIEM hot storage while remaining searchable.',
      annualValue: lakeRetentionSavings,
      evidence: `${snapshot.totalDailyIngestGB.toFixed(1)} GB/day eligible for tiered retention in Lake vs. SIEM pricing`,
    });
  }

  // Search value: reduced tool sprawl / faster investigations
  if (snapshot.hasSearch && snapshot.searchDailyAvg > 0) {
    const searchProductivityValue = snapshot.searchDailyAvg * 15 * 250;
    items.push({
      id: 'search-productivity',
      category: 'operational',
      title: 'Federated Search Productivity',
      description: `${snapshot.searchDailyAvg.toFixed(0)} searches/day across all data stores from a single interface, reducing tool-hopping.`,
      annualValue: searchProductivityValue,
      evidence: `${snapshot.searchDailyAvg.toFixed(1)} avg daily searches × estimated 15 min saved per search × 250 working days`,
    });
  }

  // Persistent queue resilience value
  const pqDestinations = snapshot.destinations.filter(d => d.pqEnabled);
  if (pqDestinations.length > 0) {
    const pqDataVolume = pqDestinations.reduce((sum, d) => sum + d.dailyVolumeGB, 0);
    const dataLossPreventionValue = pqDataVolume * costPerGB * 30;
    items.push({
      id: 'resilience-pq',
      category: 'risk-mitigation',
      title: 'Data Loss Prevention (Persistent Queues)',
      description: `${pqDestinations.length} destinations protected with persistent queues ensuring zero data loss during outages.`,
      annualValue: dataLossPreventionValue,
      evidence: `${pqDataVolume.toFixed(1)} GB/day protected across ${pqDestinations.length} destinations`,
    });
  }

  // Vendor flexibility value
  if (snapshot.uniqueDestinationTypes.length >= 2) {
    const annualDestinationSpend = snapshot.totalDailyOutgestGB * costPerGB * 365;
    const negotiationLeverage = annualDestinationSpend * 0.1;
    items.push({
      id: 'vendor-flexibility',
      category: 'flexibility',
      title: 'Vendor Negotiation Leverage',
      description: 'Ability to route data to alternative destinations provides leverage in vendor renewal negotiations.',
      annualValue: negotiationLeverage,
      evidence: `Multi-destination capability across ${snapshot.uniqueDestinationTypes.length} types provides credible migration alternative`,
    });
  }

  return items;
}

function calculateProjectedValue(snapshot: ArchitectureSnapshot, costPerGB: number): ValueProjection[] {
  const projections: ValueProjection[] = [];
  const maturity = assessMaturity(snapshot);
  const currentLevel = maturity.currentLevel;

  if (currentLevel < 2) {
    projections.push({
      id: 'proj-multi-dest',
      targetLevel: 2,
      title: 'Multi-Destination Routing',
      description: 'Route data to multiple destination types simultaneously — SIEM, object store, and analytics platforms from one collection point.',
      additionalAnnualValue: snapshot.totalDailyIngestGB * costPerGB * 0.4 * 365,
      requirement: 'Add 2+ destination types, configure object store backup destination',
    });

    projections.push({
      id: 'proj-object-store',
      targetLevel: 2,
      title: 'Object Store Replay Capability',
      description: 'Establish S3/GCS destination for full-fidelity replay — eliminates the need for expensive hot retention beyond 30 days.',
      additionalAnnualValue: snapshot.totalDailyIngestGB * costPerGB * 0.6 * 365,
      requirement: 'Configure S3 or GCS destination with replay-compatible format',
    });
  }

  if (currentLevel < 3) {
    projections.push({
      id: 'proj-lake',
      targetLevel: 3,
      title: 'Cribl Lake Adoption',
      description: 'Move long-term retention to Cribl Lake — searchable, indexed, at a fraction of SIEM cost. Extends retention from months to years.',
      additionalAnnualValue: snapshot.totalDailyIngestGB * costPerGB * 0.85 * 365,
      requirement: 'Deploy Cribl Lake, configure tiered retention policy',
    });

    projections.push({
      id: 'proj-search',
      targetLevel: 3,
      title: 'Cribl Search for Investigations',
      description: 'Federated search across Lake, S3, and live data. Analysts search from one place regardless of where data is stored.',
      additionalAnnualValue: 50 * 15 * 250,
      requirement: 'Enable Cribl Search, connect to Lake and object store datasets',
    });

    if (!snapshot.hasEdge) {
      projections.push({
        id: 'proj-edge',
        targetLevel: 3,
        title: 'Edge Collection Deployment',
        description: 'Deploy Cribl Edge to consolidate agents, filter at source, and reduce WAN bandwidth by 40-70%.',
        additionalAnnualValue: snapshot.totalDailyIngestGB * 0.5 * costPerGB * 365,
        requirement: 'Deploy Cribl Edge to endpoint fleet, consolidate collection agents',
      });
    }
  }

  if (currentLevel < 4) {
    projections.push({
      id: 'proj-composable',
      targetLevel: 4,
      title: 'Composable Telemetry Platform',
      description: 'Full self-service telemetry platform — any team onboards new data consumers in hours without central bottleneck.',
      additionalAnnualValue: snapshot.totalDailyIngestGB * costPerGB * 0.2 * 365,
      requirement: 'Full product suite, operational dashboarding, enrichment services, self-service policies',
    });

    projections.push({
      id: 'proj-enrichment',
      targetLevel: 4,
      title: 'Pipeline Enrichment Services',
      description: 'Enrich events in-flight with threat intel, asset context, and identity data — every downstream consumer benefits automatically.',
      additionalAnnualValue: snapshot.totalDailyIngestGB * 0.3 * costPerGB * 365,
      requirement: 'Implement lookup-based enrichment in pipelines, integrate threat intel feeds',
    });
  }

  return projections;
}
