import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    // Try to parse JSON error response
    try {
      const json = JSON.parse(text);
      if (json.error) {
        throw new Error(json.error);
      }
    } catch (e) {
      // Not JSON or no error field, use raw text
    }
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";

function buildUrl(queryKey: readonly unknown[]): string {
  // First element is the base URL
  const base = queryKey[0];
  
  if (typeof base !== "string") {
    throw new Error("Invalid queryKey: first element must be a string URL");
  }
  
  if (queryKey.length === 1) {
    return base;
  }
  
  const second = queryKey[1];
  
  // If second element is an object → query params only, ignore rest
  if (second && typeof second === "object" && !Array.isArray(second)) {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(second)) {
      if (value !== undefined && value !== null && value !== "") {
        qs.set(key, String(value));
      }
    }
    const queryString = qs.toString();
    return queryString ? `${base}?${queryString}` : base;
  }
  
  // Check if we have path segments after a potential ID
  // Pattern: ["/api/resource", id, "subresource"] → /api/resource/id/subresource
  // vs Pattern: ["/api/resource", workspaceId] → /api/resource (workspaceId is cache key only)
  // Heuristic: if there are 3+ elements and the 3rd is a short lowercase string, it's a path segment
  if (queryKey.length >= 3) {
    const third = queryKey[2];
    if (typeof third === "string" && /^[a-z][a-z-]*$/.test(third)) {
      // This looks like a sub-resource path like "sources", "taxonomy", "stories"
      const pathParts = queryKey.slice(1).filter(k => typeof k === "string");
      return `${base}/${pathParts.join("/")}`;
    }
  }
  
  // Default: primitive second element is a cache key only, not a URL part
  return base;
}

export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = buildUrl(queryKey);
    const res = await fetch(url, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: true, // Re-fetch when user returns to tab
      refetchOnMount: true, // Always refetch when component mounts
      staleTime: 5000, // Data becomes stale after 5 seconds
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
