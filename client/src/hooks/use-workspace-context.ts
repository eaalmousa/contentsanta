import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./use-auth";

export interface WorkspaceMembership {
  workspaceId: string;
  name: string;
  role: string;
}

export interface Site {
  id: string;
  name: string;
  url: string | null;
  connectionStatus: "not_connected" | "connected" | "error";
  lastConnectedAt: string | null;
}

export interface RecentTarget {
  id: string;
  name: string;
  type: string;
  workspaceId: string;
}

export interface WorkspaceContext {
  userId: string;
  memberships: WorkspaceMembership[];
  activeWorkspaceId: string;
  activeSiteId: string | null;
  sites: Site[];
  counts: {
    topicsCount: number;
    targetsCount: number;
    sourcesCount: number;
    sitesCount: number;
  };
  recentTargets: RecentTarget[];
}

export function useWorkspaceContext() {
  const { isAuthenticated } = useAuth();
  
  const query = useQuery<WorkspaceContext>({
    queryKey: ["/api/me/context"],
    enabled: isAuthenticated,
    staleTime: 30000,
    refetchOnWindowFocus: true,
  });
  
  // DEBUG: Log the raw API response
  if (query.data) {
    console.log("[WorkspaceContext] API Response:", {
      userId: query.data.userId,
      activeWorkspaceId: query.data.activeWorkspaceId,
      activeSiteId: query.data.activeSiteId,
      sitesCount: query.data.sites?.length,
      memberships: query.data.memberships,
      sourcesCount: query.data.counts?.sourcesCount,
    });
  }
  
  // Find active workspace name from memberships
  const activeWorkspace = query.data?.memberships?.find(
    m => m.workspaceId === query.data?.activeWorkspaceId
  );
  
  console.log("[WorkspaceContext] Resolved:", {
    activeWorkspaceId: query.data?.activeWorkspaceId,
    activeWorkspaceName: activeWorkspace?.name,
    activeSiteId: query.data?.activeSiteId,
    sitesCount: query.data?.sites?.length,
    isLoading: query.isLoading,
    isError: query.isError,
  });
  
  return {
    ...query,
    activeWorkspaceId: query.data?.activeWorkspaceId,
    activeWorkspaceName: activeWorkspace?.name,
    activeSiteId: query.data?.activeSiteId,
    sites: query.data?.sites || [],
    memberships: query.data?.memberships || [],
    counts: query.data?.counts,
    recentTargets: query.data?.recentTargets || [],
  };
}

export function makeWorkspaceApiRequest(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  url: string,
  activeWorkspaceId: string | undefined,
  body?: unknown
): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  
  if (activeWorkspaceId) {
    headers["X-Workspace-Id"] = activeWorkspaceId;
  }
  
  return fetch(url, {
    method,
    headers,
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  });
}
