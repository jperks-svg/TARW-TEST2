import type { ArchitectureSnapshot } from '../types';

// --- Per-Source Use Case Map ---

export interface SourceUseCase {
  sourceId: string;
  sourceName: string;
  sourceType: string;
  category: string;
  currentState: UseCaseState[];
  possibleStates: UseCaseState[];
}

export interface UseCaseState {
  product: 'siem' | 'lake' | 'search' | 'edge' | 'dashboards' | 'archive';
  label: string;
  useCase: string;
  status: 'active' | 'possible' | 'not-applicable';
}

const USE_CASE_TEMPLATES: Record<string, { product: UseCaseState['product']; label: string; useCase: string }[]> = {
  security: [
    { product: 'siem', label: 'Real-Time Detections', useCase: 'Correlation rules, alerting, SOC dashboards' },
    { product: 'lake', label: 'Forensic Retention', useCase: 'Full-fidelity for investigations at 1/10th SIEM cost' },
    { product: 'search', label: 'Threat Hunting', useCase: 'Ad-hoc queries across months of historical data' },
    { product: 'edge', label: 'Source-Side Filtering', useCase: 'Pre-filter noise at the edge, reduce WAN traffic' },
    { product: 'archive', label: 'Compliance Archive', useCase: 'Immutable 3-7yr retention for regulatory requirements' },
    { product: 'dashboards', label: 'Security Analytics', useCase: 'Custom dashboards on telemetry flow health & coverage' },
  ],
  observability: [
    { product: 'siem', label: 'Active Monitoring', useCase: 'Alerting on service health, latency, error rates' },
    { product: 'lake', label: 'Historical Analysis', useCase: 'Capacity planning, trend analysis, baseline building' },
    { product: 'search', label: 'Troubleshooting', useCase: 'Deep-dive across full-fidelity metrics & logs on demand' },
    { product: 'edge', label: 'Edge Collection', useCase: 'Consolidate agents, collect at source with local buffering' },
    { product: 'archive', label: 'Long-Term Trends', useCase: 'Year-over-year comparison, seasonality analysis' },
    { product: 'dashboards', label: 'Operational Intelligence', useCase: 'Pipeline health, volume anomaly detection' },
  ],
};

export function generateSourceUseCaseMap(snapshot: ArchitectureSnapshot): SourceUseCase[] {
  const activeSources = snapshot.sources.filter(s => s.status === 'active');
  const activeDestTypes = new Set(snapshot.destinations.filter(d => d.status === 'active').map(d => d.type));

  const hasSIEM = activeDestTypes.has('splunk') || activeDestTypes.has('splunk_lb') || activeDestTypes.has('splunk_hec') ||
    activeDestTypes.has('elastic') || activeDestTypes.has('google_chronicle') || activeDestTypes.has('microsoft_sentinel');
  const hasLake = snapshot.hasLake;
  const hasSearch = snapshot.hasSearch;
  const hasEdge = snapshot.hasEdge;

  return activeSources.map(source => {
    const category = source.dataCategory === 'security' || source.dataCategory === 'both' ? 'security' : 'observability';
    const templates = USE_CASE_TEMPLATES[category];

    const currentState: UseCaseState[] = [];
    const possibleStates: UseCaseState[] = [];

    for (const t of templates) {
      const isActive =
        (t.product === 'siem' && hasSIEM) ||
        (t.product === 'lake' && hasLake) ||
        (t.product === 'search' && hasSearch) ||
        (t.product === 'edge' && hasEdge) ||
        (t.product === 'dashboards' && false) ||
        (t.product === 'archive' && activeDestTypes.has('s3'));

      if (isActive) {
        currentState.push({ ...t, status: 'active' });
      } else {
        possibleStates.push({ ...t, status: 'possible' });
      }
    }

    return {
      sourceId: source.id,
      sourceName: source.name,
      sourceType: source.type,
      category,
      currentState,
      possibleStates,
    };
  });
}

// --- Cost/Value Model ---

export interface CostModel {
  currentDailyGB: number;
  currentAnnualEstimate: number;
  proposedSIEMDailyGB: number;
  proposedLakeDailyGB: number;
  proposedArchiveDailyGB: number;
  proposedAnnualEstimate: number;
  annualSavings: number;
  savingsPercent: number;
  assumptions: string[];
  perSourceBreakdown: SourceCostBreakdown[];
}

export interface SourceCostBreakdown {
  sourceName: string;
  sourceType: string;
  dailyGB: number;
  siemPercent: number;
  lakePercent: number;
  archivePercent: number;
  rationale: string;
}

const COST_PER_GB_DAY = {
  siem: 3.50,
  lake: 0.35,
  archive: 0.05,
};

