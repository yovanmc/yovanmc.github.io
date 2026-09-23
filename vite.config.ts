import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { CATS } from "./src/content";
import { ogBrowseDescription, ogRootDescription } from "./src/landingCopy";
import { computeBuildFacts, BuildFactsError, type BuildMode } from "./tools/build-facts";
import { shellPaths } from "./src/site/shellPaths";

export { shellPaths };

const VIRTUAL_BUILD_FACTS_ID = "virtual:build-facts";
const RESOLVED_BUILD_FACTS_ID = "\0" + VIRTUAL_BUILD_FACTS_ID;

/** Resolves virtual:build-facts to the numbers the /build/ page renders,
 * computed at build time from the test run and git. Build mode fails the
 * build (this.error) on a missing or stale input; serve mode never touches
 * the filesystem and yields null. */
function buildFacts(): Plugin {
  let mode: BuildMode = "build";
  return {
    name: "build-facts",
    configResolved(config) {
      mode = config.command === "serve" ? "serve" : "build";
    },
    resolveId(id) {
      if (id === VIRTUAL_BUILD_FACTS_ID) return RESOLVED_BUILD_FACTS_ID;
    },
    load(id) {
      if (id !== RESOLVED_BUILD_FACTS_ID) return;
      let facts;
      try {
        facts = computeBuildFacts({ rootDir: __dirname, mode });
      } catch (err) {
        const message = err instanceof BuildFactsError ? err.message : String(err);
        this.error(`build-facts: ${message}`);
      }
      return `export default ${JSON.stringify(facts)};`;
    },
  };
}

const SITE = "https://yovanmc.github.io";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function ogBlock(title: string, desc: string, url: string): string {
  return [
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="Yovan Collins, Backend Software Engineer" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(desc)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta property="og:image" content="${SITE}/og-station.png" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<link rel="canonical" href="${esc(url)}" />`,
  ].join("\n    ");
}

function shareShells(): Plugin {
  return {
    name: "share-shells",
    closeBundle() {
      const dist = resolve(__dirname, "dist");
      const base = readFileSync(resolve(dist, "index.html"), "utf8");
      let count = 0;
      for (const cat of CATS) {
        if (cat.key === "contact") continue;
        const prefix = cat.key === "experience" ? "experience" : "work";
        for (const item of cat.items) {
          if (!item.slug) continue;
          const url = `${SITE}/${prefix}/${item.slug}/`;
          const title = `${item.title} | Yovan Collins`;
          const html = base
            .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
            .replace(
              /<meta name="description"[^>]*\/>/,
              `<meta name="description" content="${esc(item.meta)}" />\n    ${ogBlock(title, item.meta, url)}`,
            );
          const dir = resolve(dist, prefix, item.slug);
          mkdirSync(dir, { recursive: true });
          writeFileSync(resolve(dir, "index.html"), html);
          count++;
        }
      }
      // /work/ index shell, counted separately so the slug-count
      // guard keeps its discriminating power.
      const browseUrl = `${SITE}/work/`;
      const browseTitle = "Work & Experience | Yovan Collins";
      const browseHtml = base
        .replace(/<title>[^<]*<\/title>/, `<title>${esc(browseTitle)}</title>`)
        .replace(
          /<meta name="description"[^>]*\/>/,
          `<meta name="description" content="${esc(ogBrowseDescription)}" />\n    ${ogBlock(browseTitle, ogBrowseDescription, browseUrl)}`,
        );
      const browseDir = resolve(dist, "work");
      mkdirSync(browseDir, { recursive: true });
      writeFileSync(resolve(browseDir, "index.html"), browseHtml);

      // Outside the counted loop, like /work/, so the count !== 8 guard stays
      // scoped to slug shells. src/buildCopy.ts holds the on-page title, not
      // this shell's OG copy.
      const buildUrl = `${SITE}/build/`;
      const buildTitle = "Build notes | Yovan Collins";
      const buildDescription = "Numbers and a verification pipeline for this site, computed at build time from the test run and git.";
      const buildHtml = base
        .replace(/<title>[^<]*<\/title>/, `<title>${esc(buildTitle)}</title>`)
        .replace(
          /<meta name="description"[^>]*\/>/,
          `<meta name="description" content="${esc(buildDescription)}" />\n    ${ogBlock(buildTitle, buildDescription, buildUrl)}`,
        );
      const buildDir = resolve(dist, "build");
      mkdirSync(buildDir, { recursive: true });
      writeFileSync(resolve(buildDir, "index.html"), buildHtml);

      // root og block
      const rootUrl = `${SITE}/`;
      const rootTitle = "Yovan Collins, Backend Software Engineer";
      writeFileSync(
        resolve(dist, "index.html"),
        base.replace(
          /<meta name="description"[^>]*\/>/,
          `<meta name="description" content="${esc(ogRootDescription)}" />\n    ${ogBlock(rootTitle, ogRootDescription, rootUrl)}`,
        ),
      );
      this.warn(`share-shells: wrote ${count} slug shells + browse shell + build shell`);
      if (count !== 8) this.error(`share-shells: expected 8 slug shells, wrote ${count}, slugs out of sync`);

      // sitemap.xml + robots.txt: built from the same urls the shells above
      // were, so a slug can never appear in the shells but not the sitemap or
      // vice versa.
      writeFileSync(resolve(dist, "sitemap.xml"), buildSitemap(sitemapUrls()));
      writeFileSync(resolve(dist, "robots.txt"), buildRobots());
    },
  };
}

/** Every URL the site advertises to crawlers: root, /work/, /build/ and each
 * project/experience shell. Pure, for sitemap.test.ts. Derived from the same
 * shellPaths() share-shells writes, so shells and sitemap cannot disagree. */
export function sitemapUrls(): string[] {
  return [`${SITE}/`, ...shellPaths().map((p) => `${SITE}${p}`)];
}

function buildSitemap(urls: string[]): string {
  const body = urls.map((u) => `  <url><loc>${esc(u)}</loc></url>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

function buildRobots(): string {
  return `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`;
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), shareShells(), buildFacts()],
});
