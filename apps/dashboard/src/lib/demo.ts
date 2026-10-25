import { useQuery } from "@tanstack/react-query";
import { api } from "./api";

export type DemoConfig =
  | { demoMode: false }
  | { demoMode: true; password: string; accounts: Array<{ email: string; role: string }>; resetsDaily: boolean };

/** Whether the server runs as a public demo (one-click logins, read-only knowledge base, nightly reset). */
export function useDemoConfig() {
  return useQuery({
    queryKey: ["demo-config"],
    queryFn: () => api<DemoConfig>("/demo/config"),
    staleTime: Infinity,
    retry: false,
  });
}
