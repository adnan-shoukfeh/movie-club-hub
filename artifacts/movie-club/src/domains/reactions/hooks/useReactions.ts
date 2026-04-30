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

interface ToggleReactionVariables {
  entityType: string;
  entityId: number;
  stickerId: number;
  stickerName?: string;
  stickerImageUrl?: string;
  userId?: number;
  username?: string;
}

export function useToggleReaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ entityType, entityId, stickerId }: ToggleReactionVariables) =>
      fetchJson<ToggleReactionResult>(`${BASE_URL}/reactions/toggle`, {
        method: "POST",
        body: JSON.stringify({ entityType, entityId, stickerId }),
      }),
    onMutate: async (variables) => {
      const { entityType, entityId, stickerId, stickerName, stickerImageUrl, userId, username } = variables;

      await queryClient.cancelQueries({ queryKey: ["reactions", entityType, entityId] });
      await queryClient.cancelQueries({ queryKey: ["reactions", "details", entityType, entityId] });

      const previousSummary = queryClient.getQueryData<{ reactions: ReactionSummary[] }>(
        ["reactions", entityType, entityId]
      );
      const previousDetails = queryClient.getQueryData<{ reactions: ReactionDetail[] }>(
        ["reactions", "details", entityType, entityId]
      );

      if (previousSummary) {
        queryClient.setQueryData<{ reactions: ReactionSummary[] }>(
          ["reactions", entityType, entityId],
          (old) => {
            if (!old) return old;
            const existingReaction = old.reactions.find((r) => r.stickerId === stickerId);
            if (existingReaction?.userReacted) {
              if (existingReaction.count === 1) {
                return { reactions: old.reactions.filter((r) => r.stickerId !== stickerId) };
              }
              return {
                reactions: old.reactions.map((r) =>
                  r.stickerId === stickerId ? { ...r, count: r.count - 1, userReacted: false } : r
                ),
              };
            } else if (existingReaction) {
              return {
                reactions: old.reactions.map((r) =>
                  r.stickerId === stickerId ? { ...r, count: r.count + 1, userReacted: true } : r
                ),
              };
            } else if (stickerName && stickerImageUrl) {
              return {
                reactions: [
                  ...old.reactions,
                  { stickerId, name: stickerName, imageUrl: stickerImageUrl, count: 1, userReacted: true },
                ],
              };
            }
            return old;
          }
        );
      }

      if (previousDetails && userId && username) {
        queryClient.setQueryData<{ reactions: ReactionDetail[] }>(
          ["reactions", "details", entityType, entityId],
          (old) => {
            if (!old) return old;
            const userReaction = old.reactions.find((r) => r.stickerId === stickerId && r.userId === userId);
            if (userReaction) {
              return { reactions: old.reactions.filter((r) => !(r.stickerId === stickerId && r.userId === userId)) };
            } else if (stickerName && stickerImageUrl) {
              return {
                reactions: [
                  ...old.reactions,
                  { id: -Date.now(), stickerId, stickerName, imageUrl: stickerImageUrl, userId, username },
                ],
              };
            }
            return old;
          }
        );
      }

      return { previousSummary, previousDetails };
    },
    onError: (_, variables, context) => {
      if (context?.previousSummary) {
        queryClient.setQueryData(["reactions", variables.entityType, variables.entityId], context.previousSummary);
      }
      if (context?.previousDetails) {
        queryClient.setQueryData(
          ["reactions", "details", variables.entityType, variables.entityId],
          context.previousDetails
        );
      }
    },
    onSettled: (_, __, variables) => {
      queryClient.invalidateQueries({ queryKey: ["reactions", variables.entityType, variables.entityId] });
      queryClient.invalidateQueries({ queryKey: ["reactions", "details", variables.entityType, variables.entityId] });
    },
  });
}

export function getReactionsQueryKey(entityType: string, entityId: number) {
  return ["reactions", entityType, entityId] as const;
}
