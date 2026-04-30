import { useQuery } from "@tanstack/react-query";
import type { Sticker } from "../types";

const BASE_URL = "/api";

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || `HTTP ${res.status}`);
  }
  return res.json();
}

interface StickersResponse {
  stickers: Sticker[];
  globalStickers: Sticker[];
  groupStickers: Sticker[];
}

export function useStickers(groupId: number) {
  return useQuery({
    queryKey: ["stickers", groupId],
    queryFn: () =>
      fetchJson<StickersResponse>(`${BASE_URL}/groups/${groupId}/stickers`),
    enabled: !!groupId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useGlobalStickers() {
  return useQuery({
    queryKey: ["stickers", "global"],
    queryFn: () => fetchJson<{ stickers: Sticker[] }>(`${BASE_URL}/stickers`),
    staleTime: 5 * 60 * 1000,
  });
}
