export * from "./generated/api";
export * from "./generated/api.schemas";
export { setBaseUrl, setAuthTokenGetter } from "./custom-fetch";
export type { AuthTokenGetter } from "./custom-fetch";

// Verdict terminology aliases (votes → verdicts rename)
export {
  useSubmitVote as useSubmitVerdict,
  useGetResults as useGetVerdicts,
} from "./generated/api";

export type {
  SubmitVoteBody as SubmitVerdictBody,
  SubmitVoteMutationResult as SubmitVerdictMutationResult,
  SubmitVoteMutationError as SubmitVerdictMutationError,
} from "./generated/api";
