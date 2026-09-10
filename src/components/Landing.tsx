import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { shouldRouteInApp } from "../site/linkClick";
import { contactLinks, landingRows, nextRowIndex, type LandingRow } from "../site/landingRows";
import { bioLine, footerEmail, footerGithub, footerLinkedin, nameLine, phoneNote, roleLine } from "../landingCopy";

const MONO = "'JetBrains Mono',monospace";
const SERIF = "'Marcellus',serif";
const SANS = "'Sora',sans-serif";

interface LandingProps {
  onPlay: () => void;
  /** Lands in the play menu world with the dive skipped (App.continuePlay). */
  onContinue: () => void;
  onBrowse: () => void;
  /** defeatedBosses.length > 0: shows the Continue row. */
  hasProgress: boolean;
  vw: number;
  vh: number;
  playMove: () => void;
  playEnter: () => void;
}

/**
 * The splash letter with a cursor menu. The sky (Atmosphere) is App's.
 *
 * Interaction: rows are real <button>/<a> elements. The cursor marks the
 * FOCUSED row, so the glyph and the focus ring can never desync; while the
 * pointer is over the menu the glyph shows the HOVERED row instead (hover
 * never calls .focus(), so a mouse passing over the menu cannot move a
 * keyboard user's position or kill the "Enter starts the game" rule).
 * Nothing is autofocused: the glyph rests on New game until a key or pointer
 * moves it (see REST_IDX below).
 * ArrowUp/ArrowDown move DOM focus with wrap (nextRowIndex) and are
 * preventDefault'ed, so the landing cannot be arrow-scrolled while it owns
 * the keys (PageUp/PageDown/Home/End still scroll). Enter
 * with nothing focused starts the game; Enter on a focused row is the row's
 * own native activation, never double-fired.
 */
