import { useQuery } from "@tanstack/react-query";

interface ScheduleEntry {
  weekOf: string;
  pickerUserId: number | null;
  pickerUsername: string | null;
  movie: {
    id: number;
    title: string;
    weekOf: string;
    poster?: string | null;
  } | null;
  reviewUnlockedByAdmin: boolean;
  movieUnlockedByAdmin: boolean;
  extendedDays: number;
  startOffsetDays: number;
  deadlineMs: number;
}

interface AdminScheduleResult {
  schedule: ScheduleEntry[];
  members: { id: number; username: string }[];
  currentTurnWeekOf?: string;
  centerWeekOf?: string;
}

async function fetchAdminSchedule(
  groupId: number,
  centerWeekOf?: string,
): Promise<AdminScheduleResult> {
  const url = centerWeekOf
    ? `/api/admin/groups/${groupId}/schedule?centerWeekOf=${encodeURIComponent(centerWeekOf)}`
    : `/api/admin/groups/${groupId}/schedule`;
  const res = await fetch(url, { credentials: "include" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new Error(
      typeof data.error === "string" ? data.error : "Request failed",
    );
  return data as AdminScheduleResult;
}

export function usePickerSchedule(groupId: number, centerWeekOf?: string) {
  const { data, isLoading, refetch, isError } = useQuery({
    queryKey: ["adminSchedule", groupId, centerWeekOf],
    queryFn: () => fetchAdminSchedule(groupId, centerWeekOf),
    enabled: !!groupId,
  });

  return {
    schedule: data?.schedule ?? [],
    members: data?.members ?? [],
    currentTurnWeekOf: data?.currentTurnWeekOf ?? null,
    isLoading,
    isError,
    refetch,
  };
}
