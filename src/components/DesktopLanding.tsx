import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { bioLine, footerEmail, footerGithub, footerLinkedin, nameLine, roleLine } from "../landingCopy";
import { HINTS, HINTS_STACKED, TIERS, copyLeft, copyTier, hintsLayout, sceneFit } from "../site/landingLayout";
import type { LandingProps } from "./Landing";
import { LandingScene } from "./LandingScene";
import { useLandingIntro } from "./useLandingIntro";
import { useLandingMenu } from "./useLandingMenu";

const SERIF = "'Bodoni Moda','Bodoni Moda Fallback',serif";
const SANS = "'Josefin Sans','Josefin Sans Fallback',sans-serif";
const ACCENT = "#f2e4b0";
/** Menu geometry: the tab above the rows ends 13 px down, each row is 48 px with a 6 px gap. */
const FIRST_ROW_TOP = 19;
const ROW_STEP = 54;
const noop = () => {};

const diamond = (size: number, color: string, glow = false): CSSProperties => ({
  display: "block",
  flex: "none",
  width: size + "px",
  height: size + "px",
  transform: "rotate(45deg)",
  background: color,
  boxShadow: glow ? `0 0 10px ${color}` : undefined,
});

/**
 * The desktop landing: the moon scene behind a copy column and start menu.
 * On the first visit of a page load the moon intro plays once.
 * Every row stays in the accessibility tree during it, marked disabled, and
 * the gestures that skip it never reach a row.
 */
