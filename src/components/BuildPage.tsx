import facts from "virtual:build-facts";
import { Figure } from "./Figure";
import { PIPELINE_FIGURE } from "../figures/pipelineFigure";
import { shouldRouteInApp } from "../site/linkClick";
import {
  title,
  numbersIntro,
  numbersFootnote,
  coveragePopulation,
  coverageScopeNote,
  serveModeLine,
  numberLabels,
  pipelineIntro,
  pipelineFootnote,
  lessonsHeading,
  lessonsIntro,
  lessons,
  repoIntro,
  repoLinkLabel,
  repoUrl,
  backLabel,
} from "../buildCopy";

const MONO = "'JetBrains Mono',monospace";
const SERIF = "'Marcellus',serif";

/**
 * The /build/ engineering page: a build-time numbers strip, the
 * verification-pipeline figure, three lesson write-ups and a repo link.
 * Shaped like BrowseIndex; ESC/Backspace go through App.tsx's browse key
 * path, so this adds no keyboard handling.
 *
 * facts is null in serve mode; the strip then shows serveModeLine rather
 * than zeros that would read as real data.
 */
export interface BuildPageProps {
  isMobile: boolean;
  onBack: () => void;
}

interface Tile {
  label: string;
  value: string;
}

export function BuildPage({ isMobile, onBack }: BuildPageProps) {
  const tiles: Tile[] = facts
    ? [
        { label: numberLabels.tests, value: String(facts.tests) },
        { label: numberLabels.testFiles, value: String(facts.testFiles) },
        { label: numberLabels.branchesPct, value: `${facts.branchesPct}%` },
        { label: numberLabels.branchFloor, value: `${facts.branchFloor}%` },
        { label: numberLabels.shareShells, value: String(facts.shareShells) },
        { label: numberLabels.runtimeDeps, value: String(facts.runtimeDeps) },
      ]
    : [];

  return (
    <main
      id="main"
      tabIndex={-1}
      data-ui
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 8,
        display: "flex",
        justifyContent: "center",
        overflowY: "auto",
        padding: isMobile ? "0" : "48px 20px 40px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: isMobile ? "none" : "720px",
          height: "max-content",
          minHeight: isMobile ? "100%" : "auto",
          background: "linear-gradient(165deg, rgba(14,28,56,.88), rgba(8,14,30,.9))",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          border: isMobile ? "none" : "1px solid rgba(130,180,255,.26)",
          borderRadius: isMobile ? 0 : "18px",
          boxShadow: isMobile ? "none" : "inset 0 0 0 1px rgba(255,255,255,.04), 0 30px 80px -24px rgba(0,0,0,.8)",
          padding: isMobile ? "26px 18px 60px" : "34px 40px 40px",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
          <h1 style={{ margin: 0, fontFamily: SERIF, fontSize: isMobile ? "26px" : "30px", letterSpacing: ".02em", color: "#eaf1ff" }}>
            {title}
          </h1>
          <a
            href="/"
            onClick={(e) => {
              if (!shouldRouteInApp(e)) return;
              e.preventDefault();
              onBack();
            }}
            style={{
              fontFamily: MONO,
              fontSize: "11.5px",
              letterSpacing: ".1em",
              color: "#b9d2f8",
              padding: "9px 14px",
              borderRadius: "9px",
              cursor: "pointer",
              background: "rgba(80,150,255,.1)",
              border: "1px solid rgba(140,185,255,.3)",
              textDecoration: "none",
            }}
          >
            <span style={{ color: "#9fc4ff" }}>▸</span> {backLabel}
          </a>
        </div>

        <section style={{ marginTop: "30px" }}>
          <div style={{ fontFamily: MONO, fontSize: "13px", letterSpacing: ".02em", color: "#8ea0bd" }}>{numbersIntro}</div>
          {facts ? (
            <>
              <div
                style={{
                  marginTop: "16px",
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                  gap: "12px",
                }}
              >
                {tiles.map((t) => (
                  <div
                    key={t.label}
                    style={{
                      padding: "16px 18px",
                      borderRadius: "13px",
                      background: "rgba(255,255,255,.02)",
                      border: "1px solid rgba(140,185,255,.18)",
                    }}
                  >
                    <div style={{ fontFamily: SERIF, fontSize: "26px", color: "#eaf1ff" }}>{t.value}</div>
                    <div
                      style={{
                        marginTop: "6px",
                        fontFamily: MONO,
                        fontSize: "10px",
                        letterSpacing: ".12em",
                        color: "#9fb6d6",
                        textTransform: "uppercase",
                      }}
                    >
                      {t.label}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: "12px", fontFamily: MONO, fontSize: "10.5px", letterSpacing: ".04em", color: "#5f7196" }}>
                {coveragePopulation}. {coverageScopeNote}
              </div>
              <div style={{ marginTop: "6px", fontFamily: MONO, fontSize: "10.5px", letterSpacing: ".04em", color: "#5f7196" }}>
                {numbersFootnote}
              </div>
            </>
          ) : (
            <div
              style={{
                marginTop: "16px",
                padding: "16px 18px",
                borderRadius: "13px",
                background: "rgba(255,255,255,.02)",
                border: "1px solid rgba(140,185,255,.18)",
                fontFamily: MONO,
                fontSize: "12px",
                color: "#9fb6d6",
              }}
            >
              {serveModeLine}
            </div>
          )}
        </section>

        <section style={{ marginTop: "34px" }}>
          <div style={{ fontFamily: MONO, fontSize: "13px", letterSpacing: ".02em", color: "#8ea0bd" }}>{pipelineIntro}</div>
          <div style={{ marginTop: "16px" }}>
            <Figure figure={PIPELINE_FIGURE} projectTitle="How this site is verified" />
          </div>
          <div style={{ marginTop: "12px", fontFamily: MONO, fontSize: "10.5px", letterSpacing: ".04em", color: "#5f7196" }}>
            {pipelineFootnote}
          </div>
        </section>

        <section style={{ marginTop: "34px" }}>
          <h2 style={{ margin: 0, fontFamily: SERIF, fontSize: "19px", color: "#eaf1ff" }}>{lessonsHeading}</h2>
          <div style={{ marginTop: "8px", fontFamily: MONO, fontSize: "13px", letterSpacing: ".02em", color: "#8ea0bd" }}>
            {lessonsIntro}
          </div>
          <ul style={{ marginTop: "16px", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "8px" }}>
            {lessons.map((l) => (
              <li
                key={l.title}
                style={{
                  padding: "13px 14px",
                  borderRadius: "11px",
                  background: "rgba(255,255,255,.02)",
                  border: "1px solid rgba(140,185,255,.14)",
                }}
              >
                <div style={{ color: "#eaf1ff", fontSize: "14px" }}>
                  <span style={{ color: "#7fb0ff" }}>▸</span> {l.title}
                </div>
                <div style={{ marginTop: "6px", fontFamily: MONO, fontSize: "12px", lineHeight: 1.6, color: "#9fb6d6" }}>
                  {l.body}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section style={{ marginTop: "34px" }}>
          <div style={{ fontFamily: MONO, fontSize: "13px", letterSpacing: ".02em", color: "#8ea0bd" }}>{repoIntro}</div>
          <a
            href={repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "10px",
              marginTop: "14px",
              padding: "13px 22px",
              borderRadius: "11px",
              background: "linear-gradient(100deg, rgba(80,150,255,.28), rgba(80,150,255,.08))",
              border: "1px solid rgba(140,185,255,.4)",
              color: "#eaf2ff",
              fontSize: "14px",
              letterSpacing: ".06em",
              textDecoration: "none",
            }}
          >
            <span style={{ color: "#9fc4ff" }}>▸</span> {repoLinkLabel}
          </a>
        </section>

        <div style={{ marginTop: "26px", fontFamily: MONO, fontSize: "10.5px", letterSpacing: ".12em", color: "#5f7196", textAlign: "center" }}>
          <span style={{ color: "#9fc4ff" }}>ESC</span> BACK TO ENTRY
        </div>
      </div>
    </main>
  );
}
