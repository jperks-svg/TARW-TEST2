import {
  getGroups,
  getInputs,
  getOutputs,
  getRoutes,
  getInputStatuses,
  getOutputStatuses,
  getFleetNodes,
  getSearchDatasets,
  getSearchJobs,
} from '../api/cribl';
import { classifySourceCategory } from './analysis';
import type {
  ArchitectureSnapshot,
  CriblGroup,
  TelemetrySource,
  TelemetryDestination,
  DataFlow,
  CriblRoute,
} from '../types';

const SECONDS_PER_DAY = 86400;
const BYTES_PER_GB = 1073741824;

// Source types that actively generate data themselves (not passive listeners)
const SELF_GENERATING_TYPES = [
  'datagen', 'criblmetrics', 'cribl', 'internal_metrics',
];

export async function discoverArchitecture(
  onProgress?: (message: string) => void
): Promise<ArchitectureSnapshot> {
  onProgress?.('Discovering worker groups and fleets...');
  const groups = await getGroups();

  const streamGroups = groups.filter(g => !g.isFleet && g.id !== 'default_search');
  const edgeGroups = groups.filter(g => g.isFleet);

  const allSources: TelemetrySource[] = [];
  const allDestinations: TelemetryDestination[] = [];
  const allFlows: DataFlow[] = [];
  let hasLake = false;
  let hasSearch = false;
  const searchDatasets: string[] = [];

  for (const group of [...streamGroups, ...edgeGroups]) {
    onProgress?.(`Scanning group: ${group.id}...`);

    const [inputs, outputs, routesData, inputStatuses, outputStatuses] = await Promise.all([
      getInputs(group.id).catch(() => []),
      getOutputs(group.id).catch(() => []),
      getRoutes(group.id).catch(() => ({ id: 'default', routes: [] as CriblRoute[] })),
      getInputStatuses(group.id).catch(() => []),
      getOutputStatuses(group.id).catch(() => []),
    ]);

    const inputStatusMap = new Map(inputStatuses.map(s => [s.id, s]));
    const outputStatusMap = new Map(outputStatuses.map(s => [s.id, s]));

    for (const input of inputs) {
      if (input.disabled) continue;

      const status = inputStatusMap.get(input.id);
      const bytesIn = (status?.bytesIn ?? 0);
      const eventsIn = (status?.eventsIn ?? 0);
      const dailyVolumeGB = bytesIn > 0 ? (bytesIn / BYTES_PER_GB) * (SECONDS_PER_DAY / 60) : 0;
      const inputHealth = typeof status?.status === 'object' ? status.status?.health : status?.status;
      const isError = inputHealth === 'Red' || inputHealth === 'Error';
      const isHealthy = inputHealth === 'Green';
      const hasDataFlowing = bytesIn > 0 || eventsIn > 0;
      const isSelfGenerating = SELF_GENERATING_TYPES.includes(input.type);

      allSources.push({
        id: `${group.id}:${input.id}`,
        name: input.id,
        type: input.type,
        group: group.id,
        product: group.isFleet ? 'edge' : 'stream',
        dailyVolumeGB: Math.max(dailyVolumeGB, 0),
        eventsPerDay: eventsIn * (SECONDS_PER_DAY / 60),
        status: isError ? 'error' : (hasDataFlowing || (isSelfGenerating && isHealthy)) ? 'active' : 'dormant',
        dataCategory: classifySourceCategory({ type: input.type, id: input.id }),
      });
    }

    // Determine which sources in this group are active
    const activeSourceIds = new Set<string>();
    for (const input of inputs) {
      if (input.disabled) continue;
      const status = inputStatusMap.get(input.id);
      const bytesIn = (status?.bytesIn ?? 0);
      const eventsIn = (status?.eventsIn ?? 0);
      const inputHealth = typeof status?.status === 'object' ? status.status?.health : status?.status;
      const isSelfGen = SELF_GENERATING_TYPES.includes(input.type);
      const hasData = bytesIn > 0 || eventsIn > 0;
      if (hasData || (isSelfGen && inputHealth === 'Green')) {
        activeSourceIds.add(input.id);
      }
    }

    // Determine which outputs receive data from active sources
    const routedActiveOutputIds = new Set<string>();

    // Check direct connections (sendToRoutes=false, uses connections array)
    for (const input of inputs) {
      if (input.disabled) continue;
      if (!activeSourceIds.has(input.id)) continue;
      if (input.sendToRoutes === false && input.connections) {
        for (const conn of input.connections) {
          if (conn.output) routedActiveOutputIds.add(conn.output);
        }
      }
    }

    // Check routes (for sources that do sendToRoutes)
    const routes = routesData.routes ?? (routesData as unknown as CriblRoute[]) ?? [];
    if (Array.isArray(routes)) {
      for (const route of routes) {
        if (route.disabled || !route.output) continue;
        if (activeSourceIds.size > 0) {
          routedActiveOutputIds.add(route.output);
        }
      }
    }

    for (const output of outputs) {
      if (output.disabled) continue;

      const status = outputStatusMap.get(output.id);
      const bytesOut = (status?.bytesOut ?? 0);
      const eventsOut = (status?.eventsOut ?? 0);
      const dailyVolumeGB = bytesOut > 0 ? (bytesOut / BYTES_PER_GB) * (SECONDS_PER_DAY / 60) : 0;
      const outputHealth = typeof status?.status === 'object' ? status.status?.health : status?.status;
      const isError = outputHealth === 'Red' || outputHealth === 'Error';
      const hasDataFlowing = bytesOut > 0 || eventsOut > 0;
      const isRoutedFromActiveSource = routedActiveOutputIds.has(output.id);

      if ((output.type === 'cribl_lake' || output.type === 'lake') && (hasDataFlowing || isRoutedFromActiveSource)) {
        hasLake = true;
      }

      allDestinations.push({
        id: `${group.id}:${output.id}`,
        name: output.id,
        type: output.type,
        group: group.id,
        product: group.isFleet ? 'edge' : 'stream',
        dailyVolumeGB: Math.max(dailyVolumeGB, 0),
        status: isError ? 'error' : (hasDataFlowing || isRoutedFromActiveSource) ? 'active' : 'dormant',
        pqEnabled: output.pqEnabled ?? false,
        hasBackpressure: (status?.backpressure ?? 0) > 0,
      });
    }

    if (Array.isArray(routes)) {
      for (const route of routes) {
        if (route.disabled) continue;
        if (route.output) {
          const matchingInputs = inputs.filter(i => !i.disabled);
          for (const input of matchingInputs.slice(0, 5)) {
            allFlows.push({
              sourceId: `${group.id}:${input.id}`,
              sourceName: input.id,
              sourceType: input.type,
              pipelineId: route.pipeline ?? undefined,
              pipelineName: route.pipeline ?? undefined,
              destinationId: `${group.id}:${route.output}`,
              destinationName: route.output,
              destinationType: outputs.find(o => o.id === route.output)?.type ?? 'unknown',
              group: group.id,
            });
          }
        }
      }
    }
  }

  // Check search
  onProgress?.('Checking Cribl Search configuration...');
  let searchDailyAvg = 0;
  try {
    const datasets = await getSearchDatasets();
    if (Array.isArray(datasets) && datasets.length > 0) {
      hasSearch = true;
      for (const ds of datasets) {
        if (typeof ds === 'object' && ds !== null && 'id' in ds) {
          searchDatasets.push((ds as { id: string }).id);
        }
      }
    }
  } catch {
    // Search not available
  }

  // Count search job frequency
  try {
    const jobs = await getSearchJobs();
    if (jobs.length > 0) {
      const now = Date.now();
      const oldestJob = Math.min(...jobs.map(j => j.timeCreated));
      const spanDays = Math.max(1, (now - oldestJob) / 86400000);
      searchDailyAvg = jobs.length / spanDays;
    }
  } catch {
    // Search jobs not available
  }

  // Check edge node count — need 100+ active nodes to be considered "using Edge"
  let edgeNodeCount = 0;
  if (edgeGroups.length > 0) {
    onProgress?.('Counting active Edge nodes...');
    for (const fleet of edgeGroups) {
      try {
        const nodes = await getFleetNodes(fleet.id);
        edgeNodeCount += nodes.filter(n => n.status === 'active' || n.status === 'connected').length;
      } catch {
        // Fleet node count unavailable
      }
    }
  }
  const hasEdgeAtScale = edgeNodeCount >= 100;

  const totalIngest = allSources.reduce((sum, s) => sum + s.dailyVolumeGB, 0);
  const totalOutgest = allDestinations.reduce((sum, d) => sum + d.dailyVolumeGB, 0);
  const uniqueDestTypes = [...new Set(allDestinations.filter(d => d.status === 'active').map(d => d.type))];

  onProgress?.('Discovery complete.');

  return {
    groups: groups as CriblGroup[],
    sources: allSources,
    destinations: allDestinations,
    flows: allFlows,
    totalDailyIngestGB: totalIngest,
    totalDailyOutgestGB: totalOutgest,
    destinationCount: allDestinations.filter(d => d.status === 'active').length,
    sourceCount: allSources.filter(s => s.status === 'active').length,
    dormantSourceCount: allSources.filter(s => s.status === 'dormant').length,
    dormantDestinationCount: allDestinations.filter(d => d.status === 'dormant').length,
    uniqueDestinationTypes: uniqueDestTypes,
    hasLake,
    hasSearch,
    hasEdge: hasEdgeAtScale,
    edgeNodeCount,
    searchDatasets,
    searchDailyAvg,
  };
}
