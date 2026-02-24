import { useQuery } from "@tanstack/react-query";
import { useRef } from "react";

export type TopicRun = {
  id: string;
  jobType: string;
  status: "queued" | "running" | "success" | "fail" | "partial" | "timeout";
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;  // Normalized from string to number
  processedCount: number | null;
  errorSummary: string | null;
};

export type TopicRunsResponse = {
  serverTime?: string;
  pollAfterMs?: number;
  activeJob: TopicRun | null;
  runs: TopicRun[];
};

// Safe coercion: string | number | null → number | null
function toNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

// Normalize backend response to clean types
function normalizeRun(run: any): TopicRun {
  return {
    id: run.id,
    jobType: run.jobType,
    status: run.status,
    startedAt: run.startedAt,
    endedAt: run.endedAt,
    durationSeconds: toNumber(run.durationSeconds),
    processedCount: toNumber(run.processedCount),
    errorSummary: run.errorSummary || null,
  };
}

async function fetchTopicRuns(topicId: string, signal?: AbortSignal): Promise<TopicRunsResponse> {
  const res = await fetch(`/api/topics/${topicId}/runs?limit=10`, { 
    credentials: "include",
    signal 
  });
  if (!res.ok) throw new Error(`Failed to load runs (${res.status})`);
  const json = await res.json();

  return {
    serverTime: json.serverTime,
    pollAfterMs: json.pollAfterMs,
    activeJob: json.activeJob ? normalizeRun(json.activeJob) : null,
    runs: Array.isArray(json.runs) ? json.runs.map(normalizeRun) : [],
  };
}

export function useTopicRuns(topicId: string | null, enabled: boolean) {
  const pollingStartRef = useRef<number | null>(null);

  const query = useQuery<TopicRunsResponse>({
    queryKey: ["topic-runs", topicId ?? "none"],  // Stable key for null
    enabled: Boolean(topicId) && enabled,
    queryFn: ({ signal }) => fetchTopicRuns(topicId!, signal),
    staleTime: 0,  // Always fetch fresh during active runs
    retry: 1,      // Retry once on failure
    retryDelay: 500,  // 500ms between retries
    refetchInterval: (q) => {
      const data = q.state.data as TopicRunsResponse | undefined;

      // If no data yet, keep polling briefly
      if (!data) return 2000;

      // If there's an active job, poll with timeout guardrail
      if (data.activeJob) {
        // Start tracking when polling begins
        pollingStartRef.current ??= Date.now();
        
        // Stop after 2 minutes to prevent infinite polling
        if (Date.now() - pollingStartRef.current > 2 * 60 * 1000) {
          pollingStartRef.current = null;
          return false;
        }
        
        return data.pollAfterMs ?? 3000;
      }

      // No active job: reset and stop polling
      pollingStartRef.current = null;
      return false;
    },
  });

  const data = query.data;

  return {
    ...query,
    activeJob: data?.activeJob ?? null,
    runs: data?.runs ?? [],
    hasActiveJob: Boolean(data?.activeJob),
    activeStatus: data?.activeJob?.status ?? null,
  };
}
