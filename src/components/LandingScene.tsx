import { landingSceneHtml, landingSequenceCss } from "../generated/landingScene.js";
import { SCENE_H, SCENE_W, sceneFit } from "../site/landingLayout";

/** The sky's top colour, shown wherever the frame leaves the viewport uncovered. */
const NIGHT = "#03040a";
/** Scene px over which the frame's left edge fades into the night. The moon starts at x 608. */
const FADE = 160;
const FAR = 4000;

interface LandingSceneProps {
  vw: number;
  vh: number;
  /** The copy column's right edge in viewport px; it limits the scene's scale. */
  copyRight: number;
}

/**
 * The desktop landing's moon scene: the canon frame scaled and anchored
 * bottom-right by `sceneFit`, fixed to the viewport while the copy scrolls.
 * Decorative only. Its intro and loops run from the scene's own CSS, held
 * or released by the landing root's classes.
 */
export function LandingScene({ vw, vh, copyRight }: LandingSceneProps) {
  const fit = sceneFit(vw, vh, copyRight);
  return (
    <div
      aria-hidden="true"
      data-landing-scene
      style={{ position: "fixed", inset: 0, overflow: "hidden", background: NIGHT, pointerEvents: "none", forcedColorAdjust: "none" }}
    >
      <style>{landingSequenceCss}</style>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: SCENE_W + "px",
          height: SCENE_H + "px",
          transformOrigin: "0 0",
          transform: `translate(${fit.x}px, ${fit.y}px) scale(${fit.scale})`,
        }}
      >
        <div style={{ position: "absolute", inset: 0 }} dangerouslySetInnerHTML={{ __html: landingSceneHtml }} />
        {fit.x > 0.5 && (
          <>
            <div style={{ position: "absolute", left: -FAR + "px", top: -FAR + "px", width: FAR + "px", height: SCENE_H + 2 * FAR + "px", background: NIGHT }} />
            <div
              style={{
                position: "absolute",
                left: 0,
                top: -FAR + "px",
                width: FADE + "px",
                height: SCENE_H + 2 * FAR + "px",
                background: `linear-gradient(90deg, ${NIGHT}, rgba(3,4,10,0))`,
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}