export function DesktopLanding(props: LandingProps) {
  const { vw, vh, introPlayed = false, onIntroPlayed = noop } = props;
  const rootRef = useRef<HTMLElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const intro = useLandingIntro(rootRef, introPlayed, onIntroPlayed);
  const introActive = intro.phase === "intro";
  const blockedRef = useRef(introActive);
  blockedRef.current = introActive;
  const { rows, links, rowRefs, cursorIdx, setFocusIdx, setHoverIdx, activate, anchorClick } = useLandingMenu(
    props,
    () => blockedRef.current,
  );
  const tier = copyTier(vw, vh, rows.length);
  const t = TIERS[tier];
  const [copyRight, setCopyRight] = useState(() => copyLeft(vw) + t.column);
  const hints = hintsLayout(vw, vh, sceneFit(vw, vh, copyRight));
  const hintsBox = hints === "row" ? HINTS : HINTS_STACKED;

  // The scene's scale depends on where the copy column ends. Measured here,
  // the column's own parent, so the ref is set on mount.
  useLayoutEffect(() => {
    const el = copyRef.current;
    if (!el) return;
    const measure = () => setCopyRight(el.getBoundingClientRect().right);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [vw, vh, tier]);

  const seq = (cls: string) => (intro.reduced ? undefined : cls);
  const [first, ...restOfName] = nameLine.split(" ");
  const rootClass = ["lnd-root", intro.playing ? "lnd-play" : "", intro.fade ? "lnd-fade" : ""].filter(Boolean).join(" ");

  const rowStyle = (active: boolean): CSSProperties => ({
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: "14px",
    height: "48px",
    padding: "3px 18px 0 18px",
    boxSizing: "border-box",
    borderRadius: "12px",
    fontFamily: SANS,
    fontWeight: 600,
    fontSize: "15px",
    letterSpacing: ".36em",
    textTransform: "uppercase",
    overflow: "hidden",
    textAlign: "left",
    textDecoration: "none",
    cursor: "pointer",
    marginLeft: active ? "14px" : 0,
    border: active ? "1px solid rgba(255,255,255,.72)" : "1px solid rgba(204,204,236,.26)",
    background: active
      ? `linear-gradient(180deg, rgba(255,255,255,.56) 0%, rgba(255,255,255,0) 52%, rgba(0,0,0,.14) 100%), ${ACCENT}`
      : "linear-gradient(180deg, rgba(38,39,66,.9) 0%, rgba(13,14,26,.94) 100%)",
    boxShadow: active ? `0 0 22px -4px ${ACCENT}, inset 0 -2px 0 rgba(0,0,0,.12)` : "inset 0 1px 0 rgba(255,255,255,.07)",
    color: active ? "#0a0b16" : "#d6d6e6",
    transition: "margin-left .16s ease",
  });

  return (
    <main
      id="main"
      tabIndex={-1}
      ref={rootRef}
      data-landing
      data-scroll
      data-tier={tier}
      className={rootClass}
      style={{ position: "absolute", inset: 0, zIndex: 8, overflowY: "auto" }}
    >
      <LandingScene vw={vw} vh={vh} copyRight={copyRight} />

      {/* One flex column, the footer pushed down by margin-top:auto, in flow
          so a short viewport scrolls instead of overlapping. */}
      <div
        style={{
          position: "relative",
          minHeight: Math.max(vh, 560) + "px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "48px 0 28px clamp(40px, 6.9vw, 120px)",
        }}
      >
        <div ref={copyRef} style={{ width: t.column + "px", marginTop: "auto" }}>
          <div
            className={seq("lnd-in-role")}
            style={{ display: "flex", alignItems: "center", gap: "16px", fontFamily: SANS, fontWeight: 600, fontSize: "12.5px", letterSpacing: ".44em", textTransform: "uppercase", color: "#b5b7cc", position: "relative", zIndex: 1 }}
          >
            <span aria-hidden style={{ display: "block", width: "34px", height: "1px", background: "linear-gradient(90deg, rgba(226,224,245,0), #e2e0f5)" }} />
            <span>{roleLine}</span>
          </div>

          <div style={{ position: "relative", marginTop: "12px" }}>
            <h1
              className={seq("lnd-in-name")}
              style={{
                margin: 0,
                fontFamily: SERIF,
                fontStyle: "italic",
                fontWeight: 500,
                fontSize: t.name + "px",
                lineHeight: 0.98,
                letterSpacing: "-.014em",
                background: "linear-gradient(180deg, #ffffff 0%, #f3f0e8 36%, #c4c2d6 72%, #908ea8 100%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
                filter: "drop-shadow(0 0 22px rgba(236,226,255,.24))",
                paddingRight: "10px",
                clipPath: "inset(-40px -40px -40px -40px)",
              }}
            >
              <span style={{ display: "block" }}>{first}</span>{" "}
              <span style={{ display: "block", paddingLeft: t.indent + "px" }}>{restOfName.join(" ")}</span>
            </h1>
            <div aria-hidden style={{ position: "absolute", left: 0, top: 0, width: t.column + 20 + "px", height: Math.round(t.name * 2.04) + "px", overflow: "hidden", pointerEvents: "none" }}>
              <div
                className={seq("lnd-in-glint")}
                style={{ position: "absolute", left: 0, top: "-20px", width: "70px", height: Math.round(t.name * 2.4) + "px", background: "linear-gradient(90deg, rgba(255,255,255,0), rgba(255,250,236,.6), rgba(255,255,255,0))", opacity: 0 }}
              />
            </div>
          </div>

          {/* Above the name's forced-colors backplate, which is larger than its
              lines; the role line above sits there too. The rule is art. */}
          <div aria-hidden className={seq("lnd-in-rule")} style={{ transformOrigin: "left center", position: "relative", zIndex: 1, forcedColorAdjust: "none", width: t.rule + "px", height: "12px", margin: "20px 0" }}>
            <div style={{ position: "absolute", left: 0, top: "6px", width: t.rule + "px", height: "1px", background: "linear-gradient(90deg, #ece8f6 0%, rgba(236,232,246,.5) 45%, rgba(236,232,246,0) 100%)" }} />
            <div style={{ ...diamond(8, ACCENT, true), position: "absolute", left: 0, top: "2px" }} />
          </div>

          <p
            className={seq("lnd-in-bio")}
            style={{ margin: 0, width: t.bioWidth + "px", maxWidth: "100%", fontFamily: SANS, fontWeight: 400, fontSize: t.bio + "px", lineHeight: 1.74, color: "#d2d3e2" }}
          >
            {bioLine}
          </p>

          <nav aria-label="Start" style={{ position: "relative", marginTop: "26px", width: "356px", display: "flex", flexDirection: "column", gap: "6px" }}>
            <div
              aria-hidden
              className={seq("lnd-in-tab")}
              style={{ width: "118px", height: "18px", marginLeft: "16px", marginBottom: "-5px", boxSizing: "border-box", border: "1px solid rgba(214,210,240,.34)", borderBottom: 0, borderRadius: "10px 10px 0 0", background: "linear-gradient(180deg, rgba(232,228,248,.22), rgba(232,228,248,.05))", display: "flex", alignItems: "center", justifyContent: "center", gap: "7px" }}
            >
              <span style={diamond(4, "#cfcfe2")} />
              <span style={diamond(6, ACCENT)} />
              <span style={diamond(4, "#cfcfe2")} />
            </div>
            <span
              aria-hidden
              data-landing-cursor
              className={seq("lnd-in-cursor")}
              style={{ position: "absolute", left: "-14px", top: FIRST_ROW_TOP + 14.5 + cursorIdx * ROW_STEP + "px", width: "22px", height: "22px", zIndex: 1, transition: "top .16s ease" }}
            >
              <svg viewBox="0 0 22 22" width="22" height="22" style={{ display: "block" }}>
                <path d="M2 3 L20 11 L2 19 L7 11 Z" fill="#f4f6fb" style={{ stroke: "#0a0b16", strokeWidth: 1.6, strokeLinejoin: "round" }} />
                <path d="M4.5 5.6 L15 11 L7.4 11 Z" style={{ fill: ACCENT }} />
              </svg>
            </span>
            {rows.map((row, i) => {
              const active = cursorIdx === i;
              const setRef = (el: HTMLButtonElement | HTMLAnchorElement | null) => {
                rowRefs.current[i] = el;
              };
              const common = {
                "data-landing-row": true,
                "data-selected": active || undefined,
                "aria-disabled": introActive || undefined,
                className: seq("lnd-in-row" + Math.min(i, 3)),
                onFocus: () => setFocusIdx(i),
                onBlur: () => setFocusIdx((cur) => (cur === i ? null : cur)),
                onMouseEnter: () => setHoverIdx(i),
                onMouseLeave: () => setHoverIdx((cur) => (cur === i ? null : cur)),
                style: rowStyle(active),
              };
              const glyph = (
                <svg aria-hidden viewBox="0 0 8 10" width="7.2" height="9" style={{ display: "block", flex: "none", marginTop: "-3px", visibility: active ? "hidden" : "visible" }}>
                  <path d="M1 1 L7 5 L1 9 Z" style={{ fill: "#9c9eb6" }} />
                </svg>
              );
              const label = <span style={{ flex: 1 }}>{row.label}</span>;
              return row.href === undefined ? (
                <button key={row.kind} ref={setRef} type="button" onClick={() => activate(row)} {...common}>
                  {glyph}
                  {label}
                </button>
              ) : (
                <a key={row.kind} ref={setRef} href={row.href} onClick={anchorClick(row)} {...common}>
                  {glyph}
                  {label}
                </a>
              );
            })}
          </nav>
        </div>

        <div
          className={seq("lnd-in-footer")}
          style={{ marginTop: "auto", paddingTop: "36px", display: "flex", alignItems: "center", gap: "18px", fontFamily: SANS, fontWeight: 600, fontSize: "12.5px", letterSpacing: ".36em", color: "#b4b6cc" }}
        >
          <a href={links.github} className="lnd-foot">
            {footerGithub}
          </a>
          <span aria-hidden style={diamond(5, "#74768e")} />
          <a href={links.linkedin} className="lnd-foot">
            {footerLinkedin}
          </a>
          <span aria-hidden style={diamond(5, "#74768e")} />
          <a href={links.email} className="lnd-foot">
            {footerEmail}
          </a>
        </div>
      </div>

      {hints !== "none" && (
        <div
          aria-hidden
          className={seq("lnd-in-hints")}
          style={{ position: "fixed", right: hintsBox.right + "px", bottom: hintsBox.bottom + "px", display: "flex", flexDirection: hints === "row" ? "row" : "column", alignItems: hints === "row" ? "center" : "flex-start", gap: hints === "row" ? "28px" : "8px", fontFamily: SANS, fontWeight: 600, fontSize: "12px", letterSpacing: ".3em", textTransform: "uppercase", color: "#b0b2c8", pointerEvents: "none" }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: "9px" }}>
            <svg viewBox="0 0 16 14" width="16" height="14" style={{ display: "block" }}>
              <path d="M4 12.5 L4 1.5 M1 4.5 L4 1.5 L7 4.5 M12 1.5 L12 12.5 M9 9.5 L12 12.5 L15 9.5" fill="none" style={{ stroke: ACCENT, strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" }} />
            </svg>
            <span>NAVIGATE</span>
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: "9px" }}>
            <svg viewBox="0 0 16 14" width="16" height="14" style={{ display: "block" }}>
              <path d="M14 1.5 L14 8 L3 8 M6.5 4.5 L3 8 L6.5 11.5" fill="none" style={{ stroke: ACCENT, strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" }} />
            </svg>
            <span>SELECT</span>
          </span>
        </div>
      )}
    </main>
  );
}
