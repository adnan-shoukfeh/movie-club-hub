import { describe, it, expect } from "vitest";
import {
  normalizeWeekOf,
  getTurnIndexForDate,
  getTurnStartDate,
  offsetWeekOf,
} from "./turnUtils";
import type { GroupDetailTurnConfig } from "@workspace/api-client-react";

const baseConfig: GroupDetailTurnConfig = {
  startDate: "2024-01-01",
  turnLengthDays: 7,
  extensions: [],
};

const configWithExtension: GroupDetailTurnConfig = {
  startDate: "2024-01-01",
  turnLengthDays: 7,
  extensions: [{ turnIndex: 2, extraDays: 3 }],
};

const configWithMultipleExtensions: GroupDetailTurnConfig = {
  startDate: "2024-01-01",
  turnLengthDays: 7,
  extensions: [
    { turnIndex: 1, extraDays: 7 },
    { turnIndex: 3, extraDays: 14 },
  ],
};

describe("normalizeWeekOf", () => {
  it("returns empty string for empty input", () => {
    expect(normalizeWeekOf("")).toBe("");
  });

  it("keeps YYYY-MM-DD format unchanged", () => {
    expect(normalizeWeekOf("2024-04-22")).toBe("2024-04-22");
  });

  it("strips time from ISO datetime", () => {
    expect(normalizeWeekOf("2024-04-22T00:00:00.000Z")).toBe("2024-04-22");
  });

  it("strips timezone info", () => {
    expect(normalizeWeekOf("2024-04-22T15:30:00-05:00")).toBe("2024-04-22");
  });
});

describe("getTurnIndexForDate", () => {
  it("returns 0 for date on start date", () => {
    expect(getTurnIndexForDate("2024-01-01", baseConfig)).toBe(0);
  });

  it("returns 0 for date before start date", () => {
    expect(getTurnIndexForDate("2023-12-01", baseConfig)).toBe(0);
  });

  it("returns 0 for last day of turn 0", () => {
    expect(getTurnIndexForDate("2024-01-07", baseConfig)).toBe(0);
  });

  it("returns 1 for first day of turn 1", () => {
    expect(getTurnIndexForDate("2024-01-08", baseConfig)).toBe(1);
  });

  it("returns correct index for middle of turn", () => {
    expect(getTurnIndexForDate("2024-01-18", baseConfig)).toBe(2);
  });

  it("handles extensions correctly - date in extended portion", () => {
    // Turn 2 with extension is 10 days (Jan 15-24)
    expect(getTurnIndexForDate("2024-01-24", configWithExtension)).toBe(2);
  });

  it("handles extensions correctly - first day after extended turn", () => {
    // Turn 3 starts Jan 25 (after 10-day turn 2)
    expect(getTurnIndexForDate("2024-01-25", configWithExtension)).toBe(3);
  });

  it("handles boundary exactly at turn end", () => {
    // Turn 0 ends at start of Jan 8, so Jan 8 is turn 1
    expect(getTurnIndexForDate("2024-01-08", baseConfig)).toBe(1);
  });
});

describe("getTurnStartDate", () => {
  it("returns start date for turn 0", () => {
    expect(getTurnStartDate(0, baseConfig)).toBe("2024-01-01");
  });

  it("returns correct date for turn 1", () => {
    expect(getTurnStartDate(1, baseConfig)).toBe("2024-01-08");
  });

  it("returns correct date for turn 2", () => {
    expect(getTurnStartDate(2, baseConfig)).toBe("2024-01-15");
  });

  it("handles extensions - turn after extended turn", () => {
    // Turn 2 has 3 extra days (10 days total), so turn 3 starts day 24
    expect(getTurnStartDate(3, configWithExtension)).toBe("2024-01-25");
  });

  it("handles multiple extensions correctly", () => {
    // Turn 0: 7 days (Jan 1-7)
    // Turn 1: 14 days (Jan 8-21) - extended by 7
    // Turn 2: 7 days (Jan 22-28)
    // Turn 3: 21 days (Jan 29 - Feb 18) - extended by 14
    // Turn 4: 7 days (Feb 19-25)
    expect(getTurnStartDate(0, configWithMultipleExtensions)).toBe("2024-01-01");
    expect(getTurnStartDate(1, configWithMultipleExtensions)).toBe("2024-01-08");
    expect(getTurnStartDate(2, configWithMultipleExtensions)).toBe("2024-01-22");
    expect(getTurnStartDate(3, configWithMultipleExtensions)).toBe("2024-01-29");
    expect(getTurnStartDate(4, configWithMultipleExtensions)).toBe("2024-02-19");
  });
});

