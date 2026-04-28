import { useRef, useEffect } from "react";

const ITEM_H = 48;

interface WheelPickerProps {
  items: string[];
  selectedIndex: number;
  onIndexChange: (idx: number) => void;
  disabled?: boolean;
}

export function WheelPicker({
  items,
  selectedIndex,
  onIndexChange,
  disabled = false,
}: WheelPickerProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const suppressRef = useRef(false);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    suppressRef.current = true;
    el.scrollTop = selectedIndex * ITEM_H;
    const t = setTimeout(() => {
      suppressRef.current = false;
    }, 80);
    return () => clearTimeout(t);
  }, [selectedIndex]);

  const handleScroll = () => {
    if (suppressRef.current) return;
    if (scrollTimer.current) clearTimeout(scrollTimer.current);
    scrollTimer.current = setTimeout(() => {
      const el = listRef.current;
      if (!el) return;
      const idx = Math.min(
        items.length - 1,
        Math.max(0, Math.round(el.scrollTop / ITEM_H))
      );
      onIndexChange(idx);
    }, 80);
  };

  return (
    <div
      className={`relative select-none ${disabled ? "opacity-30 pointer-events-none" : ""}`}
      style={{ width: 64, height: ITEM_H * 3 }}
    >
      {/* Selection highlight */}
      <div
        className="absolute inset-x-0 z-10 pointer-events-none border-y-4 border-primary bg-primary/20"
        style={{ top: ITEM_H, height: ITEM_H }}
      />
      {/* Top fade */}
      <div className="absolute inset-x-0 top-0 h-12 z-10 pointer-events-none bg-gradient-to-b from-card to-transparent" />
      {/* Bottom fade */}
      <div className="absolute inset-x-0 bottom-0 h-12 z-10 pointer-events-none bg-gradient-to-t from-card to-transparent" />
      {/* Scrollable list */}
      <div
        ref={listRef}
        onScroll={handleScroll}
        className="absolute inset-0 overflow-y-scroll"
        style={{
          scrollbarWidth: "none",
          scrollSnapType: "y mandatory",
          WebkitOverflowScrolling: "touch",
        } as React.CSSProperties}
      >
        <div style={{ height: ITEM_H }} />
        {items.map((item, i) => (
          <div
            key={i}
            style={{ height: ITEM_H, scrollSnapAlign: "center" }}
            className="flex items-center justify-center cursor-pointer"
            onClick={() => {
              onIndexChange(i);
              suppressRef.current = true;
              listRef.current?.scrollTo({ top: i * ITEM_H, behavior: "smooth" });
              setTimeout(() => {
                suppressRef.current = false;
              }, 400);
            }}
          >
            <span
              className={`font-black tabular-nums transition-all duration-150 ${
                i === selectedIndex
                  ? "text-primary text-3xl"
                  : Math.abs(i - selectedIndex) === 1
                  ? "text-white/50 text-xl"
                  : "text-white/20 text-lg"
              }`}
            >
              {item}
            </span>
          </div>
        ))}
        <div style={{ height: ITEM_H }} />
      </div>
    </div>
  );
}

export const INT_ITEMS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
export const DEC_ITEMS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];
