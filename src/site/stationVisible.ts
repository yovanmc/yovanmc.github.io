/**
 * Where App.tsx mounts the stained-glass Station: the dive's landing geometry
 * only (DiveIntro's end pose lands on siteStationGeometry). It is not behind
 * the play menu world or on the gate/browse/build/battle surfaces.
 */
export type StationPhase = "intro" | "gate" | "play" | "browse" | "build" | "battle";

export function stationVisible(phase: StationPhase): boolean {
  return phase === "intro";
}
