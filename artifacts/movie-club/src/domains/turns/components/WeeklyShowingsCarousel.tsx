import {
  FastForward,
  Rewind,
} from "lucide-react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "framer-motion";
import {
  getGetGroupQueryKey,
  getGetGroupStatusQueryKey,
} from "@workspace/api-client-react";
import type {
  GroupDetail,
  GroupDetailPickerScheduleItem,
  GroupStatus,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  KeyboardEvent,
  PointerEvent,
} from "react";
import {
  formatDateET,
  formatWeekdayShortDateET,
} from "@/lib/utils";
import { normalizeWeekOf } from "../turnUtils";

const SWIPE_THRESHOLD_PX = 64;

type Direction = -1 | 0 | 1;
type TransportState = "idle" | "play" | "rewind" | "forward";

export type WeeklyShowing = GroupDetailPickerScheduleItem;

interface WeeklyShowingsCarouselProps {
  groupId: number;
  group: GroupDetail;
  status?: GroupStatus;
  selectedWeek: string;
  onWeekChange: (week: string, direction?: Direction) => void;
  isNavigating?: boolean;
}

interface PointerStart {
  x: number;
  y: number;
  pointerId: number;
  startedOnControl: boolean;
}

/**
 * The group endpoint includes projected future picker slots, but the movie and
 * status endpoints intentionally clamp future dates back to the current turn.
 * This list therefore contains every week that can genuinely drive the page.
 */
export function getNavigableShowings(
  schedule: GroupDetailPickerScheduleItem[],
  currentWeek: string,
  selectedWeek: string,
): WeeklyShowing[] {
  const current = normalizeWeekOf(currentWeek);
  const selected = normalizeWeekOf(selectedWeek);
  const byWeek = new Map<string, WeeklyShowing>();

  for (const slot of schedule) {
    const week = normalizeWeekOf(slot.weekOf);
    if (!week || week > current) continue;
    byWeek.set(week, { ...slot, weekOf: week });
  }

  if (current && !byWeek.has(current)) {
    byWeek.set(current, {
      weekOf: current,
      endDate: current,
      pickerUserId: null,
      pickerUsername: null,
      isCurrent: true,
    });
  }

  if (selected && selected <= current && !byWeek.has(selected)) {
    byWeek.set(selected, {
      weekOf: selected,
      endDate: selected,
      pickerUserId: null,
      pickerUsername: null,
      isCurrent: selected === current,
    });
  }

  return [...byWeek.values()].sort((a, b) =>
    normalizeWeekOf(a.weekOf).localeCompare(normalizeWeekOf(b.weekOf)),
  );
}

export function getWrappedShowingIndex(
  currentIndex: number,
  direction: -1 | 1,
  count: number,
): number {
  if (count <= 0) return -1;
  return (currentIndex + direction + count) % count;
}

