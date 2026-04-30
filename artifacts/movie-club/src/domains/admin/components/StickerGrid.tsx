import { Trash2 } from "lucide-react";

interface Sticker {
  id: number;
  name: string;
  imageUrl: string;
  isGlobal: boolean;
}

interface StickerGridProps {
  stickers: Sticker[];
  onDelete?: (stickerId: number, name: string) => void;
  isDeleting?: number | null;
  emptyMessage?: string;
}

export function StickerGrid({
  stickers,
  onDelete,
  isDeleting,
  emptyMessage = "No stickers yet",
}: StickerGridProps) {
  if (stickers.length === 0) {
    return (
      <div className="text-center py-8 text-white/50">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
      {stickers.map((sticker) => (
        <div
          key={sticker.id}
          className="relative group aspect-square bg-card border-2 border-secondary rounded-lg overflow-hidden"
        >
          <img
            src={sticker.imageUrl}
            alt={sticker.name}
            className="w-full h-full object-contain p-1"
          />
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center">
            <span className="text-white text-xs font-bold truncate px-1 mb-1">
              {sticker.name}
            </span>
            {onDelete && (
              <button
                onClick={() => onDelete(sticker.id, sticker.name)}
                disabled={isDeleting === sticker.id}
                className="p-1.5 bg-red-500 rounded-full hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-3 h-3 text-white" />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
