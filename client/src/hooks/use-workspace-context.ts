import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./use-auth";

export interface WorkspaceMembership {
  workspaceId: string;
  name: string;
  role: string;
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
  counts: {
    topicsCount: number;
    targetsCount: number;
    sourcesCount: number;
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
    isLoading: query.isLoading,
    isError: query.isError,
  });
  
  return {
    ...query,
    activeWorkspaceId: query.data?.activeWorkspaceId,
    activeWorkspaceName: activeWorkspace?.name,
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
