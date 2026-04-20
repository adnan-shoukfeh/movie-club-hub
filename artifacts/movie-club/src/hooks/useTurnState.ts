import { useGetGroup, useGetGroupStatus } from "@workspace/api-client-react";

interface TurnState {
  currentWeekOf: string | null;
  deadlineMs: number | null;
  isVotingOpen: boolean;
  isResultsAvailable: boolean;
  turnLengthDays: number;
  startDate: string | null;
  userIsPicker: boolean;
  pickerUsername: string | null;
}

export function useTurnState(
  groupId: number,
  currentUserId?: number,
): TurnState {
  const { data: group } = useGetGroup(groupId, {}, {
    query: { enabled: !!groupId },
  });
  const { data: status } = useGetGroupStatus(groupId, {}, {
    query: { enabled: !!groupId },
  });

  const currentWeekOf = group?.currentTurnWeekOf ?? null;
  const deadlineMs = status?.deadlineMs ?? null;
  const isVotingOpen = status?.votingOpen ?? group?.votingOpen ?? false;
  const isResultsAvailable =
    status?.resultsAvailable ?? group?.resultsAvailable ?? false;
  const turnLengthDays = status?.turnLengthDays ?? group?.turnLengthDays ?? 7;
  const startDate = status?.startDate ?? group?.startDate ?? null;
  const pickerUserId = group?.pickerUserId ?? status?.pickerUserId ?? null;
  const pickerUsername =
    group?.pickerUsername ?? status?.pickerUsername ?? null;
  const userIsPicker =
    currentUserId !== undefined && pickerUserId !== null
      ? pickerUserId === currentUserId
      : false;

  return {
    currentWeekOf,
    deadlineMs,
    isVotingOpen,
    isResultsAvailable,
    turnLengthDays,
    startDate,
    userIsPicker,
    pickerUsername,
  };
}
