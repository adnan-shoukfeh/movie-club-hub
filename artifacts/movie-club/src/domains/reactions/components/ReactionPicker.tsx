import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useStickers } from "../hooks/useStickers";
import type { ReactionSummary, Sticker } from "../types";
import { Check } from "lucide-react";

interface ReactionPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: number;
  onSelect: (stickerId: number) => void;
  existingReactions: ReactionSummary[];
}

export function ReactionPicker({
  open,
  onOpenChange,
  groupId,
  onSelect,
  existingReactions,
}: ReactionPickerProps) {
  const { data, isLoading } = useStickers(groupId);

  const stickers = data?.stickers ?? [];
  const userReactedIds = new Set(
    existingReactions.filter((r) => r.userReacted).map((r) => r.stickerId)
  );

  const handleSelect = (sticker: Sticker) => {
    onSelect(sticker.id);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[60vh] max-h-[400px] rounded-t-2xl">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-primary font-black uppercase">
            Add Reaction
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
          <div className="overflow-y-auto max-h-[calc(100%-60px)]">
            <div className="grid grid-cols-6 sm:grid-cols-8 gap-3 p-2">
              {stickers.map((sticker) => {
                const isSelected = userReactedIds.has(sticker.id);
                return (
                  <button
                    key={sticker.id}
                    onClick={() => handleSelect(sticker)}
                    className={`
                      relative aspect-square p-2 rounded-lg transition-all
                      hover:bg-white/20 active:scale-95
                      ${isSelected ? "bg-primary/30 ring-2 ring-primary" : "bg-white/10"}
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
        )}
      </SheetContent>
    </Sheet>
  );
}
