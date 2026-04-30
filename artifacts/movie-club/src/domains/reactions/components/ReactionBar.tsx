import { Plus } from "lucide-react";
import { useState } from "react";
import { useReactions, useToggleReaction } from "../hooks/useReactions";
import { ReactionPicker } from "./ReactionPicker";
import { ReactionViewAll } from "./ReactionViewAll";
import type { ReactionSummary } from "../types";

interface ReactionBarProps {
  entityType: string;
  entityId: number;
  groupId: number;
}

export function ReactionBar({ entityType, entityId, groupId }: ReactionBarProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [viewAllOpen, setViewAllOpen] = useState(false);
  const [selectedSticker, setSelectedSticker] = useState<ReactionSummary | null>(null);

  const { data, isLoading } = useReactions(entityType, entityId);
  const toggleReaction = useToggleReaction();

  const reactions = data?.reactions ?? [];

  const handleStickerSelect = (stickerId: number) => {
    toggleReaction.mutate({ entityType, entityId, stickerId });
    setPickerOpen(false);
  };

  const handleReactionClick = (reaction: ReactionSummary) => {
    if (reaction.userReacted) {
      toggleReaction.mutate({ entityType, entityId, stickerId: reaction.stickerId });
    } else {
      setSelectedSticker(reaction);
      setViewAllOpen(true);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 mt-3">
        <div className="h-8 w-20 bg-white/10 animate-pulse rounded" />
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        {reactions.map((reaction) => (
          <button
            key={reaction.stickerId}
            onClick={() => handleReactionClick(reaction)}
            className={`
              flex items-center gap-1.5 px-2 py-1 rounded-full text-sm
              transition-all
              ${
                reaction.userReacted
                  ? "bg-primary/20 border-2 border-primary"
                  : "bg-white/10 border-2 border-transparent hover:border-white/30"
              }
            `}
          >
            <img
              src={reaction.imageUrl}
              alt={reaction.name}
              className="w-5 h-5 object-contain"
            />
            <span className="text-white font-medium">{reaction.count}</span>
          </button>
        ))}

        <button
          onClick={() => setPickerOpen(true)}
          className="flex items-center justify-center w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 transition-colors border-2 border-transparent hover:border-white/30"
          aria-label="Add reaction"
        >
          <Plus className="w-4 h-4 text-white" />
        </button>
      </div>

      <ReactionPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        groupId={groupId}
        onSelect={handleStickerSelect}
        existingReactions={reactions}
      />

      <ReactionViewAll
        open={viewAllOpen}
        onOpenChange={setViewAllOpen}
        entityType={entityType}
        entityId={entityId}
        selectedSticker={selectedSticker}
      />
    </>
  );
}
