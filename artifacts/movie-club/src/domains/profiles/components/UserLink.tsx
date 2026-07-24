import { useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { Link, useLocation } from "wouter";
import { CinemaRouteCurtain } from "@/components/cinema/cinema-effects";
import { cn } from "@/lib/utils";

interface UserLinkProps {
  userId: number;
  className?: string;
  children: React.ReactNode;
  ariaLabel?: string;
  /**
   * If true, the link click won't bubble to parent click handlers.
   * Use inside rows/cards that are themselves clickable.
   */
  stopPropagation?: boolean;
}

export function UserLink({ userId, className, children, stopPropagation, ariaLabel }: UserLinkProps) {
  const [, setLocation] = useLocation();
  const [isNavigating, setIsNavigating] = useState(false);
  const navigationTimerRef = useRef<number | null>(null);
  const destination = `/users/${userId}`;

  useEffect(
    () => () => {
      if (navigationTimerRef.current !== null) {
        window.clearTimeout(navigationTimerRef.current);
      }
    },
    [],
  );

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (stopPropagation) event.stopPropagation();

    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();
    if (isNavigating) return;

    setIsNavigating(true);
    navigationTimerRef.current = window.setTimeout(() => {
      setLocation(destination);
      navigationTimerRef.current = null;
    }, 420);
  };

  return (
    <>
      <Link
        to={destination}
        className={cn(
          "cursor-pointer hover:opacity-80 transition-opacity inline-flex items-center",
          className,
        )}
        aria-label={ariaLabel}
        aria-busy={isNavigating}
        onClick={handleClick}
      >
        {children}
      </Link>
      {isNavigating && (
        <CinemaRouteCurtain phase="exiting" destination="profile" />
      )}
    </>
  );
}