export function generateCostModel(snapshot: ArchitectureSnapshot): CostModel {
  const activeSources = snapshot.sources.filter(s => s.status === 'active' && s.dailyVolumeGB > 0);
  const currentDailyGB = snapshot.totalDailyIngestGB;
  const currentAnnualEstimate = currentDailyGB * COST_PER_GB_DAY.siem * 365;

  const perSourceBreakdown: SourceCostBreakdown[] = activeSources.map(source => {
    const isSecurity = source.dataCategory === 'security' || source.dataCategory === 'both';

    let siemPercent: number;
    let lakePercent: number;
    let archivePercent: number;
    let rationale: string;

    if (isSecurity) {
      siemPercent = 40;
      lakePercent = 40;
      archivePercent = 20;
      rationale = 'Security: 40% detection-critical to SIEM, 40% searchable in Lake, 20% compliance archive';
    } else {
      siemPercent = 20;
      lakePercent = 50;
      archivePercent = 30;
      rationale = 'Observability: 20% active alerting to SIEM, 50% troubleshooting in Lake, 30% long-term trends';
    }

    return {
      sourceName: source.name,
      sourceType: source.type,
      dailyGB: source.dailyVolumeGB,
      siemPercent,
      lakePercent,
      archivePercent,
      rationale,
    };
  });

  let proposedSIEMDailyGB = 0;
  let proposedLakeDailyGB = 0;
  let proposedArchiveDailyGB = 0;

  for (const breakdown of perSourceBreakdown) {
    proposedSIEMDailyGB += breakdown.dailyGB * (breakdown.siemPercent / 100);
    proposedLakeDailyGB += breakdown.dailyGB * (breakdown.lakePercent / 100);
    proposedArchiveDailyGB += breakdown.dailyGB * (breakdown.archivePercent / 100);
  }

  // If no volume data from sources, use total ingest as fallback with default 30/50/20 split
  if (perSourceBreakdown.length === 0 && currentDailyGB > 0) {
    proposedSIEMDailyGB = currentDailyGB * 0.3;
    proposedLakeDailyGB = currentDailyGB * 0.5;
    proposedArchiveDailyGB = currentDailyGB * 0.2;
  }

  const proposedAnnualEstimate =
    (proposedSIEMDailyGB * COST_PER_GB_DAY.siem * 365) +
    (proposedLakeDailyGB * COST_PER_GB_DAY.lake * 365) +
    (proposedArchiveDailyGB * COST_PER_GB_DAY.archive * 365);

  const annualSavings = currentAnnualEstimate - proposedAnnualEstimate;
  const savingsPercent = currentAnnualEstimate > 0 ? (annualSavings / currentAnnualEstimate) * 100 : 0;

  return {
    currentDailyGB,
    currentAnnualEstimate,
    proposedSIEMDailyGB,
    proposedLakeDailyGB,
    proposedArchiveDailyGB,
    proposedAnnualEstimate,
    annualSavings,
    savingsPercent,
    assumptions: [
      `SIEM ingest cost: $${COST_PER_GB_DAY.siem}/GB/day (industry average, adjust per customer contract)`,
      `Lake retention cost: $${COST_PER_GB_DAY.lake}/GB/day (Cribl Lake estimate)`,
      `Archive cost: $${COST_PER_GB_DAY.archive}/GB/day (S3/GCS cold tier)`,
      'Security sources: 40% to SIEM, 40% to Lake, 20% to archive',
      'Observability sources: 20% to SIEM, 50% to Lake, 30% to archive',
      'Actual savings depend on customer-specific contracts and data profiles',
    ],
    perSourceBreakdown,
  };
}

// --- Quick Wins ---

export interface QuickWin {
  id: string;
  title: string;
  description: string;
  effort: 'minutes' | 'hours' | 'days';
  impact: 'high' | 'medium' | 'low';
  category: 'routing' | 'lake' | 'search' | 'edge' | 'optimization';
  action: string;
  evidence: string;
}

