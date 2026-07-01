import type {
  ArchitectureSnapshot,
  Risk,
  Recommendation,
  TieringRecommendation,
  ExecutiveSummary,
  TelemetrySource,
} from '../types';

const SECURITY_SOURCE_TYPES = [
  'syslog', 'crowdstrike', 'palo_alto', 'fortinet', 'checkpoint',
  'cisco_asa', 'snort', 'suricata', 'wineventlog', 'carbon_black',
  'sentinelone', 'microsoft_defender', 'okta', 'duo', 'aws_cloudtrail',
  'azure_activity', 'gcp_audit', 'sophos', 'f5',
];

const OBSERVABILITY_SOURCE_TYPES = [
  'splunk_hec', 'http', 'elastic', 'prometheus', 'statsd', 'graphite',
  'opentelemetry', 'datadog', 'newrelic', 'kinesis', 'kafka',
  'cloudwatch', 'azure_monitor',
];

export function classifySourceCategory(source: { type: string; id: string }): TelemetrySource['dataCategory'] {
  const idLower = source.id.toLowerCase();
  const typeLower = source.type.toLowerCase();

  const isSecurity = SECURITY_SOURCE_TYPES.some(t => typeLower.includes(t) || idLower.includes(t));
  const isObservability = OBSERVABILITY_SOURCE_TYPES.some(t => typeLower.includes(t) || idLower.includes(t));

  if (isSecurity && isObservability) return 'both';
  if (isSecurity) return 'security';
  if (isObservability) return 'observability';
  return 'unknown';
}

export function identifyRisks(snapshot: ArchitectureSnapshot): Risk[] {
  const risks: Risk[] = [];

  // Single destination risk
  if (snapshot.uniqueDestinationTypes.length === 1) {
    risks.push({
      id: 'single-dest',
      title: 'Single Destination Dependency',
      description: `All telemetry flows to a single destination type (${snapshot.uniqueDestinationTypes[0]}). This creates vendor lock-in, cost concentration, and resilience risk.`,
      severity: 'high',
      category: 'single-destination',
      evidence: `${snapshot.sourceCount} sources routing to ${snapshot.destinationCount} destination(s), all of type "${snapshot.uniqueDestinationTypes[0]}"`,
      recommendation: 'Implement a multi-destination architecture with data tiering — route high-value data to your primary SIEM while sending full-fidelity copies to a cost-effective store like Cribl Lake or S3.',
    });
  } else if (snapshot.uniqueDestinationTypes.length === 2 && snapshot.destinations.length <= 3) {
    risks.push({
      id: 'limited-dest',
      title: 'Limited Destination Diversity',
      description: `Only ${snapshot.uniqueDestinationTypes.length} destination types in use. While better than a single destination, there may be opportunities to optimize cost and access patterns with additional tiering.`,
      severity: 'medium',
      category: 'single-destination',
      evidence: `Destination types: ${snapshot.uniqueDestinationTypes.join(', ')}`,
      recommendation: 'Evaluate whether a hot/warm/cold tiering strategy could reduce costs while preserving investigation capability.',
    });
  }

  // No Lake adoption
  if (!snapshot.hasLake) {
    risks.push({
      id: 'no-lake',
      title: 'No Long-Term Retention Strategy (Cribl Lake)',
      description: 'Cribl Lake is not in use. Without a low-cost, SIEM-agnostic retention layer, compliance data and forensic investigation capability may be limited by expensive primary destination retention.',
      severity: 'medium',
      category: 'retention',
      evidence: 'No Lake destinations configured across any worker group.',
      recommendation: 'Deploy Cribl Lake as a "lake-first" fan-out destination for full-fidelity retention at a fraction of SIEM storage cost. Use Cribl Search for on-demand investigations.',
    });
  }

  // No Search adoption
  if (!snapshot.hasSearch) {
    risks.push({
      id: 'no-search',
      title: 'No Federated Search Capability',
      description: 'Cribl Search is not actively configured. Teams may be relying solely on destination-native search, creating investigation friction and "tool hopping" during incidents.',
      severity: 'low',
      category: 'investigation',
      evidence: 'No saved searches or search datasets found.',
      recommendation: 'Enable Cribl Search to provide federated access across Lake, S3, and live data — reducing MTTR by eliminating tool-hopping during investigations.',
    });
  }

  // No Edge deployment
  if (!snapshot.hasEdge) {
    risks.push({
      id: 'no-edge',
      title: 'No Edge-Side Processing',
      description: 'No Edge fleet is deployed. All filtering, enrichment, and routing happens centrally, which can increase bandwidth costs and reduce regional resilience.',
      severity: 'low',
      category: 'flexibility',
      evidence: 'No Edge fleet groups detected.',
      recommendation: 'Deploy Cribl Edge at high-volume source locations to filter and enrich data at the point of collection, reducing WAN bandwidth and improving resilience.',
    });
  }

  // High volume with no optimization signals
  const highVolumeSources = snapshot.sources.filter(s => s.dailyVolumeGB > 100);
  if (highVolumeSources.length > 0 && snapshot.uniqueDestinationTypes.length <= 2) {
    risks.push({
      id: 'high-volume-no-tiering',
      title: 'High-Volume Sources Without Data Tiering',
      description: `${highVolumeSources.length} source(s) ingesting >100 GB/day without evident tiering or reduction strategies. This drives unnecessary cost in the primary destination.`,
      severity: 'high',
      category: 'cost',
      evidence: `High-volume sources: ${highVolumeSources.map(s => `${s.name} (${s.dailyVolumeGB.toFixed(0)} GB/day)`).join(', ')}`,
      recommendation: 'Implement per-source routing policies: send only detection-critical events to the SIEM, full-fidelity to Lake, and archive verbose/low-value data to cold storage.',
    });
  }

  // Backpressure detected
  const destWithBackpressure = snapshot.destinations.filter(d => d.hasBackpressure);
  if (destWithBackpressure.length > 0) {
    risks.push({
      id: 'backpressure',
      title: 'Destination Backpressure Detected',
      description: `${destWithBackpressure.length} destination(s) showing backpressure, indicating capacity constraints that could lead to data loss or delayed delivery.`,
      severity: 'high',
      category: 'resilience',
      evidence: `Destinations with backpressure: ${destWithBackpressure.map(d => d.name).join(', ')}`,
      recommendation: 'Enable persistent queuing on affected destinations and evaluate whether data tiering can reduce load. Consider adding a secondary destination as overflow.',
    });
  }

  // No PQ enabled
  const destsWithoutPQ = snapshot.destinations.filter(d => !d.pqEnabled && d.status === 'active');
  if (destsWithoutPQ.length > 2) {
    risks.push({
      id: 'no-pq',
      title: 'Limited Persistent Queue Coverage',
      description: `${destsWithoutPQ.length} active destinations do not have persistent queuing enabled. During destination outages, data may be lost.`,
      severity: 'medium',
      category: 'resilience',
      evidence: `Destinations without PQ: ${destsWithoutPQ.map(d => d.name).join(', ')}`,
      recommendation: 'Enable persistent queues on critical destinations to prevent data loss during destination outages or maintenance windows.',
    });
  }

  return risks;
}

