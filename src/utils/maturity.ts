import type { ArchitectureSnapshot } from '../types';

export interface MaturityLevel {
  level: number;
  label: string;
  title: string;
  description: string;
  characteristics: string[];
  capabilities: string[];
}

export const MATURITY_LEVELS: MaturityLevel[] = [
  {
    level: 0,
    label: 'L0',
    title: 'Prospect',
    description: 'Pre-deployment or early onboarding. No active telemetry routing through Cribl yet.',
    characteristics: [
      'Prospect or customer expansion',
      'Onboarding in progress',
      'No active data flows',
    ],
    capabilities: [],
  },
  {
    level: 1,
    label: 'L1',
    title: 'Control Data in Motion',
    description: 'Single use case deployed — typically tool migration, cost control, or cost reduction. Simple, non-strategic application of Cribl products.',
    characteristics: [
      'Single primary use case (migration, cost control, or reduction)',
      'One or two destinations',
      'Basic pipeline usage (passthrough or simple transforms)',
      'Limited to Stream or Edge, not both',
    ],
    capabilities: [
      'Data routing between source and destination',
      'Basic field manipulation and filtering',
      'Simple cost reduction through volume management',
    ],
  },
  {
    level: 2,
    label: 'L2',
    title: 'Establish Flexible Telemetry Infrastructure',
    description: 'Expanding control of data with multiple sources and destinations. Beginning to see the strategic value of choice, flexibility, and control.',
    characteristics: [
      'Multiple sources and destinations configured',
      'Using cheap storage (S3, GCS) as a destination',
      'Data routing to 2+ destination types',
      'Replay capability established',
      'Multiple worker groups or beginning Edge deployment',
    ],
    capabilities: [
      'Multi-destination routing',
      'Cost-optimized storage tiers',
      'Data replay from object store',
      'Routing decisions based on data content',
      'Beginning to decouple collection from analysis',
    ],
  },
  {
    level: 3,
    label: 'L3',
    title: 'Optimize & Analyze Full Fidelity Data',
    description: 'Strategically using data in cost-effective storage. Fully leveraging the multi-product portfolio including Lake and Search for investigations.',
    characteristics: [
      'Cribl Lake actively used for retention',
      'Cribl Search used for investigations and hunting',
      'Data tiering strategy implemented (hot/warm/cold)',
      'Full-fidelity data preserved independent of SIEM',
      'Multi-product usage (Stream + Lake + Search, or Stream + Edge + Lake)',
    ],
    capabilities: [
      'Federated search across live and historical data',
      'SIEM-agnostic long-term retention',
      'On-demand investigations without re-ingestion',
      'Compliance retention at fraction of SIEM cost',
      'Archive search and forensic capability',
      'Full decoupling of collection from analysis destinations',
    ],
  },
  {
    level: 4,
    label: 'L4',
    title: 'Compose Your Telemetry Cloud Services',
    description: 'Full leverage of choice, flexibility, and control of data. Advanced and robust infrastructure with dashboarding, alerting, and enrichment services.',
    characteristics: [
      'Full product suite deployed (Stream, Edge, Lake, Search)',
      'Advanced pipeline logic with enrichment services',
      'Custom dashboarding and alerting on telemetry operations',
      'Robust, multi-region or multi-environment infrastructure',
      'Telemetry as a composable platform, not just a pipeline',
    ],
    capabilities: [
      'Composable telemetry cloud services',
      'Operational dashboarding on data flows',
      'Alerting on telemetry health and anomalies',
      'Enrichment services integrated into pipelines',
      'Full organizational self-service for data consumers',
      'Telemetry platform treated as critical infrastructure',
    ],
  },
];

export interface MaturityAssessment {
  currentLevel: number;
  score: number;
  signals: MaturitySignal[];
  nextLevel: MaturityLevel | null;
  gapsToNext: string[];
  artOfThePossible: ArtOfThePossible[];
}

export interface MaturitySignal {
  indicator: string;
  present: boolean;
  levelImplication: number;
}

export interface ArtOfThePossible {
  title: string;
  description: string;
  level: number;
  category: 'multi-destination' | 'search' | 'lake' | 'edge' | 'tiering' | 'enrichment' | 'composable';
  businessValue: string;
}

