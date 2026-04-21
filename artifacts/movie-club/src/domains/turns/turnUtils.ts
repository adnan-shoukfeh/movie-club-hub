import type { GroupDetailTurnConfig } from "@workspace/api-client-react";

export function getTurnIndexForDate(dateStr: string, config: GroupDetailTurnConfig): number {
  const target = new Date(dateStr + "T00:00:00.000Z").getTime();
  const start = new Date(config.startDate + "T00:00:00.000Z").getTime();
  if (target < start) return 0;
  let idx = 0;
  let elapsed = 0;
  while (true) {
    const ext = config.extensions?.find((e) => e.turnIndex === idx);
    const turnDays = config.turnLengthDays + (ext?.extraDays ?? 0);
    const turnStartMs = start + elapsed * 86400000;
    const turnEndMs = turnStartMs + turnDays * 86400000;
    if (target < turnEndMs) return idx;
    elapsed += turnDays;
    idx++;
    if (idx > 10000) return idx;
  }
}

export function getTurnStartDate(turnIndex: number, config: GroupDetailTurnConfig): string {
  const start = new Date(config.startDate + "T00:00:00.000Z");
  let total = 0;
  for (let i = 0; i < turnIndex; i++) {
    const ext = config.extensions?.find((e) => e.turnIndex === i);
    total += config.turnLengthDays + (ext?.extraDays ?? 0);
  }
  start.setUTCDate(start.getUTCDate() + total);
  return start.toISOString().slice(0, 10);
}

export function offsetWeekOf(weekOf: string, offset: number, config: GroupDetailTurnConfig): string {
  const start = new Date(config.startDate + "T00:00:00.000Z").getTime();
  const target = new Date(weekOf + "T00:00:00.000Z").getTime();
  if (target < start) {
    const idx = Math.max(0, offset);
    return getTurnStartDate(idx, config);
  }
  const idx = getTurnIndexForDate(weekOf, config);
  const newIdx = Math.max(0, idx + offset);
  return getTurnStartDate(newIdx, config);
}
