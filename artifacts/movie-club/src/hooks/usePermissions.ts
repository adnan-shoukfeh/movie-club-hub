import { useGetMe, useGetGroup, getGetGroupQueryKey } from "@workspace/api-client-react";

export function usePermissions(groupId: number) {
  const { data: me } = useGetMe();
  const { data: group } = useGetGroup(groupId, {}, {
    query: { queryKey: getGetGroupQueryKey(groupId), enabled: !!groupId },
  });

  const role = group?.myRole ?? "member";

  return {
    isAdmin: role === "admin" || role === "owner",
    isOwner: role === "owner",
    isMember: !!group,
    currentUserId: me?.id,
    role,
  };
}
