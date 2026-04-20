import { Lock, Unlock } from "lucide-react";

interface UnlockControlsProps {
  movieUnlocked: boolean;
  reviewUnlocked: boolean;
  onToggleMovie: () => void;
  onToggleReview: () => void;
}

/** Per-row movie and review unlock toggle buttons used inside PickerScheduleEditor. */
export function UnlockControls({
  movieUnlocked,
  reviewUnlocked,
  onToggleMovie,
  onToggleReview,
}: UnlockControlsProps) {
  return (
    <>
      <button
        className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md border transition-colors ${
          movieUnlocked
            ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/25"
            : "bg-muted/30 text-muted-foreground border-border/40 hover:bg-muted/50"
        }`}
        onClick={onToggleMovie}
      >
        {movieUnlocked ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
        Movie
      </button>

      <button
        className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md border transition-colors ${
          reviewUnlocked
            ? "bg-green-500/15 text-green-400 border-green-500/30 hover:bg-green-500/25"
            : "bg-muted/30 text-muted-foreground border-border/40 hover:bg-muted/50"
        }`}
        onClick={onToggleReview}
      >
        {reviewUnlocked ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
        Reviews
      </button>
    </>
  );
}