export function generateRecommendations(snapshot: ArchitectureSnapshot, risks: Risk[]): Recommendation[] {
  const recommendations: Recommendation[] = [];

  const hasSingleDest = risks.some(r => r.id === 'single-dest');
  const hasNoLake = risks.some(r => r.id === 'no-lake');
  const hasNoSearch = risks.some(r => r.id === 'no-search');
  const hasNoEdge = risks.some(r => r.id === 'no-edge');
  const hasHighVolume = risks.some(r => r.id === 'high-volume-no-tiering');

  if (hasSingleDest || hasHighVolume) {
    recommendations.push({
      id: 'multi-dest',
      title: 'Implement Multi-Destination Architecture',
      description: 'Route telemetry to multiple destinations based on data value, use case, and retention requirements. This reduces cost concentration, improves resilience, and preserves investigation flexibility.',
      priority: 'immediate',
      effort: 'medium',
      impact: 'high',
      category: 'multi-destination',
      steps: [
        'Identify 3-5 high-volume source types and classify by security/observability use case',
        'Define routing policy: which events and fields are required in the primary SIEM vs. retained elsewhere',
        'Configure a secondary destination (Lake, S3, or alternate analytics platform)',
        'Implement Stream routes to fan out data based on source, event type, or field importance',
        'Validate detection coverage is preserved in the primary SIEM',
        'Monitor cost reduction and investigation workflow improvements',
      ],
      relatedRisks: ['single-dest', 'high-volume-no-tiering'],
    });
  }

  if (hasNoLake) {
    recommendations.push({
      id: 'adopt-lake',
      title: 'Deploy Cribl Lake for Long-Term Retention',
      description: 'Use Cribl Lake as a "lake-first" retention layer that stores full-fidelity telemetry at low cost. This enables compliance retention, forensic investigations, and AI/ML use cases without SIEM cost pressure.',
      priority: hasSingleDest ? 'immediate' : 'short-term',
      effort: 'low',
      impact: 'high',
      category: 'lake-adoption',
      steps: [
        'Provision a Cribl Lake instance and configure storage classes (hot/warm/cold)',
        'Add Lake as a parallel destination on high-volume Stream worker groups',
        'Configure retention policies aligned to compliance requirements (1-5 years)',
        'Enable Cribl Search for on-demand access to Lake data',
        'Validate replay capability from Lake back to SIEM for investigations',
      ],
      relatedRisks: ['no-lake', 'single-dest'],
    });
  }

  if (hasNoSearch) {
    recommendations.push({
      id: 'adopt-search',
      title: 'Enable Cribl Search for Federated Investigations',
      description: 'Deploy Cribl Search to provide federated query access across Lake, S3, and live streaming data. This eliminates tool-hopping during incidents and enables cost-gated investigation workflows.',
      priority: 'short-term',
      effort: 'low',
      impact: 'medium',
      category: 'search-adoption',
      steps: [
        'Configure Cribl Search with dataset definitions for your primary data sources',
        'Create search datasets pointing to Lake storage locations',
        'Build saved searches for common investigation patterns',
        'Train the security/ops team on federated search workflows',
      ],
      relatedRisks: ['no-search'],
    });
  }

  if (hasNoEdge && snapshot.totalDailyIngestGB > 500) {
    recommendations.push({
      id: 'deploy-edge',
      title: 'Deploy Cribl Edge for Source-Side Processing',
      description: 'Place Cribl Edge at high-volume source locations to filter, enrich, and route data before it traverses the WAN. This reduces bandwidth, improves regional resilience, and enables source-side agent consolidation.',
      priority: 'long-term',
      effort: 'high',
      impact: 'medium',
      category: 'edge-deployment',
      steps: [
        'Identify top bandwidth-consuming source locations',
        'Deploy Edge fleet to those locations with central management from Leader',
        'Implement source-side filtering to reduce WAN traffic by 30-60%',
        'Configure local buffering for resilience during connectivity loss',
        'Migrate from multiple vendor agents to Edge-managed collection',
      ],
      relatedRisks: ['no-edge'],
    });
  }

  if (hasHighVolume) {
    recommendations.push({
      id: 'data-tiering',
      title: 'Implement Data Tiering Strategy',
      description: 'Classify data into hot/warm/cold tiers based on access patterns, compliance needs, and investigation frequency. Route each tier to the appropriate cost-optimized destination.',
      priority: 'immediate',
      effort: 'medium',
      impact: 'high',
      category: 'data-tiering',
      steps: [
        'Audit each source type: what retention is legally required vs. operationally needed',
        'Define Tier 0 (Hot): 30-90 days in SIEM for active detections and dashboards',
        'Define Tier 1 (Warm): 90-365 days in Lake/S3 for investigations and hunting',
        'Define Tier 2 (Cold): 1-5+ years in archive storage for compliance/forensics',
        'Implement Stream pipelines to reduce/optimize events before SIEM delivery',
        'Validate Tier 0 preserves detection fidelity with reduced volume',
      ],
      relatedRisks: ['high-volume-no-tiering', 'single-dest'],
    });
  }

  return recommendations;
}

