import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,       // data fresh for 60 s — no refetch on quick nav back
      gcTime: 10 * 60 * 1000, // keep unused cache 10 min so navigating back is instant
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
