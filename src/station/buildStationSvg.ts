/**
 * The signature "Dive to the Heart" stained-glass Station, generated as pure SVG.
 *
 * This is an ORIGINAL design (no copyrighted game art) converged over a long
 * implementor/critic loop against Kingdom Hearts reference stations. The geometry
 * here is LOCKED — it is a faithful port of the approved standalone design at
 * design_handoff_portfolio/station-loop/station.html. Treat radii/counts as final;
 * change them only through the same render-and-critique process that produced them.
 *
 * Structure (outside -> in): halo + royal-glass disc + frost + gold rim -> calm
 * tonal glass band -> interlocking vesica lace band -> gold separator + filigree
 * beads -> ONE ring of 24 tangent emblem roundels (faceted diamonds) on a dark-lead
 * ground -> gold separator -> luminous central sky medallion with a NYC skyline.
 * The upper-center sky stays clear so the name can sit there.
 */

const C = 340;
const LEAD = "#0a1430";

const G = (a: number) => `rgba(232,205,140,${a})`; // gold lead
const B = (a: number) => `rgba(150,196,255,${a})`; // light sky-blue
const P = (r: number, a: number): [number, number] => [C + r * Math.cos(a), C + r * Math.sin(a)];
const f = (n: number) => n.toFixed(2);

