import {
  useListNominations,
  useSubmitNomination,
  useDeleteNomination,
  getListNominationsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

export function useNominations(groupId: number) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useListNominations(groupId, {
    query: { queryKey: getListNominationsQueryKey(groupId), enabled: !!groupId },
  });

  const nominations = data ?? [];

  const addMutation = useSubmitNomination({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: getListNominationsQueryKey(groupId),
        });
      },
    },
  });

  const deleteMutation = useDeleteNomination({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: getListNominationsQueryKey(groupId),
        });
      },
    },
  });

  const add = (
    imdbId: string,
    title: string,
    year: string,
    poster?: string,
  ) =>
    addMutation.mutate({
      groupId,
      data: { imdbId, title, year, poster },
    });

  const remove = (nominationId: number) =>
    deleteMutation.mutate({ groupId, nominationId });

  return {
    nominations,
    isLoading,
    add,
    remove,
    isAdding: addMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
