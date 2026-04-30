import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useReactionDetails } from "../hooks/useReactions";
import type { ReactionSummary, ReactionDetail } from "../types";
import { User } from "lucide-react";

interface ReactionViewAllProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: string;
  entityId: number;
  selectedSticker: ReactionSummary | null;
}

export function ReactionViewAll({
  open,
  onOpenChange,
  entityType,
  entityId,
  selectedSticker,
}: ReactionViewAllProps) {
  const { data, isLoading } = useReactionDetails(entityType, entityId);

  const allReactions = data?.reactions ?? [];

  const filteredReactions = selectedSticker
    ? allReactions.filter((r) => r.stickerId === selectedSticker.stickerId)
    : allReactions;

  const groupedBySticker = allReactions.reduce(
    (acc, reaction) => {
      if (!acc[reaction.stickerId]) {
        acc[reaction.stickerId] = {
          stickerId: reaction.stickerId,
          name: reaction.stickerName,
          imageUrl: reaction.imageUrl,
          users: [],
        };
      }
      acc[reaction.stickerId].users.push({
        userId: reaction.userId,
        username: reaction.username,
      });
      return acc;
    },
    {} as Record<
      number,
      {
        stickerId: number;
        name: string;
        imageUrl: string;
        users: { userId: number; username: string }[];
      }
    >
  );

  const stickerGroups = Object.values(groupedBySticker);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[50vh] max-h-[350px] rounded-t-2xl">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-primary font-black uppercase flex items-center gap-2">
            {selectedSticker ? (
              <>
                <img
                  src={selectedSticker.imageUrl}
                  alt={selectedSticker.name}
                  className="w-6 h-6 object-contain"
                />
                {selectedSticker.name} ({selectedSticker.count})
              </>
            ) : (
              "All Reactions"
            )}
          </SheetTitle>
        </SheetHeader>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-12 bg-white/10 animate-pulse rounded-lg"
              />
            ))}
          </div>
        ) : filteredReactions.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-white/60">
            No reactions yet
          </div>
        ) : selectedSticker ? (
          <div className="overflow-y-auto max-h-[calc(100%-60px)] space-y-2">
            {filteredReactions.map((reaction) => (
              <div
                key={reaction.id}
                className="flex items-center gap-3 p-3 bg-white/5 rounded-lg"
              >
                <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <span className="text-white font-medium">{reaction.username}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-y-auto max-h-[calc(100%-60px)] space-y-4">
            {stickerGroups.map((group) => (
              <div key={group.stickerId} className="space-y-2">
                <div className="flex items-center gap-2 text-white/60 text-sm">
                  <img
                    src={group.imageUrl}
                    alt={group.name}
                    className="w-5 h-5 object-contain"
                  />
                  <span>{group.name}</span>
                  <span>({group.users.length})</span>
                </div>
                <div className="flex flex-wrap gap-2 pl-7">
                  {group.users.map((user) => (
                    <span
                      key={user.userId}
                      className="px-3 py-1 bg-white/10 rounded-full text-sm text-white"
                    >
                      {user.username}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
