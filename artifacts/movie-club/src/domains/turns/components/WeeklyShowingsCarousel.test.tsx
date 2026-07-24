import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import type {
  GroupDetail,
  GroupStatus,
} from "@workspace/api-client-react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  getNavigableShowings,
  getWrappedShowingIndex,
  WeeklyShowingsCarousel,
} from "./WeeklyShowingsCarousel";

const schedule = [
  {
    weekOf: "2026-07-09",
    endDate: "2026-07-15",
    pickerUserId: 2,
    pickerUsername: "kai",
    isCurrent: false,
  },
  {
    weekOf: "2026-07-23",
    endDate: "2026-07-29",
    pickerUserId: 1,
    pickerUsername: "omar",
    isCurrent: true,
  },
  {
    weekOf: "2026-07-30",
    endDate: "2026-08-05",
    pickerUserId: null,
    pickerUsername: null,
    isCurrent: false,
  },
];

const group = {
  id: 7,
  name: "Thursday Night Cinema",
  weekOf: "2026-07-23",
  currentTurnWeekOf: "2026-07-23",
  pickerSchedule: schedule,
  movieData: {
    id: 12,
    weekOf: "2026-07-23",
    title: "Stalker",
    poster: "https://example.test/stalker.jpg",
  },
} as GroupDetail;

const status = {
  groupId: 7,
  weekOf: "2026-07-23",
  votingOpen: true,
  resultsAvailable: false,
} as GroupStatus;

describe("WeeklyShowingsCarousel helpers", () => {
  it("keeps every backend-navigable week and omits projected future slots", () => {
    const showings = getNavigableShowings(
      schedule,
      "2026-07-23",
      "2026-07-23",
    );

    expect(showings.map((showing) => showing.weekOf)).toEqual([
      "2026-07-09",
      "2026-07-23",
    ]);
  });

  it("wraps film-strip navigation in both directions", () => {
    expect(getWrappedShowingIndex(1, 1, 2)).toBe(0);
    expect(getWrappedShowingIndex(0, -1, 2)).toBe(1);
    expect(getWrappedShowingIndex(0, 1, 0)).toBe(-1);
  });
});

describe("WeeklyShowingsCarousel interactions", () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  const setReducedMotion = (reduced: boolean) => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches:
          reduced && query.includes("prefers-reduced-motion"),
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  };

  const render = (node: ReactNode) => {
    act(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          {node}
        </QueryClientProvider>,
      );
    });
  };

  beforeEach(() => {
    vi.useFakeTimers();
    setReducedMotion(false);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    queryClient.clear();
    container.remove();
    vi.useRealTimers();
  });

  it("combines the Now Showing heading and active recording state without a second indicator strip", () => {
    render(
      <WeeklyShowingsCarousel
        groupId={7}
        group={group}
        status={status}
        selectedWeek="2026-07-23"
        onWeekChange={vi.fn()}
      />,
    );

    expect(
      container.querySelector('[aria-roledescription="carousel"]'),
    ).toBeInTheDocument();
    expect(
      container.querySelectorAll(".weekly-showings-carousel__indicator"),
    ).toHaveLength(0);
    expect(container.textContent).toContain("Now Showing");
    expect(container.textContent).toContain("Stalker");
    expect(container.textContent).toContain("Rating open");
    expect(container.textContent).not.toContain("Pause");
  });

  it("uses the page week callback for transport controls", () => {
    const onWeekChange = vi.fn();
    render(
      <WeeklyShowingsCarousel
        groupId={7}
        group={group}
        status={status}
        selectedWeek="2026-07-23"
        onWeekChange={onWeekChange}
      />,
    );

    const next = container.querySelector<HTMLButtonElement>(
      '[aria-label="Next movie week"]',
    );
    expect(next).not.toBeNull();
    act(() => next?.click());

    expect(onWeekChange).toHaveBeenCalledTimes(1);
    expect(onWeekChange).toHaveBeenLastCalledWith("2026-07-09", 1);
  });

  it("supports keyboard transport without autoplay", () => {
    const onWeekChange = vi.fn();
    render(
      <WeeklyShowingsCarousel
        groupId={7}
        group={group}
        status={status}
        selectedWeek="2026-07-23"
        onWeekChange={onWeekChange}
      />,
    );

    const carousel = container.querySelector<HTMLElement>(
      '[aria-roledescription="carousel"]',
    );
    act(() => {
      carousel?.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ArrowLeft",
          bubbles: true,
        }),
      );
    });

    expect(onWeekChange).toHaveBeenCalledWith("2026-07-09", -1);
  });
});
