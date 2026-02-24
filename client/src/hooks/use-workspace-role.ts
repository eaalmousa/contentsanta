import { useWorkspaceContext } from "./use-workspace-context";

/**
 * Hook to get user's role in active workspace
 * Returns role and permission checks
 */
export function useWorkspaceRole() {
  const { data: context, isLoading } = useWorkspaceContext();
  
  // Get role from first membership (active workspace)
  const membership = context?.memberships?.[0];
  const role = membership?.role || "viewer";
  
  // Permission checks
  const isAdmin = role === "admin" || role === "owner";
  const isEditor = role === "editor" || isAdmin;
  const canEditSources = isAdmin;
  const canEditTopics = isEditor;
  const canPublish = isEditor;
  
  return {
    role,
    isLoading,
    isAdmin,
    isEditor,
    canEditSources,
    canEditTopics,
    canPublish,
    membership,
  };
}
