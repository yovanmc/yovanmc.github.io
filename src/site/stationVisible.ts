/**
 * Where App.tsx mounts the stained-glass Station. It is the dive's landing
 * geometry only - DiveIntro's end pose lands on siteStationGeometry, and the
 * intro overlay fades to reveal it. It does not sit behind the play menu world
 * (the post-battle "projects unlocked" screen), and it stays off the
 * gate/browse/build/battle surfaces.
 */
export type StationPhase = "intro" | "gate" | "play" | "browse" | "build" | "battle";

export function stationVisible(phase: StationPhase): boolean {
  return phase === "intro";
}
