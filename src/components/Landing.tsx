import { type CSSProperties } from "react";
import { bioLine, footerEmail, footerGithub, footerLinkedin, nameLine, phoneNote, roleLine } from "../landingCopy";
import { DesktopLanding } from "./DesktopLanding";
import { useLandingMenu } from "./useLandingMenu";

const MONO = "'JetBrains Mono',monospace";
const SERIF = "'Marcellus',serif";
const SANS = "'Sora',sans-serif";

export interface LandingProps {
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
  /** The desktop intro has played in this page load (App state, like hasDived). */
  introPlayed?: boolean;
  onIntroPlayed?: () => void;
}

/** The phone landing below the 760 px breakpoint, the moon landing above it.
 * Crossing the breakpoint remounts the landing, which ends a playing intro. */
export function Landing(props: LandingProps) {
  return props.vw < 760 ? <PhoneLanding {...props} /> : <DesktopLanding {...props} />;
}

/** The splash letter with a cursor menu. The sky (Atmosphere) is App's. */
function PhoneLanding(props: LandingProps) {
  const { vh } = props;
  const isMobile = props.vw < 760;
  const { rows, links, rowRefs, cursorIdx, setFocusIdx, setHoverIdx, activate, anchorClick } = useLandingMenu(props);

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
      {/* One flex column, the footer pushed down by margin-top:auto. In flow,
          not absolute, so a long bio or short viewport pushes the footer down
          instead of under the menu. Desktop centers the content with equal
          auto margins; phone flows from the top. */}
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
