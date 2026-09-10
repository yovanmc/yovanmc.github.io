import { useMemo, type CSSProperties, type ReactNode } from "react";
import { rng } from "../lib/rng";

/** Drifting motes + twinkling diamond "stars", deterministically seeded. */
function buildParticles(): ReactNode {
  const r = rng(29);
  const items: ReactNode[] = [];
  for (let i = 0; i < 54; i++) {
    const isStar = r() > 0.76;
    if (isStar) {
      const op = 0.3 + r() * 0.5;
      const style: CSSProperties = {
        position: "absolute",
        left: r() * 100 + "%",
        top: r() * 88 + "%",
        width: 3 + r() * 4 + "px",
        height: 3 + r() * 4 + "px",
        background: `rgba(205,228,255,${op})`,
        boxShadow: `0 0 7px 1px rgba(185,218,255,${op})`,
        transform: "rotate(45deg)",
        animation: `twinkle ${(2.5 + r() * 3.5).toFixed(2)}s ease-in-out ${(-r() * 5).toFixed(2)}s infinite`,
      };
      items.push(<span key={"s" + i} style={style} />);
    } else {
      const op = 0.25 + r() * 0.5;
      const size = 2 + r() * 5;
      const style: CSSProperties = {
        position: "absolute",
        left: r() * 100 + "%",
        bottom: -8 - r() * 14 + "%",
        width: size + "px",
        height: size + "px",
        borderRadius: "50%",
        background: `radial-gradient(circle, rgba(200,228,255,${op}) 0%, rgba(140,190,255,0) 70%)`,
        boxShadow: `0 0 8px 2px rgba(120,170,255,${(op * 0.45).toFixed(2)})`,
        animation: `floatUp ${(9 + r() * 11).toFixed(1)}s linear ${(-r() * 18).toFixed(2)}s infinite`,
      };
      items.push(<span key={"m" + i} style={style} />);
    }
  }
  return items;
}

export function Atmosphere() {
  const particles = useMemo(() => buildParticles(), []);
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: "6%",
          top: "-22%",
          width: "55%",
          height: "90%",
          borderRadius: "50%",
          filter: "blur(70px)",
          background: "radial-gradient(ellipse, rgba(70,150,255,.4), rgba(70,150,255,0) 70%)",
          animation: "auroraA 18s ease-in-out infinite",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          right: "2%",
          top: "-12%",
          width: "50%",
          height: "80%",
          borderRadius: "50%",
          filter: "blur(74px)",
          background: "radial-gradient(ellipse, rgba(120,110,235,.34), rgba(120,110,235,0) 70%)",
          animation: "auroraB 21s ease-in-out infinite",
          pointerEvents: "none",
        }}
      />
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
        {particles}
      </div>
    </>
  );
}
