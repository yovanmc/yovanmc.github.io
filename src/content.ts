/**
 * Content model for the RPG command menu.
 *
 * NOTE: every string below is PLACEHOLDER copy in Yovan's voice (carried over from
 * the design prototype). The structure is final; the copy/metrics/links are to be
 * replaced with Yovan's real projects and experience before this site is deployed.
 */

export type Metric = [value: string, label: string];

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
  /** contact actions */
  copy?: string;
  link?: string;
  linkLabel?: string;
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
    tag: "07",
    items: [
      {
        title: "Ledgerline",
        meta: "Distributed payments ledger",
        stat: "2.4B entries / day",
        body: "A double-entry ledger that settles transactions across regions with exactly-once guarantees and sub-second reconciliation.",
        summary:
          "Ledgerline is the settlement core of a multi-region payments platform. It maintains a strongly-consistent double-entry ledger, reconciles balances continuously, and exposes a deliberately narrow API so product teams move money without ever touching the books directly.",
        metrics: [
          ["2.4B", "entries / day"],
          ["99.99%", "settlement uptime"],
          ["<200ms", "p99 reconcile"],
        ],
        tags: ["Go", "Postgres", "Kafka"],
        link: "#",
        linkLabel: "CASE STUDY",
      },
      {
        title: "Halcyon",
        meta: "Real-time event gateway",
        stat: "p99 < 8ms",
        body: "An ingestion gateway that fans millions of concurrent events into downstream consumers with backpressure and replay.",
        summary:
          "Halcyon is the front door for real-time data. It accepts millions of concurrent event streams, applies backpressure so no downstream consumer is ever overwhelmed, and can replay any window of traffic exactly once after an outage.",
        metrics: [
          ["12M", "concurrent streams"],
          ["<8ms", "p99 latency"],
          ["exactly-once", "replay"],
        ],
        tags: ["Rust", "gRPC", "NATS"],
        link: "#",
        linkLabel: "CASE STUDY",
      },
      {
        title: "Atlas Mesh",
        meta: "Service-mesh control plane",
        stat: "1.2k services",
        body: "Control plane that distributes routing, mTLS and policy to a fleet of sidecars with zero-downtime rollout.",
        summary:
          "Atlas Mesh is the control plane behind a large service fleet. It distributes routing rules, mutual TLS and policy to every sidecar and ships changes across more than a thousand services without a second of downtime.",
        metrics: [
          ["1,200", "services"],
          ["0", "downtime rollouts"],
          ["mTLS", "everywhere"],
        ],
        tags: ["Go", "Envoy", "Kubernetes"],
        link: "#",
        linkLabel: "CASE STUDY",
      },
      {
        title: "Quanta",
        meta: "Time-series metrics store",
        stat: "18M writes / s",
        body: "A column-oriented store tuned for high-cardinality metrics with rollups and tiered retention.",
        summary:
          "Quanta stores high-cardinality time-series metrics. A column-oriented engine with rollups and tiered retention keeps recent data fast and historical data cheap, sustaining heavy write volume without flinching.",
        metrics: [
          ["18M", "writes / sec"],
          ["40:1", "compression"],
          ["tiered", "retention"],
        ],
        tags: ["C++", "Cassandra"],
        link: "#",
        linkLabel: "CASE STUDY",
      },
      {
        title: "Relay",
        meta: "Webhook delivery engine",
        stat: "99.99% delivered",
        body: "Durable webhook pipeline with exponential retries, idempotency keys and a dead-letter console.",
        summary:
          "Relay delivers webhooks reliably. Every event is retried with exponential backoff, deduplicated with idempotency keys, and anything that ultimately fails lands in a searchable dead-letter console for one-click replay.",
        metrics: [
          ["99.99%", "delivered"],
          ["idempotent", "retries"],
          ["DLQ", "console"],
        ],
        tags: ["Go", "Redis", "Postgres"],
        link: "#",
        linkLabel: "CASE STUDY",
      },
      {
        title: "Vault Sync",
        meta: "Secrets replication system",
        stat: "cross-region",
        body: "Replicates encrypted secrets across clusters with leader election and audited, versioned rollbacks.",
        summary:
          "Vault Sync replicates encrypted secrets across clusters. Leader election keeps a single source of truth, every change is versioned and audited, and rolling back to a known-good state is a single safe operation.",
        metrics: [
          ["cross-region", "sync"],
          ["versioned", "rollbacks"],
          ["audited", "changes"],
        ],
        tags: ["Rust", "etcd"],
        link: "#",
        linkLabel: "CASE STUDY",
      },
      {
        title: "Beacon",
        meta: "Observability pipeline",
        stat: "40TB / day",
        body: "A tracing and metrics pipeline built on OpenTelemetry with adaptive sampling and span-level search.",
        summary:
          "Beacon is the observability pipeline. Built on OpenTelemetry, it ingests traces and metrics at scale, samples adaptively to keep cost under control, and makes individual spans searchable within seconds.",
        metrics: [
          ["40TB", "ingested / day"],
          ["adaptive", "sampling"],
          ["span-level", "search"],
        ],
        tags: ["Go", "OpenTelemetry", "ClickHouse"],
        link: "#",
        linkLabel: "CASE STUDY",
      },
    ],
  },
  {
    key: "experience",
    label: "Experience",
    blurb: "Where I have built systems and grown the teams around them.",
    tag: "04",
    items: [
      {
        title: "Staff Backend Engineer",
        meta: "Nimbus Systems",
        stat: "2023 — Present",
        body: "Lead the platform group building the payments and event-streaming backbone serving the whole product.",
        summary:
          "Leads the platform group that builds the payments and event-streaming backbone the whole product runs on. Sets technical direction, mentors the engineers around me, and keeps the core systems boring in the best possible way.",
        tags: ["Go", "Kafka", "Kubernetes"],
        link: "",
        linkLabel: "",
      },
      {
        title: "Senior Backend Engineer",
        meta: "Corewave",
        stat: "2020 — 2023",
        body: "Owned the data-plane services and cut p99 latency by 4x while tripling throughput during a major rewrite.",
        summary:
          "Owned the data-plane services through a major rewrite, cutting p99 latency by four times while tripling throughput. The patterns established here still shape how the rest of the backend is built.",
        tags: ["Rust", "gRPC", "Postgres"],
        link: "",
        linkLabel: "",
      },
      {
        title: "Backend Engineer",
        meta: "Driftpoint",
        stat: "2018 — 2020",
        body: "Built core APIs and the job-scheduling layer that powered the early product through its first scale.",
        summary:
          "Built the core APIs and the job-scheduling layer that carried the early product through its first real scale, back when every week seemed to bring a new order of magnitude.",
        tags: ["Go", "Redis"],
        link: "",
        linkLabel: "",
      },
      {
        title: "Software Engineer",
        meta: "Hollowpeak",
        stat: "2016 — 2018",
        body: "Started as an intern and shipped internal tooling and services that stuck around for years.",
        summary:
          "Joined as an intern and converted to full-time, shipping internal tooling and backend services that quietly stuck around for years after.",
        tags: ["Python", "Postgres"],
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
        title: "Email",
        meta: "yovan@example.com",
        stat: "",
        body: "The fastest way to reach me. I read everything and reply to most.",
        tags: ["Inbox"],
        copy: "yovan@example.com",
        link: "mailto:yovan@example.com",
        linkLabel: "COPY ADDRESS",
      },
      {
        title: "GitHub",
        meta: "github.com/yovan",
        stat: "",
        body: "Open-source experiments, infrastructure tools, and the occasional weekend rabbit hole.",
        tags: ["Code"],
        link: "https://github.com",
        linkLabel: "OPEN PROFILE",
      },
      {
        title: "LinkedIn",
        meta: "linkedin.com/in/yovan",
        stat: "",
        body: "Roles, history and the more professional version of all of the above.",
        tags: ["Network"],
        link: "https://linkedin.com",
        linkLabel: "OPEN PROFILE",
      },
    ],
  },
];
