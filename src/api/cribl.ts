import type { CriblGroup, CriblInput, CriblOutput, CriblRoute, CriblPipeline, InputStatus, OutputStatus } from '../types';

declare const CRIBL_API_URL: string;

function apiUrl(path: string): string {
  return `${CRIBL_API_URL}${path}`;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl(path), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${res.statusText} for ${path}`);
  }
  const data = await res.json();
  return (data.items ?? data) as T;
}

export async function getGroups(): Promise<CriblGroup[]> {
  return apiFetch<CriblGroup[]>('/master/groups');
}

export async function getInputs(groupId: string): Promise<CriblInput[]> {
  return apiFetch<CriblInput[]>(`/m/${groupId}/system/inputs`);
}

export async function getOutputs(groupId: string): Promise<CriblOutput[]> {
  return apiFetch<CriblOutput[]>(`/m/${groupId}/system/outputs`);
}

export async function getRoutes(groupId: string): Promise<{ id: string; routes: CriblRoute[] }> {
  return apiFetch(`/m/${groupId}/routes`);
}

export async function getPipelines(groupId: string): Promise<CriblPipeline[]> {
  return apiFetch<CriblPipeline[]>(`/m/${groupId}/pipelines`);
}

export async function getInputStatuses(groupId: string): Promise<InputStatus[]> {
  return apiFetch<InputStatus[]>(`/m/${groupId}/system/status/inputs`);
}

export async function getOutputStatuses(groupId: string): Promise<OutputStatus[]> {
  return apiFetch<OutputStatus[]>(`/m/${groupId}/system/status/outputs`);
}

export async function getSystemInfo(): Promise<Record<string, unknown>> {
  return apiFetch('/system/info');
}

export async function getLicenseUsage(): Promise<Record<string, unknown>> {
  return apiFetch('/system/licenses/usage');
}

export async function getWorkerSummary(): Promise<unknown[]> {
  return apiFetch('/master/summary/workers');
}

export async function queryMetrics(body: {
  metricExpressions: string[];
  startTime?: number;
  endTime?: number;
  bucketSize?: number;
  dimensionFilters?: Array<{ dimension: string; value: string }>;
  dimensionSplits?: string[];
}): Promise<unknown> {
  return apiFetch('/insights/metrics/query', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function getFleetNodes(fleetId: string): Promise<{ id: string; hostname?: string; status?: string }[]> {
  try {
    return await apiFetch(`/master/groups/${fleetId}/workers`);
  } catch {
    return [];
  }
}

export async function getSearchJobs(): Promise<{ id: string; timeCreated: number }[]> {
  try {
    return await apiFetch('/m/default_search/search/jobs');
  } catch {
    return [];
  }
}

export async function getSearchDatasets(): Promise<unknown[]> {
  try {
    return await apiFetch<unknown[]>('/m/default_search/search/saved');
  } catch {
    return [];
  }
}