export function generateTieringRecommendations(snapshot: ArchitectureSnapshot): TieringRecommendation[] {
  const recommendations: TieringRecommendation[] = [];

  const primaryDest = snapshot.destinations.length > 0
    ? snapshot.destinations.sort((a, b) => b.dailyVolumeGB - a.dailyVolumeGB)[0]
    : null;

  const primaryDestName = primaryDest?.name ?? 'Primary SIEM';

  for (const source of snapshot.sources.filter(s => s.dailyVolumeGB > 0)) {
    const isSecurity = source.dataCategory === 'security' || source.dataCategory === 'both';

    recommendations.push({
      sourceType: source.type,
      sourceName: source.name,
      currentDestination: primaryDestName,
      recommendedTier0: isSecurity ? primaryDestName : 'Optional — only if dashboards/alerts require it',
      recommendedTier1: 'Cribl Lake (active)',
      recommendedTier2: 'Cribl Lake (archive) or S3 Glacier',
      tier0Retention: isSecurity ? '30-90 days' : '7-30 days',
      tier1Retention: '90-365 days',
      tier2Retention: '1-5 years (compliance-driven)',
      rationale: isSecurity
        ? 'Security-critical data requires hot SIEM access for detections; full-fidelity retained in Lake for hunting and forensics.'
        : 'Observability data can be optimized/sampled for SIEM; full-fidelity in Lake for troubleshooting when needed.',
    });
  }

  return recommendations;
}

