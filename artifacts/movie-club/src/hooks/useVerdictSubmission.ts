import { useState } from "react";
import { useSubmitVote, useSetWatchStatus } from "@workspace/api-client-react";

export function useVerdictSubmission(groupId: number, weekOf: string) {
  const [watched, setWatched] = useState(false);
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");

  const submitMutation = useSubmitVote();
  const watchMutation = useSetWatchStatus();

  const submit = () =>
    submitMutation.mutate({
      groupId,
      data: { rating, review: review || undefined, weekOf },
    });

  const setWatch = (w: boolean) =>
    watchMutation.mutate({
      groupId,
      data: { watched: w, weekOf },
    });

  return {
    watched,
    setWatched,
    rating,
    setRating,
    review,
    setReview,
    submit,
    setWatch,
    isLoading: submitMutation.isPending || watchMutation.isPending,
    isError: submitMutation.isError || watchMutation.isError,
  };
}