export function WeeklyShowingsCarousel({
  groupId,
  group,
  status,
  selectedWeek,
  onWeekChange,
  isNavigating = false,
}: WeeklyShowingsCarouselProps) {
  const queryClient = useQueryClient();
  const prefersReducedMotion = !!useReducedMotion();
  const pointerStartRef = useRef<PointerStart | null>(null);
  const transportTimerRef = useRef<number | null>(null);

  const [direction, setDirection] = useState<Direction>(1);
  const [transportState, setTransportState] =
    useState<TransportState>("idle");

  const currentWeek = normalizeWeekOf(group.currentTurnWeekOf);
  const normalizedSelectedWeek = normalizeWeekOf(selectedWeek);
  const showings = useMemo(
    () =>
      getNavigableShowings(
        group.pickerSchedule ?? [],
        currentWeek,
        normalizedSelectedWeek,
      ),
    [currentWeek, group.pickerSchedule, normalizedSelectedWeek],
  );
  const selectedIndex = Math.max(
    0,
    showings.findIndex(
      (slot) => normalizeWeekOf(slot.weekOf) === normalizedSelectedWeek,
    ),
  );
  const currentShowingIndex = showings.findIndex(
    (slot) => normalizeWeekOf(slot.weekOf) === currentWeek,
  );
  const selectedShowing = showings[selectedIndex];
  const isCurrentShowing =
    normalizeWeekOf(selectedShowing?.weekOf ?? "") === currentWeek;

  const groupForWeek = useCallback(
    (week: string) => {
      if (normalizeWeekOf(group.weekOf) === normalizeWeekOf(week)) return group;
      return queryClient.getQueryData<GroupDetail>([
        ...getGetGroupQueryKey(groupId),
        week,
      ]);
    },
    [group, groupId, queryClient],
  );

  const statusForWeek = useCallback(
    (week: string) => {
      if (normalizeWeekOf(status?.weekOf ?? "") === normalizeWeekOf(week)) {
        return status;
      }
      return queryClient.getQueryData<GroupStatus>([
        ...getGetGroupStatusQueryKey(groupId),
        week,
      ]);
    },
    [groupId, queryClient, status],
  );

  const selectedGroup = selectedShowing
    ? groupForWeek(selectedShowing.weekOf)
    : group;
  const selectedStatus = selectedShowing
    ? statusForWeek(selectedShowing.weekOf)
    : status;
  const selectedMovie = selectedGroup?.movieData;

  const settleTransport = useCallback((nextState: TransportState) => {
    if (transportTimerRef.current !== null) {
      window.clearTimeout(transportTimerRef.current);
    }
    setTransportState(nextState);
    transportTimerRef.current = window.setTimeout(() => {
      setTransportState("idle");
      transportTimerRef.current = null;
    }, 480);
  }, []);

  const navigateToIndex = useCallback(
    (targetIndex: number, nextDirection: -1 | 1) => {
      const target = showings[targetIndex];
      if (!target || isNavigating) return;

      setDirection(nextDirection);

      const targetIsCurrent =
        normalizeWeekOf(target.weekOf) === currentWeek;
      settleTransport(
        targetIsCurrent
          ? "play"
          : nextDirection < 0
            ? "rewind"
            : "forward",
      );

      if (normalizeWeekOf(target.weekOf) !== normalizedSelectedWeek) {
        onWeekChange(target.weekOf, nextDirection);
      }
    },
    [
      currentWeek,
      isNavigating,
      normalizedSelectedWeek,
      onWeekChange,
      settleTransport,
      showings,
    ],
  );

  const step = useCallback(
    (nextDirection: -1 | 1) => {
      const targetIndex = getWrappedShowingIndex(
        selectedIndex,
        nextDirection,
        showings.length,
      );
      if (targetIndex >= 0) {
        navigateToIndex(targetIndex, nextDirection);
      }
    },
    [navigateToIndex, selectedIndex, showings.length],
  );

  useEffect(() => {
    const adjacentIndices = [
      getWrappedShowingIndex(selectedIndex, -1, showings.length),
      getWrappedShowingIndex(selectedIndex, 1, showings.length),
    ];
    for (const index of adjacentIndices) {
      const week = showings[index]?.weekOf;
      if (!week) continue;
      const poster = groupForWeek(week)?.movieData?.poster;
      if (poster) {
        const image = new Image();
        image.decoding = "async";
        image.src = poster;
      }
    }
  }, [groupForWeek, selectedIndex, showings]);

  useEffect(
    () => () => {
      if (transportTimerRef.current !== null) {
        window.clearTimeout(transportTimerRef.current);
      }
    },
    [],
  );

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      step(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      step(1);
    }
  };

  const handlePointerDown = (event: PointerEvent<HTMLElement>) => {
    pointerStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      pointerId: event.pointerId,
      startedOnControl: !!(event.target as HTMLElement).closest(
        "button, a, input, textarea, select",
      ),
    };
  };

  const handlePointerUp = (event: PointerEvent<HTMLElement>) => {
    const start = pointerStartRef.current;
    pointerStartRef.current = null;
    if (
      !start ||
      start.pointerId !== event.pointerId ||
      start.startedOnControl
    ) {
      return;
    }

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (
      Math.abs(deltaX) < SWIPE_THRESHOLD_PX ||
      Math.abs(deltaX) < Math.abs(deltaY) * 1.35
    ) {
      return;
    }
    step(deltaX > 0 ? -1 : 1);
  };

  const handlePointerCancel = () => {
    pointerStartRef.current = null;
  };

  if (!selectedShowing) return null;

  const isRatingOpen =
    isCurrentShowing && !!selectedStatus?.votingOpen;
  const slideStatus = isRatingOpen
    ? "Rating open"
    : isCurrentShowing
      ? "Active"
      : "Completed";
  const timingLabel = isCurrentShowing
    ? `Ends ${formatWeekdayShortDateET(selectedShowing.endDate)}`
    : `Ended ${formatWeekdayShortDateET(selectedShowing.endDate)}`;
  const transitionActive = transportState !== "idle" || isNavigating;
  const slideVariants = prefersReducedMotion
    ? {
        enter: { opacity: 0 },
        center: { opacity: 1 },
        exit: { opacity: 0 },
      }
    : {
        enter: (travel: Direction) => ({
          opacity: 0,
          x: travel < 0 ? -24 : 24,
        }),
        center: { opacity: 1, x: 0 },
        exit: (travel: Direction) => ({
          opacity: 0,
          x: travel < 0 ? 20 : -20,
        }),
      };

  return (
    <section
      className="weekly-showings-carousel"
      role="region"
      aria-roledescription="carousel"
      aria-label="Weekly Showings"
      aria-busy={isNavigating}
      data-active={isCurrentShowing ? "true" : "false"}
      data-transition={transitionActive ? "true" : "false"}
      data-transport={transportState}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    >
      <div className="weekly-showings-carousel__topline">
        <div>
          <span>{isCurrentShowing ? "Now Showing" : "Weekly Showings"}</span>
          <small>
            {isCurrentShowing ? "Live program" : "Archive playback"} · Swipe or use transport
          </small>
        </div>
        <span
          className="weekly-showings-carousel__position"
          aria-label={`Week ${selectedIndex + 1} of ${showings.length}`}
        >
          <span className="crt-yellow">
            {String(selectedIndex + 1).padStart(2, "0")}
          </span>
          <i aria-hidden="true">/</i>
          <span className="crt-yellow">
            {String(showings.length).padStart(2, "0")}
          </span>
        </span>
      </div>

      <div className="weekly-showings-carousel__transport">
        <button
          type="button"
          className="weekly-showings-carousel__control"
          onClick={() => step(-1)}
          disabled={showings.length < 2 || isNavigating}
          aria-label="Previous movie week"
          title="Rewind to previous movie week"
        >
          <Rewind aria-hidden="true" />
        </button>

        <div className="weekly-showings-carousel__viewport">
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.article
              key={selectedShowing.weekOf}
              className="weekly-showings-carousel__slide"
              role="group"
              aria-roledescription="slide"
              aria-label={`Week ${selectedIndex + 1} of ${showings.length}: ${formatDateET(selectedShowing.weekOf)}`}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                duration: prefersReducedMotion ? 0.12 : 0.28,
                ease: [0.2, 0.86, 0.26, 1],
              }}
            >
              <div className="weekly-showings-carousel__program">
                <div className="weekly-showings-carousel__badges">
                  <span
                    className="weekly-showings-carousel__state"
                    data-state={isRatingOpen ? "recording" : slideStatus.toLowerCase()}
                  >
                    {isRatingOpen && <i aria-hidden="true" />}
                    <span>{slideStatus}</span>
                  </span>
                  <span className="weekly-showings-carousel__speed">
                    VHS · SP
                  </span>
                </div>
                <p className="weekly-showings-carousel__week">
                  Week {String(selectedIndex + 1).padStart(2, "0")} ·{" "}
                  {formatDateET(selectedShowing.weekOf)}
                </p>
                <p className="weekly-showings-carousel__timing">
                  {timingLabel}
                </p>
                <p
                  className="weekly-showings-carousel__movie-title"
                  title={selectedMovie?.title}
                >
                  {selectedMovie?.title ?? "No movie selected"}
                </p>
              </div>

              <div
                className="weekly-showings-carousel__tape"
              >
                <span
                  className="weekly-showings-carousel__reel"
                  aria-hidden="true"
                />
                <div
                  className="weekly-showings-carousel__tape-bridge"
                  aria-hidden="true"
                >
                  <span className="weekly-showings-carousel__bridge-logo">
                    <img
                      src={`${import.meta.env.BASE_URL}mts-cassette-logo.png`}
                      alt=""
                    />
                  </span>
                </div>
                <button
                  type="button"
                  className="weekly-showings-carousel__now-button"
                  onClick={() => {
                    if (currentShowingIndex >= 0 && !isCurrentShowing) {
                      navigateToIndex(currentShowingIndex, 1);
                    }
                  }}
                  disabled={
                    currentShowingIndex < 0 ||
                    isCurrentShowing ||
                    isNavigating
                  }
                  aria-label={
                    isCurrentShowing
                      ? "Currently showing this week"
                      : "Go to the currently showing week"
                  }
                >
                  <i aria-hidden="true" />
                  <span>Now Showing</span>
                </button>
                <span
                  className="weekly-showings-carousel__counter-logo"
                  aria-hidden="true"
                >
                  <img
                    src={`${import.meta.env.BASE_URL}vlgfm-live-logo.png`}
                    alt=""
                  />
                </span>
                <span
                  className="weekly-showings-carousel__reel"
                  aria-hidden="true"
                />
              </div>
            </motion.article>
          </AnimatePresence>
        </div>

        <button
          type="button"
          className="weekly-showings-carousel__control"
          onClick={() => step(1)}
          disabled={showings.length < 2 || isNavigating}
          aria-label="Next movie week"
          title="Fast-forward to next movie week"
        >
          <FastForward aria-hidden="true" />
        </button>
      </div>

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        Showing week {selectedIndex + 1} of {showings.length},{" "}
        {formatDateET(selectedShowing.weekOf)}.{" "}
        {selectedMovie?.title ?? "No movie selected"}. {slideStatus}.
      </p>
    </section>
  );
}