describe("offsetWeekOf", () => {
  it("returns next turn when offset is 1", () => {
    const result = offsetWeekOf("2024-01-08", 1, baseConfig);
    expect(result).toBe("2024-01-15"); // Turn 1 -> Turn 2
  });

  it("returns previous turn when offset is -1", () => {
    const result = offsetWeekOf("2024-01-15", -1, baseConfig);
    expect(result).toBe("2024-01-08"); // Turn 2 -> Turn 1
  });

  it("stays at turn 0 when going back from turn 0", () => {
    const result = offsetWeekOf("2024-01-01", -1, baseConfig);
    expect(result).toBe("2024-01-01"); // Can't go before turn 0
  });

  it("handles date before start date - going back stays at 0", () => {
    const result = offsetWeekOf("2023-12-01", -1, baseConfig);
    expect(result).toBe("2024-01-01"); // Clamps to turn 0
  });

  it("handles date before start date - going forward", () => {
    const result = offsetWeekOf("2023-12-01", 1, baseConfig);
    expect(result).toBe("2024-01-08"); // Goes to turn 1
  });

  it("handles multiple forward navigations", () => {
    let weekOf = "2024-01-01";
    weekOf = offsetWeekOf(weekOf, 1, baseConfig);
    expect(weekOf).toBe("2024-01-08");
    weekOf = offsetWeekOf(weekOf, 1, baseConfig);
    expect(weekOf).toBe("2024-01-15");
    weekOf = offsetWeekOf(weekOf, 1, baseConfig);
    expect(weekOf).toBe("2024-01-22");
  });

  it("round trip navigation returns to original turn", () => {
    const start = "2024-01-15"; // Turn 2
    let weekOf = start;

    // Go forward 3 turns
    weekOf = offsetWeekOf(weekOf, 1, baseConfig);
    weekOf = offsetWeekOf(weekOf, 1, baseConfig);
    weekOf = offsetWeekOf(weekOf, 1, baseConfig);

    // Go back 3 turns
    weekOf = offsetWeekOf(weekOf, -1, baseConfig);
    weekOf = offsetWeekOf(weekOf, -1, baseConfig);
    weekOf = offsetWeekOf(weekOf, -1, baseConfig);

    expect(weekOf).toBe(start);
  });

  it("works correctly with extensions", () => {
    // Turn 2 has extension, so turn 3 starts later
    let weekOf = "2024-01-15"; // Turn 2 start
    weekOf = offsetWeekOf(weekOf, 1, configWithExtension);
    expect(weekOf).toBe("2024-01-25"); // Turn 3 (after 10-day turn 2)

    weekOf = offsetWeekOf(weekOf, -1, configWithExtension);
    expect(weekOf).toBe("2024-01-15"); // Back to turn 2
  });
});

describe("navigation edge cases", () => {
  it("navigating back from turn 0 stays at turn 0", () => {
    const turn0Start = getTurnStartDate(0, baseConfig);
    const idx = getTurnIndexForDate(turn0Start, baseConfig);
    expect(idx).toBe(0);

    const backWeekOf = offsetWeekOf(turn0Start, -1, baseConfig);
    expect(backWeekOf).toBe(turn0Start);
  });

  it("forward then back returns to same turn", () => {
    const turns = [0, 1, 5, 10];

    for (const startTurn of turns) {
      const startDate = getTurnStartDate(startTurn, baseConfig);
      const forwardDate = offsetWeekOf(startDate, 1, baseConfig);
      const backDate = offsetWeekOf(forwardDate, -1, baseConfig);

      expect(backDate).toBe(startDate);
    }
  });

  it("handles extended turn boundaries correctly", () => {
    // Navigate into extended portion of turn 2
    const turn2Start = getTurnStartDate(2, configWithExtension);
    expect(turn2Start).toBe("2024-01-15");

    // A date in the extended portion should still be turn 2
    const extendedDate = "2024-01-24";
    const idx = getTurnIndexForDate(extendedDate, configWithExtension);
    expect(idx).toBe(2);

    // Going back should go to turn 1
    const backFromExtended = offsetWeekOf(extendedDate, -1, configWithExtension);
    expect(backFromExtended).toBe("2024-01-08"); // Turn 1
  });

  it("multiple rapid navigations work correctly", () => {
    let weekOf = "2024-01-22"; // Turn 3

    // Simulate rapid back-forward clicking
    weekOf = offsetWeekOf(weekOf, -1, baseConfig); // Turn 2
    weekOf = offsetWeekOf(weekOf, 1, baseConfig);  // Turn 3
    weekOf = offsetWeekOf(weekOf, -1, baseConfig); // Turn 2
    weekOf = offsetWeekOf(weekOf, -1, baseConfig); // Turn 1
    weekOf = offsetWeekOf(weekOf, 1, baseConfig);  // Turn 2
    weekOf = offsetWeekOf(weekOf, 1, baseConfig);  // Turn 3

    expect(weekOf).toBe("2024-01-22");
  });
});

describe("date normalization in comparisons", () => {
  it("normalized dates compare correctly", () => {
    const date1 = normalizeWeekOf("2024-01-15");
    const date2 = normalizeWeekOf("2024-01-15T00:00:00.000Z");
    expect(date1).toBe(date2);
  });

  it("lexicographic comparison works for normalized dates", () => {
    const earlier = normalizeWeekOf("2024-01-08");
    const later = normalizeWeekOf("2024-01-15");
    expect(earlier < later).toBe(true);
    expect(later > earlier).toBe(true);
    expect(earlier === later).toBe(false);
  });
});
