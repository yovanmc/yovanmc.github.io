/**
 * Content model for the RPG command menu.
 *
 * Projects + Contact (GitHub) are Yovan's REAL, confidentiality-reviewed content,
 * carried over from the vetted case studies in the Astro portfolio repo. EXPERIENCE
 * entries and the Contact email/LinkedIn are still PLACEHOLDER pending Yovan's input
 * (employer names + which contact details to publish are privacy/confidentiality calls).
 */

export type Metric = [value: string, label: string];

export interface Link {
  label: string;
  url: string;
}

export interface Item {
  title: string;
  meta: string;
  stat: string;
  body: string;
  /** longer case-study overview; falls back to `body` when absent */
  summary?: string;
  /** projects only */
  metrics?: Metric[];
  tags: string[];
  /** detail-panel primary button (opens the case study for projects/experience) */
  link?: string;
  linkLabel?: string;
  /** contact: value copied to clipboard */
  copy?: string;
  /** case-study page outbound button: a source repo */
  repo?: string;
  /** case-study page outbound button: a public announcement */
  announcement?: Link;
  /** case-study page: external sources / press */
  sources?: Link[];
}

export interface Category {
  key: "projects" | "experience" | "contact";
  label: string;
  blurb: string;
  /** small count/glyph shown next to the command row */
  tag: string;
  items: Item[];
}

