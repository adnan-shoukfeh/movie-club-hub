import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CinemaIntro, ProjectorMarquee, VHSTape } from "./cinema-effects";

describe("cinema effects", () => {
  let container: HTMLDivElement;
  let root: Root;

  const render = (node: ReactNode) => {
    act(() => root.render(node));
    return {
      container,
      rerender: (nextNode: ReactNode) => act(() => root.render(nextNode)),
    };
  };

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    sessionStorage.clear();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false }),
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("labels the projector marquee and exposes its live state visually", () => {
    const { container } = render(<ProjectorMarquee active />);

    expect(container.querySelector('[aria-label="Now showing"]')).not.toBeNull();
    expect(container.querySelector(".projector-marquee__signal")).toHaveClass("is-live");
  });

  it("maps rating state to the VHS transport", () => {
    const { container, rerender } = render(
      <VHSTape title="Stalker" date="2026-07-23" isActive />,
    );

    expect(container.querySelector(".vhs-cassette")).toHaveAttribute("data-state", "playing");

    rerender(
      <VHSTape
        title="Stalker"
        date="2026-07-23"
        isActive={false}
        resultsAvailable
      />,
    );
    expect(container.querySelector(".vhs-cassette")).toHaveAttribute("data-state", "ejected");
  });

  it("skips the full intro when reduced motion is requested", () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: true }),
    });

    const { container } = render(
      <CinemaIntro groupId={1} groupName="Thursday Night Cinema" movieTitle="Stalker" />,
    );

    expect(container.childElementCount).toBe(0);
  });
});
