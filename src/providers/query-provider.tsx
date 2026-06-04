"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState } from "react"

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 1000, // 5 seconds — keep data fresh but not stale for too long
            gcTime: 5 * 60 * 1000, // 5 minutes garbage collection
            retry: 1,
            refetchOnWindowFocus: true, // Refetch when user returns to the tab
            refetchOnReconnect: true, // Refetch when network reconnects
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}