export function generateExecutiveSummary(snapshot: ArchitectureSnapshot, risks: Risk[], recommendations: Recommendation[]): ExecutiveSummary {
  const highRisks = risks.filter(r => r.severity === 'high');
  const immRecs = recommendations.filter(r => r.priority === 'immediate');

  const currentState = buildCurrentStateNarrative(snapshot);
  const identifiedRisks = risks.map(r => `[${r.severity.toUpperCase()}] ${r.title}: ${r.description}`);
  const recommendedEvolution = recommendations.map(r => `[${r.priority}] ${r.title}: ${r.description}`);

  const positiveOutcomes = [
    highRisks.length > 0 ? 'Reduced single-destination risk through architectural diversification' : null,
    snapshot.totalDailyIngestGB > 200 ? 'Potential 30-60% cost reduction on primary destination through data tiering' : null,
    'Improved investigation speed with federated search across all data tiers',
    'Extended retention capability for compliance without increased primary destination costs',
    'Greater architectural flexibility to adopt new tools without re-plumbing sources',
  ].filter(Boolean) as string[];

  const nextActions = immRecs.slice(0, 3).map(r => ({
    action: r.title,
    owner: 'TBD',
    timeline: r.effort === 'low' ? '2-4 weeks' : r.effort === 'medium' ? '4-8 weeks' : '8-12 weeks',
  }));

  if (nextActions.length === 0) {
    nextActions.push(
      { action: 'Review and validate architecture findings', owner: 'TBD', timeline: '1 week' },
      { action: 'Prioritize top recommendations for pilot', owner: 'TBD', timeline: '2-4 weeks' },
    );
  }

  return {
    currentState,
    identifiedRisks,
    recommendedEvolution,
    positiveOutcomes,
    nextActions,
  };
}

function buildCurrentStateNarrative(snapshot: ArchitectureSnapshot): string {
  const parts: string[] = [];

  parts.push(`The current telemetry architecture processes approximately ${snapshot.totalDailyIngestGB.toFixed(0)} GB/day across ${snapshot.sourceCount} configured sources.`);

  if (snapshot.groups.length > 0) {
    const streamGroups = snapshot.groups.filter(g => !g.isFleet);
    const edgeGroups = snapshot.groups.filter(g => g.isFleet);
    if (streamGroups.length > 0) parts.push(`Stream is deployed with ${streamGroups.length} worker group(s).`);
    if (edgeGroups.length > 0) parts.push(`Edge is deployed with ${edgeGroups.length} fleet(s).`);
  }

  parts.push(`Data routes to ${snapshot.destinationCount} destination(s) across ${snapshot.uniqueDestinationTypes.length} destination type(s): ${snapshot.uniqueDestinationTypes.join(', ')}.`);

  if (!snapshot.hasLake) parts.push('Cribl Lake is not currently in use for long-term retention.');
  if (!snapshot.hasSearch) parts.push('Cribl Search is not actively configured for federated investigations.');
  if (!snapshot.hasEdge) parts.push('No Edge fleet is deployed for source-side processing.');

  return parts.join(' ');
}

export function formatBytes(gb: number): string {
  if (gb >= 1000) return `${(gb / 1000).toFixed(1)} TB`;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  return `${(gb * 1024).toFixed(0)} MB`;
}

export function getOutputTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    splunk: 'Splunk',
    splunk_lb: 'Splunk (Load Balanced)',
    elastic: 'Elasticsearch',
    s3: 'Amazon S3',
    azure_blob: 'Azure Blob Storage',
    gcs: 'Google Cloud Storage',
    kafka: 'Kafka',
    kinesis: 'Amazon Kinesis',
    syslog: 'Syslog',
    tcp_json: 'TCP/JSON',
    http: 'HTTP/Webhook',
    newrelic: 'New Relic',
    datadog: 'Datadog',
    cribl_lake: 'Cribl Lake',
    google_chronicle: 'Google SecOps (Chronicle)',
    microsoft_sentinel: 'Microsoft Sentinel',
    crowdstrike_hec: 'CrowdStrike',
    sumo_logic: 'Sumo Logic',
    snowflake: 'Snowflake',
  };
  return labels[type] ?? type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function getInputTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    syslog: 'Syslog',
    splunk_hec: 'Splunk HEC',
    http: 'HTTP/HEC',
    tcp: 'TCP',
    udp: 'UDP',
    kafka: 'Kafka',
    kinesis: 'Amazon Kinesis',
    s3: 'Amazon S3',
    azure_blob: 'Azure Blob',
    file_monitor: 'File Monitor',
    windows_event_logs: 'Windows Event Logs',
    exec: 'Script/Exec',
    crowdstrike_fdr: 'CrowdStrike FDR',
    office365: 'Office 365',
    google_pubsub: 'Google Pub/Sub',
  };
  return labels[type] ?? type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
