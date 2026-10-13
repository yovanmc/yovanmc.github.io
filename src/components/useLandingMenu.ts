import { useEffect, useRef, useState, type MouseEvent } from "react";
import { shouldRouteInApp } from "../site/linkClick";
import { contactLinks, landingRows, nextRowIndex, type LandingRow } from "../site/landingRows";
import type { LandingProps } from "./Landing";

/**
 * The landing's start menu, shared by the phone and desktop landings.
 *
 * Rows are real <button>/<a> elements. The glyph marks the focused row, so it
 * never desyncs from the focus ring; while the pointer is over the menu it
 * marks the hovered row instead (hover never calls .focus(), so a passing
 * mouse cannot move a keyboard user's position). ArrowUp/ArrowDown move DOM
 * focus with wrap and are preventDefault'ed, so the landing cannot
 * arrow-scroll (PageUp/PageDown/Home/End still scroll). Enter with nothing
 * focused starts the game; Enter on a focused row is its native activation.
 */
export function useLandingMenu(
  { onPlay, onContinue, onBrowse, hasProgress, playMove, playEnter }: LandingProps,
  /** True while the menu ignores activation (the desktop intro). */
  blocked: () => boolean = () => false,
) {
  const rows = landingRows(hasProgress);
  const links = contactLinks();
  const rowRefs = useRef<(HTMLButtonElement | HTMLAnchorElement | null)[]>([]);
  const [focusIdx, setFocusIdx] = useState<number | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  // With nothing focused the cursor rests on New game, which is what Enter
  // fires. No autoFocus: Chromium treats it as :focus-visible and would draw
  // a ring on load. Display priority: hovered row, else focused, else rest.
  const REST_IDX = 0;
  const cursorIdx = hoverIdx ?? focusIdx ?? REST_IDX;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Old Edge/IE key names, cheap to honor.
      const k = e.key.replace(/^(Right|Left|Up|Down)$/, "Arrow$1");
      const ae = document.activeElement;
      const nothingFocused = !ae || ae === document.body;
      if (k === "Enter" && nothingFocused) {
        e.preventDefault();
        playEnter();
        onPlay();
        return;
      }
      if (k !== "ArrowUp" && k !== "ArrowDown") return;
      e.preventDefault();
      const focusedRow = rowRefs.current.findIndex((el) => el !== null && el === ae);
      // Nothing focused: step from the rest row so the first key visibly moves
      // the cursor. Focus elsewhere on the page: enter the menu at its ends.
      const current = focusedRow !== -1 ? focusedRow : nothingFocused ? REST_IDX : null;
      const next = nextRowIndex(current, k, rows.length);
      rowRefs.current[next]?.focus();
      // onFocus sets this too; set it here so the glyph tracks keys in a
      // document that fires no focus events (unfocused window, background tab).
      setFocusIdx(next);
      playMove();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rows.length, onPlay, playMove, playEnter]);

  const activate = (row: LandingRow) => {
    if (blocked()) return;
    playEnter();
    if (row.kind === "game") onPlay();
    else if (row.kind === "continue") onContinue();
  };

  const anchorClick = (row: LandingRow) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (blocked()) {
      e.preventDefault();
      return;
    }
    if (row.kind === "work" && shouldRouteInApp(e)) {
      e.preventDefault();
      playEnter();
      onBrowse();
      return;
    }
    // mailto and modified clicks: let the browser handle them
    playEnter();
  };

  return { rows, links, rowRefs, cursorIdx, setFocusIdx, setHoverIdx, activate, anchorClick };
}