export function identifyQuickWins(snapshot: ArchitectureSnapshot): QuickWin[] {
  const wins: QuickWin[] = [];

  // Dormant Lake destinations that just need a route
  const dormantLakeOutputs = snapshot.destinations.filter(d =>
    d.status === 'dormant' && (d.type === 'cribl_lake' || d.type === 'lake')
  );
  if (dormantLakeOutputs.length > 0) {
    wins.push({
      id: 'dormant-lake',
      title: 'Lake Destinations Configured but No Data Flowing',
      description: `${dormantLakeOutputs.length} Lake destination(s) are configured but dormant. You're one route or connection away from retaining full-fidelity data.`,
      effort: 'minutes',
      impact: 'high',
      category: 'lake',
      action: 'Add a route or clone to an existing route that sends data to the dormant Lake destination.',
      evidence: `Dormant Lake outputs: ${dormantLakeOutputs.map(d => d.name).join(', ')}`,
    });
  }

  // Active sources only going to one destination (could fan out)
  const activeSourceCount = snapshot.sourceCount;
  const activeDestCount = snapshot.destinationCount;
  if (activeSourceCount > 0 && activeDestCount === 1) {
    wins.push({
      id: 'single-dest-fanout',
      title: 'Single Destination — Add a Fan-Out',
      description: 'All active data flows to a single destination. Adding a clone or second route to Lake or S3 takes minutes and immediately gives you a full-fidelity backup.',
      effort: 'minutes',
      impact: 'high',
      category: 'routing',
      action: 'Clone an existing route to also send to a Lake or S3 destination.',
      evidence: `${activeSourceCount} active source(s) routing to only ${activeDestCount} destination.`,
    });
  }

  // Dormant object store outputs
  const dormantS3 = snapshot.destinations.filter(d =>
    d.status === 'dormant' && ['s3', 'gcs', 'azure_blob'].includes(d.type)
  );
  if (dormantS3.length > 0) {
    wins.push({
      id: 'dormant-object-store',
      title: 'Object Store Destinations Ready for Replay',
      description: `${dormantS3.length} object store destination(s) are configured but idle. Enabling these gives you data replay capability for re-investigation.`,
      effort: 'minutes',
      impact: 'medium',
      category: 'routing',
      action: 'Route high-volume or compliance data to the existing S3/GCS destination for long-term replay.',
      evidence: `Dormant: ${dormantS3.map(d => `${d.name} (${d.type})`).join(', ')}`,
    });
  }

  // Search datasets exist but low usage
  if (snapshot.hasSearch && snapshot.searchDailyAvg < 10) {
    wins.push({
      id: 'search-underused',
      title: 'Search Configured but Underutilized',
      description: `Search is configured with ${snapshot.searchDatasets.length} dataset(s) but averaging only ${snapshot.searchDailyAvg.toFixed(1)} searches/day. Training the team on search workflows can unlock investigation speed.`,
      effort: 'hours',
      impact: 'medium',
      category: 'search',
      action: 'Schedule a Search workshop — build saved searches for top investigation patterns and train the SOC/ops team.',
      evidence: `${snapshot.searchDailyAvg.toFixed(1)} searches/day across ${snapshot.searchDatasets.length} datasets.`,
    });
  }

  // Active destinations without PQ
  const activeNoPQ = snapshot.destinations.filter(d => d.status === 'active' && !d.pqEnabled);
  if (activeNoPQ.length > 0) {
    wins.push({
      id: 'enable-pq',
      title: 'Enable Persistent Queues on Active Destinations',
      description: `${activeNoPQ.length} active destination(s) lack persistent queuing. Enabling PQ protects against data loss during destination outages — a one-click config change.`,
      effort: 'minutes',
      impact: 'medium',
      category: 'optimization',
      action: 'Enable PQ on each active destination in the output settings.',
      evidence: `Without PQ: ${activeNoPQ.map(d => d.name).join(', ')}`,
    });
  }

  // Dormant sources that could be activated
  const dormantDatagens = snapshot.sources.filter(s =>
    s.status === 'dormant' && s.type === 'datagen'
  );
  if (dormantDatagens.length > 0) {
    wins.push({
      id: 'dormant-datagen',
      title: 'Dormant Datagen Sources Available',
      description: `${dormantDatagens.length} datagen source(s) are configured but not generating. These can be used for testing pipelines and validating destinations without real data risk.`,
      effort: 'minutes',
      impact: 'low',
      category: 'optimization',
      action: 'Enable dormant datagen sources to validate pipeline and destination configurations.',
      evidence: `Dormant datagens: ${dormantDatagens.map(d => d.name).join(', ')}`,
    });
  }

  // Edge configured but not at scale
  const edgeGroups = snapshot.groups.filter(g => g.isFleet);
  if (edgeGroups.length > 0 && !snapshot.hasEdge) {
    wins.push({
      id: 'edge-scale-up',
      title: 'Edge Fleet Exists — Scale Deployment',
      description: `You have ${edgeGroups.length} Edge fleet(s) configured with ${snapshot.edgeNodeCount} active node(s). Expanding Edge deployment to high-volume source sites would reduce WAN bandwidth and improve resilience.`,
      effort: 'days',
      impact: 'high',
      category: 'edge',
      action: 'Identify top 3-5 bandwidth-consuming sites and deploy Edge nodes for source-side processing.',
      evidence: `${edgeGroups.length} fleet(s), ${snapshot.edgeNodeCount} active nodes (scale target: 100+).`,
    });
  }

  // Lake is active but no search datasets pointing to it
  if (snapshot.hasLake && !snapshot.hasSearch) {
    wins.push({
      id: 'lake-no-search',
      title: 'Lake Has Data but Search Not Connected',
      description: 'Data is flowing to Lake but Cribl Search isn\'t configured to query it. Connecting Search to Lake enables on-demand investigations without SIEM re-ingestion.',
      effort: 'hours',
      impact: 'high',
      category: 'search',
      action: 'Create a Search dataset pointing to your Lake storage and build 2-3 saved searches for common investigation patterns.',
      evidence: 'Lake destinations are active; Search has no datasets or saved searches.',
    });
  }

  return wins.sort((a, b) => {
    const impactOrder = { high: 0, medium: 1, low: 2 };
    const effortOrder = { minutes: 0, hours: 1, days: 2 };
    return (impactOrder[a.impact] - impactOrder[b.impact]) || (effortOrder[a.effort] - effortOrder[b.effort]);
  });
}
