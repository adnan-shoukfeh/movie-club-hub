import { useEffect, useRef, useState } from "react";
import { Aperture, CircleDot } from "lucide-react";

interface CinemaIntroProps {
  groupId: number;
  groupName: string;
  movieTitle?: string | null;
}

export function CinemaIntro({ groupId, groupName, movieTitle }: CinemaIntroProps) {
  const [isVisible, setIsVisible] = useState(() => {
    if (typeof window === "undefined") return false;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
    try {
      return sessionStorage.getItem(`cinema-intro:${groupId}`) !== "played";
    } catch {
      return true;
    }
  });

  useEffect(() => {
    if (!isVisible) return;

    try {
      sessionStorage.setItem(`cinema-intro:${groupId}`, "played");
    } catch {
      // Storage can be unavailable in restrictive Safari sessions. The intro
      // remains non-blocking and is removed by the timer below.
    }

    const timer = window.setTimeout(() => setIsVisible(false), 1550);
    return () => window.clearTimeout(timer);
  }, [groupId, isVisible]);

  if (!isVisible) return null;

  return (
    <div className="cinema-intro" aria-hidden="true">
      <div className="cinema-intro__beam" />
      <div className="cinema-intro__dust" />
      <div className="cinema-intro__title-card">
        <Aperture className="cinema-intro__aperture" />
        <span className="cinema-intro__eyebrow">Private screening · Track 01</span>
        <strong>{groupName}</strong>
        <span className="cinema-intro__feature">
          {movieTitle ? `Now showing · ${movieTitle}` : "Awaiting feature selection"}
        </span>
      </div>
      <div className="cinema-intro__shutter" />
    </div>
  );
}

interface ProjectorMarqueeProps {
  active?: boolean;
}

export function ProjectorMarquee({ active = false }: ProjectorMarqueeProps) {
  return (
    <div className="projector-marquee" aria-label="Now showing">
      <span className="projector-marquee__lamp" aria-hidden="true">
        <CircleDot />
      </span>
      <span className="projector-marquee__text">Now Showing</span>
      <span className={`projector-marquee__signal ${active ? "is-live" : ""}`} aria-hidden="true">
        {active ? "On air" : "Program"}
      </span>
    </div>
  );
}

interface VHSTapeProps {
  title: string;
  date: string;
  isActive: boolean;
  resultsAvailable?: boolean;
  direction?: number;
}

export function VHSTape({
  title,
  date,
  isActive,
  resultsAvailable = false,
  direction = 0,
}: VHSTapeProps) {
  const tapeRef = useRef<HTMLDivElement>(null);
  const [pageVisible, setPageVisible] = useState(() =>
    typeof document === "undefined" ? true : document.visibilityState === "visible",
  );
  const [inViewport, setInViewport] = useState(true);

  useEffect(() => {
    const handleVisibility = () => setPageVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  useEffect(() => {
    const tape = tapeRef.current;
    if (!tape || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setInViewport(entry?.isIntersecting ?? true),
      { rootMargin: "80px 0px" },
    );
    observer.observe(tape);
    return () => observer.disconnect();
  }, []);

  const tapeState = resultsAvailable ? "ejected" : isActive ? "playing" : "paused";

  return (
    <div
      ref={tapeRef}
      className="vhs-cassette"
      data-state={tapeState}
      data-direction={direction < 0 ? "rewind" : direction > 0 ? "forward" : "idle"}
      data-visible={pageVisible && inViewport ? "true" : "false"}
      aria-hidden="true"
    >
      <div className="vhs-cassette__screw vhs-cassette__screw--tl" />
      <div className="vhs-cassette__screw vhs-cassette__screw--tr" />
      <div className="vhs-cassette__label">
        <span>Thursday Night Cinema</span>
        <strong title={title}>{title}</strong>
        <span>{date} · SP</span>
      </div>
      <div className="vhs-cassette__window">
        <div className="vhs-reel">
          <span />
        </div>
        <div className="vhs-tape-path" />
        <div className="vhs-reel">
          <span />
        </div>
      </div>
      <div className="vhs-cassette__counter">
        {resultsAvailable ? "EJECT" : isActive ? "PLAY  SP" : "PAUSE"}
      </div>
    </div>
  );
}

interface CinemaLoadingDeckProps {
  mode?: "loading" | "exiting";
  destination?: "clubs" | "profile";
}

export function CinemaLoadingDeck({
  mode = "loading",
  destination = "clubs",
}: CinemaLoadingDeckProps) {
  const isExiting = mode === "exiting";
  const isProfile = destination === "profile";

  return (
    <div className="cinema-loading" role="status" aria-live="polite">
      <span className="cinema-loading__kicker">
        {isProfile
          ? "VCR · Loading member profile"
          : isExiting
            ? "VCR · Rewinding program"
            : "VCR · Loading program"}
      </span>
      <VHSTape
        title={
          isProfile
            ? "Tracking member tape…"
            : isExiting
              ? "Returning to clubs…"
              : "Tracking movie night…"
        }
        date="--:--:--"
        isActive
        direction={isExiting ? -1 : 1}
      />
      <span className="cinema-loading__signal">
        {isProfile
          ? "Opening member file"
          : isExiting
            ? "Ejecting tape"
            : "Adjusting tracking"}
      </span>
    </div>
  );
}

interface CinemaRouteCurtainProps {
  phase: "holding" | "leaving" | "exiting";
  destination?: "clubs" | "profile";
}

export function CinemaRouteCurtain({
  phase,
  destination = "clubs",
}: CinemaRouteCurtainProps) {
  return (
    <div
      className="cinema-route-curtain"
      data-phase={phase}
      aria-hidden={phase === "leaving" ? "true" : undefined}
    >
      <CinemaLoadingDeck
        mode={phase === "exiting" ? "exiting" : "loading"}
        destination={destination}
      />
    </div>
  );
}