export function buildStationSvg(): string {
  const defs =
    "<defs>" +
    '<radialGradient id="halo" cx="50%" cy="46%" r="62%">' +
    '<stop offset="0%" stop-color="rgba(120,180,255,.32)"/>' +
    '<stop offset="60%" stop-color="rgba(90,150,255,.07)"/>' +
    '<stop offset="100%" stop-color="rgba(90,150,255,0)"/>' +
    "</radialGradient>" +
    '<radialGradient id="royal" cx="50%" cy="42%" r="62%">' +
    '<stop offset="0%" stop-color="#2a5398"/>' +
    '<stop offset="60%" stop-color="#173468"/>' +
    '<stop offset="100%" stop-color="#0a1c42"/>' +
    "</radialGradient>" +
    '<radialGradient id="glass" cx="50%" cy="40%" r="64%">' +
    '<stop offset="0%" stop-color="#3a6cb4"/>' +
    '<stop offset="50%" stop-color="#1f4a8c"/>' +
    '<stop offset="100%" stop-color="#15336a"/>' +
    "</radialGradient>" +
    '<radialGradient id="sky" cx="50%" cy="26%" r="86%">' +
    '<stop offset="0%" stop-color="#ffffff"/>' +
    '<stop offset="20%" stop-color="#eaf6ff"/>' +
    '<stop offset="46%" stop-color="#c0e0fc"/>' +
    '<stop offset="72%" stop-color="#86bdf2"/>' +
    '<stop offset="100%" stop-color="#5a96da"/>' +
    "</radialGradient>" +
    '<radialGradient id="roundel" cx="36%" cy="28%" r="80%">' +
    '<stop offset="0%" stop-color="#a8cdf6"/>' +
    '<stop offset="34%" stop-color="#4f7cc4"/>' +
    '<stop offset="100%" stop-color="#0f2a5e"/>' +
    "</radialGradient>" +
    '<radialGradient id="roundel2" cx="36%" cy="28%" r="82%">' +
    '<stop offset="0%" stop-color="#bcd8f8"/>' +
    '<stop offset="40%" stop-color="#5a86cc"/>' +
    '<stop offset="100%" stop-color="#143462"/>' +
    "</radialGradient>" +
    '<radialGradient id="portrait" cx="42%" cy="30%" r="82%">' +
    '<stop offset="0%" stop-color="#eef6ff"/>' +
    '<stop offset="40%" stop-color="#a8cef6"/>' +
    '<stop offset="78%" stop-color="#5183cf"/>' +
    '<stop offset="100%" stop-color="#28508f"/>' +
    "</radialGradient>" +
    '<linearGradient id="sea" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0%" stop-color="#7cbcf2"/>' +
    '<stop offset="55%" stop-color="#4a83c8"/>' +
    '<stop offset="100%" stop-color="#214e8e"/>' +
    "</linearGradient>" +
    '<radialGradient id="royalGlass" cx="50%" cy="34%" r="74%">' +
    '<stop offset="0%" stop-color="#27508f"/>' +
    '<stop offset="46%" stop-color="#1a3c74"/>' +
    '<stop offset="100%" stop-color="#13305f"/>' +
    "</radialGradient>" +
    '<radialGradient id="midGlass" cx="50%" cy="32%" r="76%">' +
    '<stop offset="0%" stop-color="#3a69a8"/>' +
    '<stop offset="48%" stop-color="#244e92"/>' +
    '<stop offset="100%" stop-color="#16356c"/>' +
    "</radialGradient>" +
    '<radialGradient id="laceCell" cx="50%" cy="50%" r="50%">' +
    '<stop offset="0%" stop-color="rgba(232,205,140,.02)"/>' +
    '<stop offset="72%" stop-color="rgba(232,205,140,.05)"/>' +
    '<stop offset="100%" stop-color="rgba(8,18,42,.28)"/>' +
    "</radialGradient>" +
    '<filter id="frost" x="-5%" y="-5%" width="110%" height="110%">' +
    '<feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" result="n"/>' +
    '<feColorMatrix in="n" type="matrix" values="0 0 0 0 0.72  0 0 0 0 0.84  0 0 0 0 1  0 0 0 0.06 0"/>' +
    "</filter>" +
    "</defs>";

  let svg = '<svg viewBox="0 0 680 680" xmlns="http://www.w3.org/2000/svg">' + defs;

  // 1. Outer halo glow + outer rim disc
  svg += '<circle cx="340" cy="340" r="338" fill="url(#halo)"/>';
  svg += '<circle cx="340" cy="340" r="336" fill="url(#royalGlass)"/>';
  svg += '<circle cx="340" cy="340" r="334" fill="#9fc0ff" filter="url(#frost)" opacity="0.55"/>';
  svg += '<circle cx="340" cy="340" r="336" fill="none" stroke="' + G(0.75) + '" stroke-width="2.5"/>';

  // 2. Calm tonal glass band (annulus r178..284)
  {
    const r0 = 178;
    const r1 = 284;
    svg +=
      '<path fill-rule="evenodd" fill="url(#midGlass)" d="' +
      "M" + 340 + " " + (340 - r1) + " a" + r1 + " " + r1 + " 0 1 0 0.01 0 Z " +
      "M" + 340 + " " + (340 - r0) + " a" + r0 + " " + r0 + ' 0 1 1 -0.01 0 Z"/>';
    for (let w = 0; w < 6; w++) {
      const la = (w / 6) * 2 * Math.PI - Math.PI / 2;
      const pa = P(r0, la);
      const pb = P(r1, la);
      svg +=
        '<line x1="' + f(pa[0]) + '" y1="' + f(pa[1]) + '" x2="' + f(pb[0]) + '" y2="' + f(pb[1]) +
        '" stroke="' + LEAD + '" stroke-width="1" opacity="0.45"/>';
    }
  }

  // 3. Interlocking-circle vesica lace band (annulus r292..332)
  {
    const R = 312;
    const cr = 24;
    const n = 80;
    const lo = Math.PI / n;
    const Rout = 332;
    const Rin = 292;
    svg +=
      '<clipPath id="laceClip"><path fill-rule="evenodd" d="' +
      "M340 " + (340 - Rout) + " a" + Rout + " " + Rout + " 0 1 0 0.01 0 Z " +
      "M340 " + (340 - Rin) + " a" + Rin + " " + Rin + ' 0 1 1 -0.01 0 Z"/></clipPath>';
    let cells = '<g clip-path="url(#laceClip)">';
    for (let k = 0; k < n; k++) {
      const a = lo + (k / n) * 2 * Math.PI;
      const p = P(R, a);
      cells += '<circle cx="' + f(p[0]) + '" cy="' + f(p[1]) + '" r="' + cr + '" fill="rgba(120,168,232,.62)"/>';
    }
    cells += "</g>";
    svg += cells;
    let came = '<g clip-path="url(#laceClip)" fill="none" stroke="#2c4170" stroke-width="1.2">';
    for (let k2 = 0; k2 < n; k2++) {
      const a2 = lo + (k2 / n) * 2 * Math.PI;
      const p2 = P(R, a2);
      came += '<circle cx="' + f(p2[0]) + '" cy="' + f(p2[1]) + '" r="' + cr + '"/>';
    }
    came += "</g>";
    svg += came;
    let gold = '<g clip-path="url(#laceClip)" fill="none" stroke="rgba(240,216,152,.95)" stroke-width="1.3">';
    for (let k3 = 0; k3 < n; k3++) {
      const a3 = lo + (k3 / n) * 2 * Math.PI;
      const p3 = P(R, a3);
      gold += '<circle cx="' + f(p3[0]) + '" cy="' + f(p3[1]) + '" r="' + cr + '"/>';
    }
    gold += "</g>";
    svg += gold;
    svg += '<circle cx="340" cy="340" r="' + Rout + '" fill="none" stroke="' + G(0.9) + '" stroke-width="1.5"/>';
    svg += '<circle cx="340" cy="340" r="' + Rin + '" fill="none" stroke="' + G(0.9) + '" stroke-width="1.5"/>';
  }

  // 4. Gold separator rings helper
  const sep = (r: number, wg: number, wb: number) => {
    svg += '<circle cx="340" cy="340" r="' + (r + 1.4) + '" fill="none" stroke="#0c1838" stroke-width="' + (wg + 1.6) + '"/>';
    svg += '<circle cx="340" cy="340" r="' + r + '" fill="none" stroke="' + G(0.78) + '" stroke-width="' + wg + '"/>';
    svg += '<circle cx="340" cy="340" r="' + (r - 3) + '" fill="none" stroke="' + B(0.2) + '" stroke-width="' + wb + '"/>';
  };
  sep(285, 2, 1);

  // 4b. Filigree beaded accent ring
  {
    const br = 283;
    const nb = 72;
    let beads = '<g fill="' + G(0.85) + '">';
    for (let b = 0; b < nb; b++) {
      const ba = (b / nb) * 2 * Math.PI;
      const bp = P(br, ba);
      beads += '<circle cx="' + f(bp[0]) + '" cy="' + f(bp[1]) + '" r="1.5"/>';
    }
    beads += "</g>";
    svg += beads;
  }

  // 5. Outer roundel ring — tangent emblem cabochons
  const emblem = (x: number, y: number, s: number): string => {
    const ring = s * 1.02;
    const dr = s * 0.92;
    let g =
      '<circle cx="' + f(x) + '" cy="' + f(y) + '" r="' + f(ring) +
      '" fill="rgba(20,42,86,.55)" stroke="' + G(0.95) + '" stroke-width="2.2"/>';
    g +=
      '<path d="M' + f(x) + " " + f(y - dr) + " L" + f(x + dr * 0.66) + " " + f(y) + " L" + f(x) + " " +
      f(y + dr) + " L" + f(x - dr * 0.66) + " " + f(y) + ' Z" fill="rgba(224,238,255,.97)" stroke="' +
      G(0.95) + '" stroke-width="1.4"/>';
    g +=
      '<path d="M' + f(x) + " " + f(y - dr) + " L" + f(x) + " " + f(y) + " L" + f(x - dr * 0.66) + " " +
      f(y) + ' Z" fill="rgba(255,255,255,.88)"/>';
    g +=
      '<path d="M' + f(x) + " " + f(y + dr) + " L" + f(x) + " " + f(y) + " L" + f(x + dr * 0.66) + " " +
      f(y) + ' Z" fill="rgba(110,150,210,.7)"/>';
    return g;
  };
  {
    const R = 242;
    const n = 24;
    const rr = R * Math.sin(Math.PI / n) * 1.08;
    const off = -Math.PI / 2;
    const bOut = R + rr + 1.5;
    const bIn = R - rr - 1.5;
    svg +=
      '<path fill-rule="evenodd" fill="#0a1430" d="' +
      "M340 " + (340 - bOut) + " a" + f(bOut) + " " + f(bOut) + " 0 1 0 0.01 0 Z " +
      "M340 " + (340 - bIn) + " a" + f(bIn) + " " + f(bIn) + ' 0 1 1 -0.01 0 Z"/>';
    for (let k = 0; k < n; k++) {
      const a = off + (k / n) * 2 * Math.PI;
      const p = P(R, a);
      const x = p[0];
      const y = p[1];
      svg += '<circle cx="' + f(x) + '" cy="' + f(y) + '" r="' + f(rr) + '" fill="url(#roundel)"/>';
      svg += '<circle cx="' + f(x) + '" cy="' + f(y) + '" r="' + f(rr) + '" fill="none" stroke="' + G(0.95) + '" stroke-width="2.2"/>';
      svg += '<circle cx="' + f(x) + '" cy="' + f(y) + '" r="' + f(rr - 2.4) + '" fill="none" stroke="' + LEAD + '" stroke-width="1.1"/>';
      svg += '<circle cx="' + f(x) + '" cy="' + f(y) + '" r="' + f(rr - 3.6) + '" fill="none" stroke="' + G(0.7) + '" stroke-width="0.9"/>';
      svg += emblem(x, y, rr * 0.46);
    }
  }

  // 7. No third ring — clean gold separator before the central medallion
  sep(196, 1.4, 0.8);

  // 8. Luminous central sky medallion (r176) with NYC skyline
  const medR = 176;
  svg += '<circle cx="340" cy="340" r="' + medR + '" fill="url(#sky)"/>';
  svg += '<clipPath id="med"><circle cx="340" cy="340" r="' + medR + '"/></clipPath>';
  let scene = '<g clip-path="url(#med)">';

  scene += '<path d="M196 246 Q340 226 484 246" fill="none" stroke="rgba(60,110,180,.28)" stroke-width="1.4"/>';
  scene += '<path d="M224 296 L218 360" fill="none" stroke="rgba(60,110,180,.20)" stroke-width="1.2"/>';
  scene += '<path d="M456 296 L462 360" fill="none" stroke="rgba(60,110,180,.20)" stroke-width="1.2"/>';

  const cloud = (cx: number, cy: number, s: number, op: number): string =>
    '<g fill="rgba(255,255,255,' + op + ')">' +
    '<ellipse cx="' + f(cx) + '" cy="' + f(cy) + '" rx="' + f(s * 1.6) + '" ry="' + f(s * 0.6) + '"/>' +
    '<ellipse cx="' + f(cx - s) + '" cy="' + f(cy + s * 0.2) + '" rx="' + f(s * 0.9) + '" ry="' + f(s * 0.5) + '"/>' +
    '<ellipse cx="' + f(cx + s * 1.1) + '" cy="' + f(cy + s * 0.18) + '" rx="' + f(s * 0.95) + '" ry="' + f(s * 0.5) + '"/>' +
    "</g>";
  scene += cloud(236, 276, 13, 0.5);
  scene += cloud(452, 288, 15, 0.4);

  const horizon = 420;
  const base = 520;
  const TWR = "#0d2548";
  const TWR2 = "#102a55";
  scene += '<rect x="160" y="' + horizon + '" width="360" height="' + (base - horizon) + '" fill="url(#sea)"/>';
  scene += '<rect x="160" y="' + (horizon + 10) + '" width="360" height="1.6" fill="rgba(206,232,255,.40)"/>';
  scene += '<rect x="160" y="' + (horizon + 30) + '" width="360" height="2" fill="rgba(220,240,255,.20)"/>';
  scene += '<rect x="160" y="' + (horizon + 54) + '" width="360" height="2" fill="rgba(220,240,255,.12)"/>';
  scene += '<rect x="172" y="' + (horizon - 1) + '" width="336" height="2.6" fill="' + G(0.85) + '"/>';

  const tower = (x: number, w: number, h: number, fill: string): string => {
    const y = horizon - h;
    let g = '<rect x="' + f(x) + '" y="' + f(y) + '" width="' + f(w) + '" height="' + f(h) + '" fill="' + fill + '" stroke="' + LEAD + '" stroke-width="1"/>';
    g += '<g fill="rgba(150,190,245,.22)">';
    for (let wy = y + 8; wy < horizon - 6; wy += 12) {
      for (let wx = x + 4; wx < x + w - 4; wx += 10) {
        g += '<rect x="' + f(wx) + '" y="' + f(wy) + '" width="4" height="6"/>';
      }
    }
    g += "</g>";
    return g;
  };

  scene += tower(190, 18, 52, TWR2);
  scene += tower(210, 22, 84, TWR);
  {
    const x = 238;
    const w = 16;
    const h = 120;
    const y = horizon - h;
    scene += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + TWR2 + '" stroke="' + LEAD + '" stroke-width="1"/>';
    scene += '<rect x="' + (x + w / 2 - 1) + '" y="' + (y - 26) + '" width="2" height="26" fill="' + TWR2 + '"/>';
    scene += '<circle cx="' + (x + w / 2) + '" cy="' + (y - 26) + '" r="1.8" fill="' + G(0.75) + '"/>';
  }
  scene += tower(258, 20, 70, TWR);
  {
    const cx = 300;
    scene += '<rect x="' + (cx - 26) + '" y="' + (horizon - 96) + '" width="52" height="96" fill="' + TWR + '" stroke="' + LEAD + '" stroke-width="1"/>';
    scene += '<rect x="' + (cx - 18) + '" y="' + (horizon - 150) + '" width="36" height="56" fill="' + TWR + '" stroke="' + LEAD + '" stroke-width="1"/>';
    scene += '<rect x="' + (cx - 11) + '" y="' + (horizon - 188) + '" width="22" height="40" fill="' + TWR2 + '" stroke="' + LEAD + '" stroke-width="1"/>';
    scene += '<path d="M' + (cx - 7) + " " + (horizon - 188) + " L" + cx + " " + (horizon - 214) + " L" + (cx + 7) + " " + (horizon - 188) + ' Z" fill="' + TWR2 + '" stroke="' + LEAD + '" stroke-width="1"/>';
    scene += '<rect x="' + (cx - 1.2) + '" y="' + (horizon - 238) + '" width="2.4" height="24" fill="' + TWR2 + '"/>';
    scene += '<circle cx="' + cx + '" cy="' + (horizon - 238) + '" r="2" fill="' + G(0.8) + '"/>';
  }
  scene += tower(330, 22, 76, TWR);
  {
    const cx = 362;
    scene += '<rect x="' + (cx - 15) + '" y="' + (horizon - 104) + '" width="30" height="104" fill="' + TWR + '" stroke="' + LEAD + '" stroke-width="1"/>';
    scene += '<path d="M' + (cx - 15) + " " + (horizon - 104) + " L" + cx + " " + (horizon - 150) + " L" + (cx + 15) + " " + (horizon - 104) + ' Z" fill="' + TWR2 + '" stroke="' + LEAD + '" stroke-width="1"/>';
    scene += '<rect x="' + (cx - 1) + '" y="' + (horizon - 170) + '" width="2" height="20" fill="' + TWR2 + '"/>';
  }
  scene += tower(386, 24, 64, TWR2);
  scene += tower(414, 18, 92, TWR);
  scene += tower(436, 22, 48, TWR2);
  scene += tower(460, 16, 72, TWR);
  scene += tower(480, 20, 40, TWR2);

  scene += "</g>";
  svg += scene;

  // 10. Medallion gold rim
  svg += '<circle cx="340" cy="340" r="' + medR + '" fill="none" stroke="' + G(0.95) + '" stroke-width="2.6"/>';
  svg += '<circle cx="340" cy="340" r="' + (medR - 4) + '" fill="none" stroke="' + LEAD + '" stroke-width="1"/>';

  svg += "</svg>";
  return svg;
}