export function assessMaturity(snapshot: ArchitectureSnapshot): MaturityAssessment {
  const signals: MaturitySignal[] = [];

  // L1 signals: basic deployment
  const hasActiveSources = snapshot.sourceCount > 0;
  const hasActiveDestinations = snapshot.destinationCount > 0;
  const hasMultipleSources = snapshot.sourceCount >= 3;
  signals.push({ indicator: 'Active sources configured', present: hasActiveSources, levelImplication: 1 });
  signals.push({ indicator: 'Active destinations configured', present: hasActiveDestinations, levelImplication: 1 });
  signals.push({ indicator: 'Multiple active sources (3+)', present: hasMultipleSources, levelImplication: 1 });

  // L2 signals: multi-destination, cheap storage, multiple groups
  const hasMultipleDestTypes = snapshot.uniqueDestinationTypes.length >= 2;
  const hasObjectStore = snapshot.destinations.some(d =>
    d.status === 'active' && ['s3', 'gcs', 'azure_blob', 'azure_data_lake'].includes(d.type)
  );
  const hasMultipleGroups = snapshot.groups.filter(g => !g.isFleet && g.id !== 'default_search' && g.id !== 'default_outpost').length > 1;
  const hasEdge = snapshot.hasEdge;

  signals.push({ indicator: 'Multiple destination types (2+)', present: hasMultipleDestTypes, levelImplication: 2 });
  signals.push({ indicator: 'Object store destination (S3/GCS/Azure Blob)', present: hasObjectStore, levelImplication: 2 });
  signals.push({ indicator: 'Multiple worker groups', present: hasMultipleGroups, levelImplication: 2 });
  signals.push({ indicator: `Edge fleet at scale (100+ active nodes, found ${snapshot.edgeNodeCount})`, present: hasEdge, levelImplication: 2 });

  // L3 signals: Lake, Search, tiering
  const hasLake = snapshot.hasLake;
  const hasSearchAtScale = snapshot.hasSearch && snapshot.searchDailyAvg >= 10;
  const hasLakeAndSIEM = hasLake && snapshot.destinations.some(d =>
    d.status === 'active' && ['splunk', 'splunk_lb', 'splunk_hec', 'elastic', 'google_chronicle', 'microsoft_sentinel', 'sumo_logic'].includes(d.type)
  );
  const multiProductCount = [
    snapshot.sourceCount > 0,
    hasEdge,
    hasLake,
    hasSearchAtScale,
  ].filter(Boolean).length;
  const hasMultiProduct = multiProductCount >= 3;

  signals.push({ indicator: 'Cribl Lake in use', present: hasLake, levelImplication: 3 });
  signals.push({ indicator: `Cribl Search actively used (10+/day, found ${snapshot.searchDailyAvg.toFixed(1)}/day)`, present: hasSearchAtScale, levelImplication: 3 });
  signals.push({ indicator: 'Lake + SIEM (data tiering pattern)', present: hasLakeAndSIEM, levelImplication: 3 });
  signals.push({ indicator: 'Multi-product deployment (3+ products)', present: hasMultiProduct, levelImplication: 3 });

  // L4 signals: full suite, advanced usage
  const hasFullSuite = multiProductCount === 4;
  const hasAdvancedDestCount = snapshot.uniqueDestinationTypes.length >= 4;
  const hasManyPipelines = snapshot.flows.length > 10;

  signals.push({ indicator: 'Full product suite (Stream + Edge + Lake + Search)', present: hasFullSuite, levelImplication: 4 });
  signals.push({ indicator: 'Advanced destination diversity (4+ types)', present: hasAdvancedDestCount, levelImplication: 4 });
  signals.push({ indicator: 'Complex routing (10+ data flows)', present: hasManyPipelines, levelImplication: 4 });

  // Calculate level
  let currentLevel = 0;
  if (hasActiveSources && hasActiveDestinations) currentLevel = 1;

  const l2Signals = signals.filter(s => s.levelImplication === 2 && s.present).length;
  if (currentLevel >= 1 && l2Signals >= 2) currentLevel = 2;

  const l3Signals = signals.filter(s => s.levelImplication === 3 && s.present).length;
  if (currentLevel >= 2 && l3Signals >= 2) currentLevel = 3;

  const l4Signals = signals.filter(s => s.levelImplication === 4 && s.present).length;
  if (currentLevel >= 3 && l4Signals >= 2) currentLevel = 4;

  const nextLevel = currentLevel < 4 ? MATURITY_LEVELS[currentLevel + 1] : null;

  // Gaps to next level
  const gapsToNext: string[] = [];
  if (nextLevel) {
    const nextLevelSignals = signals.filter(s => s.levelImplication === nextLevel.level && !s.present);
    gapsToNext.push(...nextLevelSignals.map(s => s.indicator));
  }

  // Art of the possible
  const artOfThePossible = generateArtOfThePossible(snapshot, currentLevel);

  return {
    currentLevel,
    score: currentLevel,
    signals,
    nextLevel,
    gapsToNext,
    artOfThePossible,
  };
}

