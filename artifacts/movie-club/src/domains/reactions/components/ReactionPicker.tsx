import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useStickers } from "../hooks/useStickers";
import { useReactionDetails } from "../hooks/useReactions";
import type { ReactionSummary, Sticker } from "../types";
import { Check } from "lucide-react";

interface ReactionPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: number;
  entityType: string;
  entityId: number;
  onSelect: (sticker: Sticker) => void;
  existingReactions: ReactionSummary[];
}

export function ReactionPicker({
  open,
  onOpenChange,
  groupId,
  entityType,
  entityId,
  onSelect,
  existingReactions,
}: ReactionPickerProps) {
  const { data, isLoading } = useStickers(groupId);
  const { data: detailsData } = useReactionDetails(entityType, entityId);

  const stickers = data?.stickers ?? [];
  const allReactions = detailsData?.reactions ?? [];
  const userReactedIds = new Set(
    existingReactions.filter((r) => r.userReacted).map((r) => r.stickerId)
  );

  const stickerGroups = existingReactions
    .filter((r) => r.count > 0)
    .map((r) => {
      const detailUsers = allReactions
        .filter((d) => d.stickerId === r.stickerId)
        .map((d) => ({ userId: d.userId, username: d.username }));
      return {
        stickerId: r.stickerId,
        name: r.name,
        imageUrl: r.imageUrl,
        count: r.count,
        users: detailUsers,
      };
    });

  const handleSelect = (sticker: Sticker) => {
    onSelect(sticker);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[70vh] max-h-[500px] rounded-t-2xl">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-primary font-black uppercase">
            Reactions
          </SheetTitle>
        </SheetHeader>

        {isLoading ? (
          <div className="grid grid-cols-6 sm:grid-cols-8 gap-3 p-2">
            {Array.from({ length: 16 }).map((_, i) => (
              <div
                key={i}
                className="aspect-square bg-white/10 animate-pulse rounded-lg"
              />
            ))}
          </div>
        ) : stickers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-white/60">
            <p>No stickers available</p>
            <p className="text-sm mt-1">Ask an admin to add some!</p>
          </div>
        ) : (
          <div className="overflow-y-auto max-h-[calc(100%-60px)] space-y-4">
            {stickerGroups.length > 0 && (
              <div className="space-y-3 pb-3 border-b border-white/10">
                <p className="text-xs text-white/50 uppercase tracking-wide font-medium">
                  Who reacted
                </p>
                {stickerGroups.map((group) => (
                  <div key={group.stickerId} className="flex items-start gap-2">
                    <img
                      src={group.imageUrl}
                      alt={group.name}
                      className="w-5 h-5 object-contain mt-0.5"
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {group.users.length > 0 ? (
                        group.users.map((user) => (
                          <span
                            key={user.userId}
                            className="px-2 py-0.5 bg-white/10 rounded-full text-xs text-white"
                          >
                            {user.username}
                          </span>
                        ))
                      ) : (
                        <span className="px-2 py-0.5 bg-white/10 rounded-full text-xs text-white/50">
                          {group.count} {group.count === 1 ? "person" : "people"}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div>
              <p className="text-xs text-white/50 uppercase tracking-wide font-medium mb-3">
                Add a reaction
              </p>
              <div className="grid grid-cols-6 sm:grid-cols-8 gap-3">
                {stickers.map((sticker) => {
                  const isSelected = userReactedIds.has(sticker.id);
                  return (
                    <button
                      key={sticker.id}
                      onClick={() => handleSelect(sticker)}
                      className={`
                        relative aspect-square p-1 rounded-lg transition-all
                        hover:bg-white/10 active:scale-95
                        ${isSelected ? "ring-2 ring-primary" : ""}
                      `}
                      title={sticker.name}
                    >
                      <img
                        src={sticker.imageUrl}
                        alt={sticker.name}
                        className="w-full h-full object-contain"
                      />
                      {isSelected && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                          <Check className="w-3 h-3 text-secondary" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