export function Landing({ onPlay, onContinue, onBrowse, hasProgress, vw, vh, playMove, playEnter }: LandingProps) {
  const isMobile = vw < 760;
  const rows = landingRows(hasProgress);
  const links = contactLinks();
  const rowRefs = useRef<(HTMLButtonElement | HTMLAnchorElement | null)[]>([]);
  const [focusIdx, setFocusIdx] = useState<number | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  // Title-screen model: while nothing is focused the cursor RESTS on row 0
  // (New game), which is exactly what Enter-with-nothing-focused activates,
  // so the glyph always marks the row Enter would fire. No autoFocus: on a
  // fresh page Chromium treats autofocus as :focus-visible and would draw a
  // ring box on load. The first arrow key focuses a row for real, and the
  // ring then appears from genuine keyboard use.
  // Display priority: hovered row (pointer over the menu, hover never moves
  // DOM focus), else focused row, else the rest row.
  const REST_IDX = 0;
  const cursorIdx = hoverIdx ?? focusIdx ?? REST_IDX;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // legacy aliases (Up/Down/...) are old-Edge/IE naming, cheap to honor
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
      // nothing focused: step FROM the rest row (Down -> row 1, Up -> last),
      // so the first key visibly moves the cursor; focus elsewhere on the
      // page (footer link, skip target): enter the menu at its ends.
      const current = focusedRow !== -1 ? focusedRow : nothingFocused ? REST_IDX : null;
      const next = nextRowIndex(current, k, rows.length);
      rowRefs.current[next]?.focus();
      // onFocus normally sets this too; set it here as well so the glyph
      // tracks the keys even in a document that fires no focus events
      // (unfocused window, background tab).
      setFocusIdx(next);
      playMove();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rows.length, onPlay, playMove, playEnter]);

  const activate = (row: LandingRow) => {
    playEnter();
    if (row.kind === "game") onPlay();
    else if (row.kind === "continue") onContinue();
  };

  const anchorClick = (row: LandingRow) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (row.kind === "work" && shouldRouteInApp(e)) {
      e.preventDefault();
      playEnter();
      onBrowse();
      return;
    }
    // contact (mailto) and modified clicks: let the browser do its thing
    playEnter();
  };

  const rowStyle = (active: boolean): CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: "10px",
    minHeight: "44px",
    padding: "0 6px",
    margin: 0,
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontFamily: SANS,
    fontSize: isMobile ? "15px" : "14.5px",
    letterSpacing: ".03em",
    color: active ? "#eef5ff" : "#b6c2da",
    textDecoration: "none",
    textAlign: "left",
    width: "100%",
    transition: "color .18s ease",
  });
  const cursorStyle = (active: boolean): CSSProperties => ({
    width: "12px",
    color: active ? "#7fb0ff" : "transparent",
    textShadow: active ? "0 0 8px #7fb0ff" : "none",
    animation: active ? "cursorBlink 1.1s ease-in-out infinite" : "none",
  });
  const footerLink: CSSProperties = {
    fontFamily: MONO,
    fontSize: "11px",
    letterSpacing: ".12em",
    color: "#6f82a6",
    textDecoration: "none",
  };

  return (
    <main
      id="main"
      tabIndex={-1}
      data-landing
      data-scroll
      style={{ position: "absolute", inset: 0, zIndex: 8, overflowY: "auto" }}
    >
      {/* one flex column: content, then the footer pushed to the bottom by
          margin-top:auto. In-flow (not absolute) so a long bio or a short
          viewport pushes the footer down instead of under the menu.
          Desktop: equal auto margins above the content and below it (the
          footer's) center the content block; phone flows from the top. */}
      <div
        style={{
          minHeight: Math.max(vh, 560) + "px",
          display: "flex",
          flexDirection: "column",
          justifyContent: isMobile ? "flex-start" : "center",
          padding: isMobile ? "64px 22px 22px" : "80px 0 22px 7.5vw",
        }}
      >
        <div style={{ maxWidth: "520px", marginTop: isMobile ? 0 : "auto" }}>
          <h1
            style={{
              margin: 0,
              fontFamily: SERIF,
              fontSize: isMobile ? "26px" : "36px",
              lineHeight: 1.1,
              letterSpacing: ".03em",
              color: "#eaf1ff",
            }}
          >
            {nameLine}
          </h1>
          <div style={{ marginTop: "8px", fontFamily: MONO, fontSize: "11px", letterSpacing: ".14em", color: "#7fb0ff" }}>
            {roleLine.toUpperCase()}
          </div>
          <p style={{ margin: "26px 0 0", maxWidth: "460px", fontSize: isMobile ? "14px" : "15px", lineHeight: 1.7, color: "#b6c2d8" }}>
            {bioLine}
          </p>

          <nav aria-label="Start" style={{ marginTop: "30px" }}>
            {rows.map((row, i) => {
              const active = cursorIdx === i;
              const setRef = (el: HTMLButtonElement | HTMLAnchorElement | null) => {
                rowRefs.current[i] = el;
              };
              const common = {
                onFocus: () => setFocusIdx(i),
                onBlur: () => setFocusIdx((cur) => (cur === i ? null : cur)),
                onMouseEnter: () => setHoverIdx(i),
                onMouseLeave: () => setHoverIdx((cur) => (cur === i ? null : cur)),
                style: rowStyle(active),
              };
              const glyph = (
                <span aria-hidden style={cursorStyle(active)}>
                  ▸
                </span>
              );
              return row.href === undefined ? (
                <button
                  key={row.kind}
                  ref={setRef}
                  type="button"
                  onClick={() => activate(row)}
                  {...common}
                >
                  {glyph}
                  {row.label}
                </button>
              ) : (
                <a key={row.kind} ref={setRef} href={row.href} onClick={anchorClick(row)} {...common}>
                  {glyph}
                  {row.label}
                </a>
              );
            })}
          </nav>

          {isMobile && (
            <div style={{ marginTop: "12px", fontFamily: MONO, fontSize: "10.5px", letterSpacing: ".1em", color: "#5f7196" }}>
              {phoneNote}
            </div>
          )}
        </div>

        <div style={{ marginTop: "auto", paddingTop: "48px", display: "flex", gap: "22px" }}>
          <a href={links.github} style={footerLink}>
            {footerGithub}
          </a>
          <a href={links.linkedin} style={footerLink}>
            {footerLinkedin}
          </a>
          <a href={links.email} style={footerLink}>
            {footerEmail}
          </a>
        </div>
      </div>

      {!isMobile && (
        <div
          aria-hidden
          style={{ position: "fixed", right: "30px", bottom: "22px", display: "flex", gap: "18px", fontFamily: MONO, fontSize: "11px", letterSpacing: ".12em", color: "#6f82a6", pointerEvents: "none" }}
        >
          <span>
            <span style={{ color: "#9fc4ff" }}>↑↓</span> NAVIGATE
          </span>
          <span>
            <span style={{ color: "#9fc4ff" }}>⏎</span> SELECT
          </span>
        </div>
      )}
    </main>
  );
}