export const CATS: Category[] = [
  {
    key: "projects",
    label: "Projects",
    blurb: "Systems I have designed, shipped and kept alive in production.",
    tag: "09",
    items: [
      {
        title: "MIA",
        meta: "AI assistant at launch scale",
        stat: "Millions of conversations",
        body: "The AI assistant UWM publicly launched reaches borrowers by voice and text. I built the text channel and the backbone that gives every user their own dedicated number.",
        summary:
          "MIA is the AI assistant United Wholesale Mortgage built for its brokers, reaching borrowers by both voice and text. I worked on the text side and on the foundation underneath both channels. The piece I am proudest of is the dedicated number every user gets — 50,000 at launch, one per user — which routes to their personal MIA across calls and texts, loaded with their context. A broker can put it on a business card and it just works; you cannot do that with a shared short code, and per-user numbers are also what kept routing, replies, deliverability, and compliance manageable at scale. I designed and led the lifecycle of that backbone. MIA launched in 2025 at UWM LIVE! and the platform has since carried millions of borrower conversations.",
        metrics: [
          ["Millions", "borrower conversations"],
          ["50K", "dedicated numbers, one per user"],
          ["2025", "launched at UWM LIVE!"],
        ],
        tags: ["Messaging", "Telephony", "AI tooling"],
        link: "#",
        linkLabel: "CASE STUDY",
        announcement: { label: "READ UWM'S ANNOUNCEMENT", url: "https://www.uwm.com/press-release-may-15-2025-2" },
        sources: [
          { label: "UWM: Mia announcement (May 2025)", url: "https://www.uwm.com/press-release-may-15-2025-2" },
          { label: "HousingWire: UWM's AI tools (LEO and Mia)", url: "https://www.housingwire.com/articles/uwm-ai-tools-leo-mia-offer-analysis-virtual-borrower-assistance/" },
          { label: "Scotsman Guide: \"Hi, this is Mia\"", url: "https://www.scotsmanguide.com/news/united-wholesale-mortgage-premieres-ai-loan-officer-assistant/" },
          { label: "Mortgage Professional America: \"This has never been done\"", url: "https://www.mpamag.com/us/specialty/wholesale/mortgage-giant-launches-ai-powered-loan-officer-assistant-this-has-never-been-done-ever/536038" },
          { label: "HousingWire: Mia after one year", url: "https://www.housingwire.com/articles/uwm-mia-borrower-engagement/" },
        ],
      },
      {
        title: "Backend-harness",
        meta: "An outer loop for autonomous backend work",
        stat: "Resumable mid-run",
        body: "A single coding agent on a real backend repo runs out of context, grades its own work, and writes code that is confidently wrong. I built the orchestration layer it was missing.",
        summary:
          "Backend-harness sits on top of an existing inner loop and adds the outer loop it does not have. An orchestrator runs the whole thing and never reads the code itself; the agent that writes code and the agent that evaluates it are kept apart, with separate context, so the implementer cannot pass by grading its own work. Around that it runs the checks a careful developer would — unit, integration, and live API tests, plus a tiered mutation-testing gate so coverage means tests that catch a changed line. The two parts I am proudest of: disk-state resumability (it writes full state after every step and resumes at the exact phase it left off) and oscillation detection (it tracks failure identity and escalates to a person when the agent starts going in circles). It runs the same whether the agent underneath is Claude Code or Codex, is validated against .NET, and is open source under MIT.",
        metrics: [["Resumable", "recovers from interruption mid-run"]],
        tags: ["Agentic systems", "Orchestration", "Mutation testing"],
        link: "#",
        linkLabel: "CASE STUDY",
        repo: "https://github.com/yovanmc/backend-harness",
      },
      {
        title: "The failure that left no logs",
        meta: "Cross-stack production debugging",
        stat: "3 layers, no errors",
        body: "Requests were being silently rejected and quietly retried, invisible to every dashboard. I traced the cause across a message bus, an HTTP ingress, and the OS network stack.",
        summary:
          "A service showed slightly lower throughput and one report of a message that never sent — but the audit trail showed no failures anywhere. I traced a message by hand and it never made it past the message-bus hop. The first real clue was an HTML 400 sitting in the retry topic's error field, from a path that did not emit HTML: something downstream was rejecting requests before our code ever saw them, and its logs were not in the observability tooling. That led me to Http.sys, the OS-level driver in front of every request. Backtracking ~50 requests one at a time revealed the pattern: every rejected request carried the same malformed header (a library was writing non-ASCII bytes), and Http.sys refuses those on sight. Rather than fight it, I routed around it with a consumer that pulled messages off the topic partitions directly, removing the HTTP layer entirely — zero changes required from any consumer, same at-least-once guarantees. Every negative indicator fell to zero as the change rolled out. The lesson stuck: just because every tool says everything is fine does not mean it is.",
        metrics: [["3 layers", "message bus → OS kernel"]],
        tags: ["Message bus", "Observability", "Cross-stack debugging"],
        link: "#",
        linkLabel: "CASE STUDY",
      },
      {
        title: "Observability by default",
        meta: "SRE automation at UWM, shown to Dynatrace's guild",
        stat: "Seconds to set up",
        body: "I automated reliability-guardian setup against Dynatrace's API, turning a manual, per-team job into something any team could stand up in seconds with golden-signal observability built in.",
        summary:
          "A reliability guardian watches a service against health objectives and flags it when it drifts out of bounds. Setting one up in Dynatrace was a manual, per-team job — slow, easy to skip, and inconsistent across services. I automated the whole setup against Dynatrace's API so a team could stand one up in seconds with golden-signal observability built in from the start, and wired our load testing in so stress-test results became part of the health picture. Observability became a one-button setup, realistic to roll out across many services. In May 2024 Dynatrace invited me and an enterprise architect to present the work to their global automation guild as a reference implementation for enterprise-scale reliability. The part I am proudest of is that it was not a one-off — other people could use it without thinking about the plumbing underneath, and that is the part that actually scaled.",
        metrics: [["Seconds", "to stand up what had been manual"]],
        tags: ["Observability", "Automation", "SRE"],
        link: "#",
        linkLabel: "CASE STUDY",
      },
      {
        title: "notification-dispatch",
        meta: "Event-driven dispatcher",
        stat: "",
        body: "An event-driven C# dispatcher built on Redis Streams, with retries, a dead-letter queue, and first-class observability.",
        summary:
          "An event-driven C# notification dispatcher built on Redis Streams. It handles retries, routes anything that ultimately fails into a dead-letter queue, and ships with first-class observability so the health of the pipeline is visible rather than inferred.",
        tags: ["C#", "Redis Streams"],
        link: "#",
        linkLabel: "CASE STUDY",
        repo: "https://github.com/yovanmc/notification-dispatch",
      },
      {
        title: "VideoTriage",
        meta: "Verified, crash-safe re-encode tool",
        stat: "",
        body: "A video re-encode and triage tool that replaces files in place only after a parity check, so a smaller encode never costs you the original.",
        summary:
          "VideoTriage re-encodes and triages a video library, replacing files in place only after a verified parity check — a smaller encode is swapped in only once it is proven to match the original on resolution, audio, and decode. The swap is crash-safe and the original is never lost; deletions are recoverable and audited.",
        tags: [".NET", "WPF", "HandBrake"],
        link: "#",
        linkLabel: "CASE STUDY",
        repo: "https://github.com/yovanmc/VideoTriage",
      },
      {
        title: "AudioShelf",
        meta: "Spoken-audio library player",
        stat: "",
        body: "A spoken-audio library player with chapter-aware, per-author continue-listening.",
        summary:
          "AudioShelf is a Windows spoken-audio library and player. It tracks chapter-aware progress and offers per-author continue-listening, so picking up where you left off works the way it should across a large library of long-form audio.",
        tags: ["Tauri", "React", "SQLite"],
        link: "#",
        linkLabel: "CASE STUDY",
        repo: "https://github.com/yovanmc/AudioShelf",
      },
      {
        title: "MangaReader",
        meta: "Local-first comic reader",
        stat: "",
        body: "A local-first manga and comic reader with archive (CBZ/CBR/CB7) and embedded-metadata support.",
        summary:
          "MangaReader is a local-first manga and comic reader. It reads CBZ/CBR/CB7 archives directly, pulls embedded metadata, and is strictly read-only against your library — built for fast browsing and reading at the scale of a real collection.",
        tags: ["Tauri", "React", "SQLite"],
        link: "#",
        linkLabel: "CASE STUDY",
        repo: "https://github.com/yovanmc/MangaReader",
      },
      {
        title: "VideoShelf",
        meta: "Play-everything video library",
        stat: "",
        body: "A play-everything video library and player with a personal home, watch stats, and subtitle sidecars.",
        summary:
          "VideoShelf is a play-everything Windows video library and player. It scans and organizes a collection, surfaces a personal home with watch stats and continue-watching, plays effectively any format via LibVLC, and supports subtitle sidecars — the video counterpart to AudioShelf.",
        tags: [".NET", "WPF", "LibVLCSharp"],
        link: "#",
        linkLabel: "CASE STUDY",
        repo: "https://github.com/yovanmc/VideoShelf",
      },
    ],
  },
  {
    key: "experience",
    label: "Experience",
    blurb: "Where I have built systems and grown the teams around them.",
    tag: "01",
    items: [
      {
        title: "Software Engineer",
        meta: "United Wholesale Mortgage",
        stat: "2022 — Present",
        body: "Backend and platform engineering at United Wholesale Mortgage — the messaging backbone behind the MIA assistant, observability automation, and cross-stack production debugging.",
        summary:
          "Software Engineer at United Wholesale Mortgage since 2022, working on backend and platform systems. I built the text channel and the per-user-number backbone behind MIA, the AI assistant UWM launched to its brokers; automated golden-signal observability so any team could stand up reliability checks in seconds (work Dynatrace invited me to present to their global automation guild); and chased down the kind of cross-stack failures that never show up on a dashboard. The throughline is systems other people can rely on without having to think about the plumbing underneath.",
        tags: ["C#", "Distributed systems", "Observability", "SRE"],
        link: "",
        linkLabel: "",
      },
    ],
  },
  {
    key: "contact",
    label: "Contact",
    blurb: "Open to interesting backend and infrastructure problems. Say hello.",
    tag: "→",
    items: [
      {
        title: "GitHub",
        meta: "github.com/yovanmc",
        stat: "",
        body: "Open-source experiments, infrastructure tools, and the occasional weekend rabbit hole.",
        tags: ["Code"],
        link: "https://github.com/yovanmc",
        linkLabel: "OPEN PROFILE",
      },
      {
        title: "Email",
        meta: "Yovmcollins@gmail.com",
        stat: "",
        body: "The fastest way to reach me. I read everything and reply to most.",
        tags: ["Inbox"],
        copy: "Yovmcollins@gmail.com",
        link: "mailto:Yovmcollins@gmail.com",
        linkLabel: "COPY ADDRESS",
      },
      {
        title: "LinkedIn",
        meta: "linkedin.com/in/yovanmcollins",
        stat: "",
        body: "Roles, history and the more professional version of all of the above.",
        tags: ["Network"],
        link: "https://www.linkedin.com/in/yovanmcollins",
        linkLabel: "OPEN PROFILE",
      },
    ],
  },
];
