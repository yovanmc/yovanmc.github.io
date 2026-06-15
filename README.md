# portfolio-rpg

Yovan's recruiter-facing portfolio, built as an interactive **Kingdom Hearts–style RPG
command-menu** single-page app. Original design — no copyrighted game assets.

- **Stack:** Vite 5 + React 18 + TypeScript (plain inline styles + one CSS token file).
  Pinned to Vite 5 / React 18 because the local toolchain runs **Node 20.13** (Vite 7+
  requires Node 20.19+).
- **Fonts:** Google Fonts — Marcellus (display), Sora (UI/body), JetBrains Mono (labels).

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # tsc -b && vite build  → dist/
npm run preview  # serve the production build
```

## Structure

| Path | Responsibility |
|---|---|
| `src/App.tsx` | The whole RPG state machine + desktop/mobile layout (booted / col / rootIdx / subIdx / page / toast / w). |
| `src/content.ts` | `CATS` content model (Projects / Experience / Contact). **Placeholder copy — replace with Yovan's real content before deploy.** |
| `src/station/buildStationSvg.ts` | The signature stained-glass **Station** as pure SVG. Geometry is LOCKED (faithful port of the approved design). |
| `src/components/Station.tsx` | Renders the Station SVG with a gentle breathe (no hue-rotate, to keep the tuned blue palette). |
| `src/components/Atmosphere.tsx` | Aurora blobs + deterministic drifting particles. |
| `src/components/CaseStudyPage.tsx` | Full-screen case-study overlay (projects & experience). |
| `src/lib/rng.ts` | Seeded LCG for stable particle placement. |
| `src/styles/tokens.css` | Reset, keyframes, scrollbar styling, reduced-motion guard. |

## Design source of truth

The design spec lives in the (separate) Astro repo at
`design_handoff_portfolio/README.md` + `Portfolio.dc.html`. This project **recreates** that
prototype in React; it does not port the prototype's `support.js` runtime.

## Status

Scaffold complete: hero (Station + name), desktop command menu, detail panel, case-study
overlay, mobile sheet + command bar, keyboard/mouse/touch input, WebAudio blips. Content is
still placeholder. Not yet wired to a deployment target.
