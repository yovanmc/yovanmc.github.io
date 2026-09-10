import { useMemo } from "react";
import { buildStationCanon } from "../generated/stationCanon";

interface StationProps {
  /** uniform scale applied to the 680px disc */
  scale: number;
  /** dim level: ~0.82 idle, ~0.2 browsing */
  opacity: number;
  /** vertical anchor of the disc center (e.g. "40%" desktop, "31%" mobile) */
  top: string;
}

/**
 * The stained-glass Station hero. The SVG comes from
 * src/generated/stationCanon.js. This wrapper adds only a gentle 9s breathe
 * animation, no hue-rotate, so the generated palette renders as authored.
 */
export function Station({ scale, opacity, top }: StationProps) {
  const svg = useMemo(() => buildStationCanon(), []);

  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        left: "50%",
        top,
        width: "680px",
        height: "680px",
        marginLeft: "-340px",
        marginTop: "-340px",
        transform: `scale(${scale})`,
        transformOrigin: "center",
        pointerEvents: "none",
        opacity,
        transition: "opacity .6s ease, transform .5s cubic-bezier(.16,1,.3,1)",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          animation: "glassBreathe 9s ease-in-out infinite",
        }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  );
}
