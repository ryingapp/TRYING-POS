import { QueryClient, QueryFunction } from "@tanstack/react-query";

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const token = localStorage.getItem("auth_token");
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  // Also send restaurant/branch context for legacy support
  const saved = localStorage.getItem("auth_user");
  if (saved) {
    try {
      const user = JSON.parse(saved);
      if (user.restaurantId) headers["X-Restaurant-Id"] = user.restaurantId;
    } catch {}
  }
  return headers;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    // Auto-logout on 401 (expired/invalid token)
    if (res.status === 401) {
      const isAuthRoute = window.location.pathname === "/login" || window.location.pathname === "/register";
      if (!isAuthRoute) {
        localStorage.removeItem("auth_user");
        localStorage.removeItem("auth_token");
        localStorage.removeItem("last_branch_id");
        window.location.href = "/login";
        return;
      }
    }
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
  retries = 3,
): Promise<Response> {
  const authHeaders = getAuthHeaders();
  const res = await fetch(url, {
    method,
    headers: {
      ...(data ? { "Content-Type": "application/json" } : {}),
      ...authHeaders,
    },
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  // Handle rate limiting with exponential backoff
  if (res.status === 429 && retries > 0) {
    const delay = Math.pow(2, 3 - retries) * 1000; // 1s, 2s, 4s
    await new Promise(resolve => setTimeout(resolve, delay));
    return apiRequest(method, url, data, retries - 1);
  }

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const authHeaders = getAuthHeaders();
    
    const fetchWithRetry = async (retries = 3): Promise<Response> => {
      const res = await fetch(queryKey.join("/") as string, {
        credentials: "include",
        headers: authHeaders,
      });
      
      // Handle rate limiting with exponential backoff
      if (res.status === 429 && retries > 0) {
        const delay = Math.pow(2, 3 - retries) * 1000; // 1s, 2s, 4s
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchWithRetry(retries - 1);
      }
      
      return res;
    };
    
    const res = await fetchWithRetry();

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
      refetchOnWindowFocus: true,
      staleTime: 30_000, // 30 seconds - data auto-refreshes
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
