import { useGetGroup } from "@workspace/api-client-react";
import type { Member } from "@workspace/api-client-react";

export function useGroupMembers(groupId: number) {
  const { data, isLoading, refetch } = useGetGroup(groupId, {}, {
    query: { enabled: !!groupId },
  });

  const members: Member[] = data?.members ?? [];

  return { members, isLoading, refetch };
}
