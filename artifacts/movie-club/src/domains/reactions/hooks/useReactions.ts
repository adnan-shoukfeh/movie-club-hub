import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactionSummary, ReactionDetail, ToggleReactionResult } from "../types";

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

export function useReactions(entityType: string, entityId: number) {
  return useQuery({
    queryKey: ["reactions", entityType, entityId],
    queryFn: () =>
      fetchJson<{ reactions: ReactionSummary[] }>(
        `${BASE_URL}/reactions?entityType=${entityType}&entityId=${entityId}`
      ),
    enabled: !!entityId,
  });
}

export function useReactionDetails(entityType: string, entityId: number) {
  return useQuery({
    queryKey: ["reactions", "details", entityType, entityId],
    queryFn: () =>
      fetchJson<{ reactions: ReactionDetail[] }>(
        `${BASE_URL}/reactions/details?entityType=${entityType}&entityId=${entityId}`
      ),
    enabled: !!entityId,
  });
}

export function useToggleReaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      entityType,
      entityId,
      stickerId,
    }: {
      entityType: string;
      entityId: number;
      stickerId: number;
    }) =>
      fetchJson<ToggleReactionResult>(`${BASE_URL}/reactions/toggle`, {
        method: "POST",
        body: JSON.stringify({ entityType, entityId, stickerId }),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["reactions", variables.entityType, variables.entityId],
      });
    },
  });
}

export function getReactionsQueryKey(entityType: string, entityId: number) {
  return ["reactions", entityType, entityId] as const;
}
