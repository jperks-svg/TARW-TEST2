export interface CriblGroup {
  id: string;
  name?: string;
  description?: string;
  isFleet?: boolean;
  workerCount?: number;
  configVersion?: string;
  product?: string;
}

export interface CriblInput {
  id: string;
  type: string;
  disabled?: boolean;
  description?: string;
  host?: string;
  port?: number;
  metadata?: Record<string, unknown>;
  pqEnabled?: boolean;
  group?: string;
  sendToRoutes?: boolean;
  connections?: Array<{ output: string; pipeline?: string }>;
}

export interface CriblOutput {
  id: string;
  type: string;
  disabled?: boolean;
  description?: string;
  host?: string;
  bucket?: string;
  metadata?: Record<string, unknown>;
  pqEnabled?: boolean;
  group?: string;
  systemFields?: string[];
}

export interface CriblRoute {
  id: string;
  name?: string;
  filter?: string;
  pipeline?: string;
  output?: string;
  final?: boolean;
  disabled?: boolean;
  description?: string;
  group?: string;
}

export interface CriblPipeline {
  id: string;
  conf?: {
    functions?: Array<{
      id: string;
      filter?: string;
      description?: string;
      disabled?: boolean;
    }>;
    description?: string;
  };
  group?: string;
}

export interface InputStatus {
  id: string;
  type: string;
  status?: { health?: string } | string;
  bytesIn?: number;
  eventsIn?: number;
}

export interface OutputStatus {
  id: string;
  type: string;
  status?: { health?: string } | string;
  bytesOut?: number;
  eventsOut?: number;
  backpressure?: number;
}

export interface TelemetrySource {
  id: string;
  name: string;
  type: string;
  group: string;
  product: 'stream' | 'edge';
  dailyVolumeGB: number;
  eventsPerDay: number;
  status: 'active' | 'dormant' | 'error';
  dataCategory: 'security' | 'observability' | 'both' | 'unknown';
}

export interface TelemetryDestination {
  id: string;
  name: string;
  type: string;
  group: string;
  product: 'stream' | 'edge';
  dailyVolumeGB: number;
  status: 'active' | 'dormant' | 'error';
  pqEnabled: boolean;
  hasBackpressure: boolean;
}

export interface DataFlow {
  sourceId: string;
  sourceName: string;
  sourceType: string;
  pipelineId?: string;
  pipelineName?: string;
  destinationId: string;
  destinationName: string;
  destinationType: string;
  group: string;
}

export interface ArchitectureSnapshot {
  groups: CriblGroup[];
  sources: TelemetrySource[];
  destinations: TelemetryDestination[];
  flows: DataFlow[];
  totalDailyIngestGB: number;
  totalDailyOutgestGB: number;
  destinationCount: number;
  sourceCount: number;
  dormantSourceCount: number;
  dormantDestinationCount: number;
  uniqueDestinationTypes: string[];
  hasLake: boolean;
  hasSearch: boolean;
  hasEdge: boolean;
  edgeNodeCount: number;
  searchDatasets: string[];
  searchDailyAvg: number;
  licenseInfo?: {
    dailyLimit?: number;
    currentUsage?: number;
  };
}

export type RiskSeverity = 'high' | 'medium' | 'low';

export interface Risk {
  id: string;
  title: string;
  description: string;
  severity: RiskSeverity;
  category: 'single-destination' | 'cost' | 'flexibility' | 'investigation' | 'retention' | 'resilience' | 'upgrade';
  evidence: string;
  recommendation: string;
}

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  priority: 'immediate' | 'short-term' | 'long-term';
  effort: 'low' | 'medium' | 'high';
  impact: 'high' | 'medium' | 'low';
  category: 'multi-destination' | 'data-tiering' | 'edge-deployment' | 'lake-adoption' | 'search-adoption' | 'optimization' | 'resilience';
  steps: string[];
  relatedRisks: string[];
}

export interface TieringRecommendation {
  sourceType: string;
  sourceName: string;
  currentDestination: string;
  recommendedTier0: string;
  recommendedTier1: string;
  recommendedTier2: string;
  tier0Retention: string;
  tier1Retention: string;
  tier2Retention: string;
  rationale: string;
}

export interface ExecutiveSummary {
  currentState: string;
  identifiedRisks: string[];
  recommendedEvolution: string[];
  positiveOutcomes: string[];
  nextActions: Array<{
    action: string;
    owner: string;
    timeline: string;
  }>;
}

export interface ValueFormula {
  expression: string;
  variables: { label: string; value: string }[];
  result: string;
}

export interface QualitativeValue {
  id: string;
  category: 'time-savings' | 'risk-posture' | 'agility' | 'visibility';
  title: string;
  description: string;
  metric: string;
  evidence: string;
}

export interface ValueLineItem {
  id: string;
  category: 'cost-reduction' | 'operational' | 'flexibility' | 'risk-mitigation';
  title: string;
  description: string;
  annualValue: number;
  evidence: string;
  formula: ValueFormula;
}

export interface ValueProjection {
  id: string;
  targetLevel: number;
  title: string;
  description: string;
  additionalAnnualValue: number;
  requirement: string;
  formula: ValueFormula;
}

export interface CustomerValue {
  costPerGBPerDay: number;
  currentAnnualValue: number;
  projectedAnnualValue: number;
  valueLineItems: ValueLineItem[];
  projections: ValueProjection[];
  qualitativeValues: QualitativeValue[];
}

export type AppPhase = 'loading' | 'discovery' | 'snapshot' | 'analysis' | 'recommendations' | 'deliverables';