function generateArtOfThePossible(snapshot: ArchitectureSnapshot, currentLevel: number): ArtOfThePossible[] {
  const items: ArtOfThePossible[] = [];

  if (currentLevel < 2) {
    items.push({
      title: 'Multi-Destination Routing',
      description: 'Route the same data to multiple destinations simultaneously — send optimized data to your SIEM for detections while preserving full-fidelity copies in cost-effective storage for investigations and compliance.',
      level: 2,
      category: 'multi-destination',
      businessValue: 'Reduce SIEM costs 30-60% while preserving all data for when you need it most.',
    });

    items.push({
      title: 'Data Replay from Object Store',
      description: 'Store raw data in S3/GCS and replay it into any destination on demand. Need to re-investigate an incident from 6 months ago? Replay that data into your SIEM without maintaining expensive hot retention.',
      level: 2,
      category: 'tiering',
      businessValue: 'Eliminate the tradeoff between retention cost and investigation capability.',
    });
  }

  if (currentLevel < 3) {
    items.push({
      title: 'Cribl Lake: SIEM-Agnostic Retention',
      description: 'Store full-fidelity telemetry in Cribl Lake at a fraction of SIEM cost. Data is indexed and searchable without requiring re-ingestion. Switch SIEMs without losing years of historical data.',
      level: 3,
      category: 'lake',
      businessValue: 'Break vendor lock-in while extending retention from months to years at minimal cost.',
    });

    items.push({
      title: 'Federated Search Across All Data',
      description: 'Use Cribl Search to query across live streaming data, Lake, S3, and other stores from a single interface. Investigators no longer need to know where data lives — they just search.',
      level: 3,
      category: 'search',
      businessValue: 'Reduce mean time to resolution by eliminating tool-hopping during investigations.',
    });

    items.push({
      title: 'Hot/Warm/Cold Data Tiering',
      description: 'Implement intelligent data tiering: 30-90 days hot in your SIEM for active detections, 90-365 days warm in Lake for investigations, 1-5+ years cold for compliance. Each tier optimized for its access pattern.',
      level: 3,
      category: 'tiering',
      businessValue: 'Right-size cost to access pattern — stop paying SIEM prices for data accessed once a year.',
    });

    if (!snapshot.hasEdge) {
      items.push({
        title: 'Edge-Side Collection & Filtering',
        description: 'Deploy Cribl Edge at source locations to filter, enrich, and route data before it crosses the WAN. Consolidate multiple agents into one. Process data where it lives rather than shipping everything centrally.',
        level: 3,
        category: 'edge',
        businessValue: 'Reduce WAN bandwidth 40-70% and eliminate agent sprawl across endpoints.',
      });
    }
  }

  if (currentLevel < 4) {
    items.push({
      title: 'Composable Telemetry Cloud',
      description: 'Treat your telemetry infrastructure as composable services: any team can request data routed to their preferred tool, with governance and cost controls built in. Self-service data access without central bottlenecks.',
      level: 4,
      category: 'composable',
      businessValue: 'Enable organizational agility — new tools and teams onboard in hours, not months.',
    });

    items.push({
      title: 'Operational Intelligence on Data Flows',
      description: 'Build dashboards and alerts on your telemetry pipeline itself: volume anomalies, delivery latency, cost tracking per source, and health monitoring across all destinations.',
      level: 4,
      category: 'enrichment',
      businessValue: 'Proactive detection of data quality issues before they impact security or operations.',
    });

    items.push({
      title: 'Enrichment Services at the Pipeline',
      description: 'Enrich events in-flight with threat intel, asset context, user identity, and geo-IP data before they reach any destination. Every consumer gets enriched data without duplicating enrichment logic.',
      level: 4,
      category: 'enrichment',
      businessValue: 'Faster detections, richer context during investigations, reduced downstream processing.',
    });
  }

  return items;
}
