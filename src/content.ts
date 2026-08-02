/**
 * Content model for the RPG command menu.
 *
 * ALL copy in this file is Yovan's own writing, confidentiality-reviewed
 * (carried over from the vetted Astro case studies, then extended). Do NOT
 * rewrite, re-tone, or "improve" any prose here — content changes go through
 * the owner. See docs/superpowers/specs/2026-07-02-spectacle-and-battle-design.md.
 */

export type Metric = [value: string, label: string];

export interface Link {
  label: string;
  url: string;
}

export interface Item {
  title: string;
  /** stable URL segment for routing + static share shells (S1b); never derived from title at runtime */
  slug?: string;
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
        slug: "mia",
        meta: "AI assistant at launch scale",
        stat: "Millions of conversations",
        body: "The AI assistant UWM publicly launched reaches borrowers by voice and text. I built the text channel and the backbone that gives every user their own dedicated number.",
        summary:
          "MIA is the AI assistant United Wholesale Mortgage built for its brokers, reaching borrowers by both voice and text. I worked on the text side and on the foundation underneath both channels. The part I am most proud of building is the dedicated number every user gets (50,000 at launch, one per user) which routes to their personal MIA across calls and texts, loaded with their context. A broker can put it on a business card and it just works. This isn't possible with a shared short code, and per-user numbers are also what kept routing, replies, deliverability, and compliance manageable at scale. I designed and led the lifecycle of that backbone. MIA launched in 2025 at UWM LIVE! and the platform has since carried millions of borrower conversations.",
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
        slug: "backend-harness",
        meta: "An outer loop for autonomous backend work",
        stat: "Resumable mid-run",
        body: "A single coding agent on a real backend repo runs out of context, grades its own work, and writes code that is confidently wrong. I built the orchestration layer it was missing.",
        summary:
          "Backend-harness sits on top of an existing inner loop and adds the outer loop it does not have. An orchestrator runs the whole thing and never reads the code itself. The agent that writes code and the agent that evaluates it are kept apart, with separate context, so the implementer cannot pass by grading its own work. Around that it runs the checks a careful developer would: unit, integration, and live API tests, plus a tiered mutation-testing gate so coverage means tests that catch a changed line. The two parts I am most proud of building: disk-state resumability (it writes full state after every step and resumes at the exact phase it left off) and oscillation detection (it tracks failure identity and escalates to a person when the agent starts going in circles). It runs the same whether the agent underneath is Claude Code or Codex, is validated against .NET, and is open source under MIT.",
        metrics: [["Resumable", "recovers from interruption mid-run"]],
        tags: ["Agentic systems", "Orchestration", "Mutation testing"],
        link: "#",
        linkLabel: "CASE STUDY",
        repo: "https://github.com/yovanmc/backend-harness",
      },
      {
        title: "The failure that left no logs",
        slug: "the-failure-that-left-no-logs",
        meta: "Cross-stack production debugging",
        stat: "3 layers, no errors",
        body: "Requests were being silently rejected and quietly retried, invisible to every dashboard. I traced the cause across a message bus, an HTTP ingress, and the OS network stack.",
        summary:
          "A service showed slightly lower throughput and one report of a message that never sent, but the audit trail showed no failures anywhere. I traced a message by hand and it never made it past the message-bus hop. The first real clue was an HTML 400 sitting in the retry topic's error field, from a path that did not emit HTML: something downstream was rejecting requests before our code ever saw them, and its logs were not in the observability tooling. That led me to Http.sys, the OS-level driver in front of every request. Backtracking ~50 requests one at a time revealed the pattern: every rejected request carried the same malformed header (a library was writing non-ASCII bytes), and Http.sys refuses those on sight. Rather than fight it, I routed around it with a consumer that pulled messages off the topic partitions directly, removing the HTTP layer entirely. Zero changes were required from any consumer, with the same at-least-once guarantees. Every negative indicator fell to zero as the change rolled out. The lesson stuck: just because every tool says everything is fine does not mean it is.",
        metrics: [["3 layers", "message bus → OS kernel"]],
        tags: ["Message bus", "Observability", "Cross-stack debugging"],
        link: "#",
        linkLabel: "CASE STUDY",
      },
      {
        title: "Observability by default",
        slug: "observability-by-default",
        meta: "SRE automation at UWM, shown to Dynatrace's guild",
        stat: "Seconds to set up",
        body: "I automated reliability-guardian setup against Dynatrace's API, turning a manual, per-team job into something any team could stand up in seconds with golden-signal observability built in.",
        summary:
          "A reliability guardian watches a service against health objectives and flags it when it drifts out of bounds. Setting one up in Dynatrace was a manual, per-team job. It was slow, easy to skip, and inconsistent across services. I automated the whole setup against Dynatrace's API so a team could stand one up in seconds with golden-signal observability built in from the start, and wired our load testing in so stress-test results became part of the health picture. Observability became a one-button setup, realistic to roll out across many services. In May 2024 Dynatrace invited me and an enterprise architect to present the work to their global automation guild as a reference implementation for enterprise-scale reliability. I am most proud that it was not a one-off. Other people could use it without thinking about the plumbing underneath, and that is the part that actually scaled.",
        metrics: [["Seconds", "to stand up what had been manual"]],
        tags: ["Observability", "Automation", "SRE"],
        link: "#",
        linkLabel: "CASE STUDY",
      },
      {
        title: "notification-dispatch",
        slug: "notification-dispatch",
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
        title: "Curio",
        slug: "curio",
        meta: "One app for video, audio, comics, and music",
        stat: "4 apps → 1",
        body: "Curio started as a video player and snowballed into a centralized experience for all media (video, audio, comics, and music). It superseded four of my own applications and serves its own phone companion.",
        summary:
          "Curio was originally a video player. I liked the style of Windows' Movies & TV app but wanted to expand it with capabilities common in applications like Plex, and I wanted the same unified experience for audio, with features like the old Windows XP Media Player visualizations. The app snowballed into a centralized experience. Once I realized that I had separate apps for video, audio, books, and comics, I decided one unified codebase was easier to handle and build off of. Curio superseded all four. My role was direction and database design. I had Claude handle how the code would work, and I focused on making sure the database would never need to be redone over and over. One of the hardest parts was the phone companion. I had a central app and server, but how that experience would translate to mobile or tablets was initially a mystery to me. I had to work through constraints such as screen size, UX, and keeping that experience consistent across different screen sizes. The desktop app self-hosts as the server for that companion. The code is private for now.",
        metrics: [
          ["4 → 1", "separate apps unified into one platform"],
          ["Video · audio · comics · music", "one library, one experience"],
          ["Self-hosting", "the desktop app serves its own phone companion"],
        ],
        tags: ["C#", "WPF", "SQLite", "PWA"],
        link: "#",
        linkLabel: "CASE STUDY",
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
        slug: "software-engineer",
        meta: "United Wholesale Mortgage",
        stat: "2022 - present",
        body: "Backend and platform engineering at United Wholesale Mortgage. I work on the messaging backbone behind the MIA assistant, observability automation, and cross-stack production debugging.",
        summary:
          "Software Engineer at United Wholesale Mortgage since 2022, working on backend and platform systems. I built the text channel and the per-user-number backbone behind MIA, the AI assistant UWM launched to its brokers. I automated golden-signal observability so any team could stand up reliability checks in seconds (work Dynatrace invited me to present to their global automation guild) and chased down the kind of cross-stack failures that never show up on a dashboard. To keep it simple, I build systems and libraries that others can trust and utilize without worrying about the specifics.",
        tags: ["C#", "Distributed systems", "Observability", "SRE"],
        link: "",
        linkLabel: "",
      },
      {
        title: "Arizona State University",
        slug: "arizona-state-university",
        meta: "B.S., Graphic Information Technology",
        stat: "Cum laude, Dec 2025",
        body: "The Graphic Information Technology program was a lot of frontend and backend work but it had a distinct focus on presentation. I graduated cum laude while working full-time at UWM.",
        tags: ["Education", "Cum laude"],
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
