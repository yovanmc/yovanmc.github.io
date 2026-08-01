# S4 — Curio publication readiness

> **Written for builder-subagent execution. If something does not match what this plan says, STOP and report rather than guess.**

> **HARD RULE — READ BEFORE WRITING ANYTHING. This file lives in a PUBLIC repo (`yovanmc.github.io`).**
> Never write a discovered leak candidate into this file, into `ROADMAP.md`, into a commit message, a branch
> name, or a PR title/body in this repo. That includes the literal string of any address, credential, real
> media title, internal name, or figure the sweep surfaces. Doing so publishes the exact thing the milestone
> exists to evaluate, and the remedy is repo deletion (see Blast radius).
>
> **All finding CONTENT lives in the private companion file** `C:\Agent Zone\_curio-publish\S4-FINDINGS.md`,
> which is outside every git repo and is never committed anywhere. This plan and the ROADMAP refer to findings
> by **ID only** (`E-1`, `S-1`, ...). If you need to describe a finding in a commit message, use its ID.
>
> **This rule binds Curio's OWN commit messages too, not just this repo's** (pass-1 MAJOR-6). Stage 2 makes new
> commits inside Curio that fix findings, and every one of them becomes public the moment Stage 5 runs. A commit
> message like "replace the old contact value X with a URL" re-embeds X in a commit that **postdates** the
> history scrub, so the scrub cannot remove it. Curio commit messages describe findings by ID only. The same
> goes for any branch name created inside Curio during this milestone.

## Blast radius: HIGH

The data axis is clean: no persisted format changes, no serialized types, no migrations, no cross-process
contracts. On that axis alone this is LOW. It is HIGH on the irreversibility axis, and one notch beyond S3.

S3 was HIGH because it added net-new publish-once strings to a public site. This milestone makes an entire
repository and its **1776-commit history** public in one irreversible act. The confidentiality gate's rule 1 is
that a landmine in **any** commit requires deleting the repository, not force-pushing it. This repo has been
through that once already: in July 2026 a single draft stub cost a full public-repo delete and recreate, losing
every PR discussion. Here the blast is larger, because by the time a leak is noticed the public site is also
linking to the repo, so the remedy breaks a live outbound link on the page an application lands on.

**Gates that therefore apply:** claim ledger with an in-session-measured baseline; preflight recheck before the
first builder; **two dissect passes, the second pinned to a non-author model**; fixed-lens diff review on
**every** commit. No schema-evolution guard test is owed and the reason is positive rather than absent: this
milestone changes no serialized type. Curio's SQLite schema (`UnifiedSchema.Version`) and its migration chain
are untouched, and nothing in scope reads or writes `yrpg.progress` in this repo.

**Substitution, stated so it can be attacked rather than quietly skipped.** HIGH requires a synthetic-corpus dry
run before deploy. There is no data corpus. The equivalent composition check is **Stage 3: push the exact
intended surface to a throwaway PRIVATE GitHub repo first and verify what actually landed server-side**, then
run the confidentiality panel against *that* surface rather than against this plan's idea of it. This is a real
substitution, not a formality: unit-style checks prove each sweep pass, and only an actual push proves the
composition of refspec plus `.gitignore` plus already-tracked files. If a reviewer thinks it is not equivalent,
say so rather than accepting it.

## Claim ledger

| # | Claim | Verified at (commit) | Recheck (pwsh, exit 0 = holds) |
|---|-------|----------------------|--------------------------------|
| 1 | Baseline: `portfolio-rpg` 841 tests across 23 files, all green (measured in-session 2026-07-31, `npm test`, 1.68s) | `4216d62` | `npm test` |
| 2 | Baseline: Curio **2824 tests green, 0 failed, 0 skipped** (Core 1504 \| App 1036 \| Companion 284), measured in-session 2026-07-31 via `dotnet test -v minimal`, clean tree, SDK 10.0.302, no `Core.Tests` flake on this run | Curio `75de35d` | — (cross-repo and ~8 min; Stage-0 T2 re-measures inside the Curio clone) |
| 3 | Curio history: 1776 commits across all refs, 5 branches, **no remote configured** | Curio HEAD | `if ((git -C "C:\Agent Projects\Curio" remote) -eq $null) { exit 0 } else { exit 1 }` |
| 4 | **Every** commit across all refs is authored AND committed as the GitHub noreply identity — exactly ONE distinct author email and ONE distinct committer email | Curio HEAD | `if ((git -C "C:\Agent Projects\Curio" log --all --format='%ae%n%ce' \| Sort-Object -Unique).Count -eq 1) { exit 0 } else { exit 1 }` |
| 5 | Zero landmine-keyword hits in commit subjects or bodies across all refs, against **the landmine set defined in the private companion file** (`S4-FINDINGS.md` §Detector, v1) — deliberately not enumerated here, see the note below | Curio HEAD | — (the set lives outside this repo by design; Stage-1 pass P4 re-runs it and the run is the evidence) |
| 6 | No `.dll`, `.exe`, `.so`, `.dylib`, `.lib`, `.pdb` was **ever** committed | Curio HEAD | — (Stage-1 pass P1 re-derives; a bare grep cannot see history) |
| 7 | No `.env`, `appsettings*.json`, `*secrets*`, `*.pfx`, `*.p12`, `*.key`, `*.pem`, `credentials*`, `*.db`, `*.sqlite*` was **ever** committed | Curio HEAD | — (Stage-1 pass P1 re-derives) |
| 8 | No un4seen BASS DLL and no libVLC binary was **ever** committed; only `lib/bass/README.md` and `lib/bass/x64/.gitkeep` are tracked | Curio HEAD | — (Stage-1 pass P1 re-derives) |
| 9 | Largest blob in all of history is ~1.49 MB (a design mockup PNG); pack size 24.79 MiB; tracked working set ~2.08 MiB across 1668 files | Curio HEAD | — (Stage-1 pass P2 re-derives) |
| 10 | Finding **E-1**: the owner's personal contact address is committed in exactly **5 tracked files**, two of them live code, as an HTTP `User-Agent` contact. Present in history, not only at HEAD. Strings and paths are in the private findings file, never here | Curio HEAD | — (deliberately unautomatable here: the recheck command would itself contain the string. Stage-1 pass P3 re-derives it inside the private working dir) |
| 11 | Finding **S-1**: `verify/out/ns2-m5-red-metrics.json` is **tracked** even though `.gitignore` excludes `verify/out/` | Curio HEAD | `if ((git -C "C:\Agent Projects\Curio" ls-files "verify/out/") -ne $null) { exit 0 } else { exit 1 }` |
| 12 | 160 PNGs were ever committed: 104 under `design/b6-mockups`, 40 under `design/persona-handoff/.../screenshots`, 7 `design/b6-streaming-exploration`, 3 `docs/superpowers/design/mockups`, 5 under Companion web assets, **1 under `verify/out`** | Curio HEAD | — (Stage-1 pass P6 re-derives the inventory) |
| 21 | Finding **I-1**: exactly one **real running-app screenshot** was ever committed — `verify/out/m8a-all.png`, added in `258f41c` and untracked in `2826b37` the same day when `verify/out/` entered `.gitignore`. It is **history-only**, absent at HEAD. Visually judged 2026-07-31: it shows **seeded demo data** (invented titles and invented studio names), no real library content, no path, no username, no face. Disposition CLEAR unless the shape is A/A′, where it is still in history and the owner should be told it exists | Curio HEAD | — (image judgment; T5 re-judges from history) |
| 22 | Finding **I-2** (sampled, **not** exhaustive): the `design/persona-handoff/.../screenshots` cluster is **HTML design mockups, not app captures** — no OS chrome, idealized type. Their placeholder content is real famous works and real public creators, which is ordinary design-reference practice and identifies nothing about the owner. Same pattern in a sampled `design/ds/` file. **6 of 40 screenshots and 1 of 32 `design/ds` files were viewed** | Curio HEAD | — (T5 widens the sample and records what it did and did not view) |
| 13 | `Item.repo?: string` exists in this repo's content model and renders as a `VIEW REPOSITORY` outbound button, taking priority over `announcement` | `4216d62` | `Select-String -Path src/components/CaseStudyPage.tsx -Pattern 'VIEW REPOSITORY' -Quiet` |
| 14 | The `curio` entry in `src/content.ts` currently has **no** `repo` field; `mia` and 3 others also lack one; only `backend-harness` and `notification-dispatch` carry `repo` | `4216d62` | `if (-not (Select-String -Path src/content.ts -Pattern 'github.com/yovanmc/Curio' -Quiet)) { exit 0 } else { exit 1 }` |
| 15 | A repo named `Curio` does **not** exist under `yovanmc`; the name is available | 2026-07-31 | `gh repo view yovanmc/Curio 2>$null; if ($LASTEXITCODE -ne 0) { exit 0 } else { exit 1 }` |
| 16 | `gh` 2.93.0 provides both `repo archive` and `repo unarchive`, so archiving is **reversible** | 2026-07-31 | `gh repo archive --help > $null 2>&1; exit $LASTEXITCODE` |
| 17 | **The spec's count of 4 is CORRECT.** `2026-07-02-spectacle-and-battle-design.md:40` names them: `VideoTriage`, `AudioShelf`, `MangaReader`, `VideoShelf`, "superseded by Triage/Curio". Live visibility re-verified 2026-07-31: **VideoTriage PUBLIC \| AudioShelf PUBLIC \| VideoShelf PUBLIC \| MangaReader PRIVATE**, none archived | 2026-07-31 | `gh repo view yovanmc/VideoTriage > $null 2>&1; exit $LASTEXITCODE` |
| 23 | `VideoTriage` is superseded by **`Triage`**, not by Curio, and `Triage` is **PRIVATE** — so a "superseded by Triage" note on a public repo points at something no reader can open | 2026-07-31 | `gh repo view yovanmc/Triage --json visibility \| Select-String 'PRIVATE' -Quiet` |
| 18 | No third-party licence blocks publishing this source under a permissive licence: libVLC/LibVLCSharp is LGPL-2.1 but the repo distributes no binary; SQLite is public domain; `Microsoft.Data.Sqlite` is MIT; un4seen BASS binds whoever ships the DLL, which this repo never does | 2026-07-31, sourced | — (external licence text; re-verify only if a dependency changes) |
| 19 | **UNVERIFIED.** `bass_fx`'s licence wording was inferred from the identical wording on `bassmix`/`bassloud`; its own doc page 404'd during research | not fetched | — (task T7 fetches it directly or records it as still unverified in the notices file) |
| 20 | **VERIFIED ABSENT 2026-07-31: `git filter-repo` is NOT installed on this machine.** T-A′ installs it (`pip install git-filter-repo`) or falls back to `git filter-branch` | 2026-07-31 | — (this row is knowingly false today, so an executable cell would FAIL preflight and trigger a reconcile-against-HEAD stop for a condition T-A′ already owns) |

**Measurement note for claim 2.** 2824 is a **measured** number from this planning session, not a recalled one.
Project memory said "2250 tests" and was stale by 574; if you see 2250 quoted anywhere, that number is wrong.
**T2 re-measures at the Curio HEAD the build actually starts from** — a publication milestone must not publish a
repo whose suite is red. The repo has a known standalone `Core.Tests` host-crash flake (recurred 2026-07-17 at
323 passed), so a single red run is retried and isolated before it is believed. If the suite is genuinely red,
STOP and report: that blocks the milestone, it is not something to publish around.

**A recheck cell is a command or a bare `—`, never prose.** The preflight parser executes the cell. Where a
claim is genuinely unautomatable, the dash carries a parenthetical explanation after it, which is readable but
not executed. This is the S3 build session's correction and it is repeated here because six rows below would
otherwise FAIL as formatting defects rather than as stale claims.

**Claim 10 is deliberately unautomatable and that is not laziness.** A recheck command for it would have to
contain the string, and this file is public. The private working dir is where that check lives.

### The DETECTOR is finding-class content too (pass-2 BLOCKER B1)

The first draft of claim 5 enumerated the landmine keyword set inline. **That is a leak by itself**, and it is
the plan's own HARD RULE recursing into its remedy: the rule was read as covering *discovered* strings, so the
*search terms* went in unguarded. Publishing the set discloses which employer and vendor associations the owner
treats as sensitive, which is precisely the "figures and internals" inference surface the confidentiality gate
exists to protect. Two of the terms are on the never-publish list outright. The window was open only because
this file had not been committed yet when pass 2 caught it.

**Therefore: the landmine set, its false-positive annotations, and the deny-pattern list all live in
`S4-FINDINGS.md` §Detector, versioned. This file names none of them.** Anything that would let a reader
reconstruct the set — an example hit, a "note that X false-positives", a sample regex — is the same disclosure
and is equally banned.

**The detector is also incomplete, and the missing class is not employer-related (pass-2 M2).** Tracked docs
carry home-network identifiers: UNC share paths in several `docs/superpowers/plans/` files, and the NAS
hostname/brand term in the three root docs and several plan docs. Publishing those discloses the owner's home
storage topology, and nothing in the employer-shaped keyword set catches them. Add to the private detector: a
UNC-path regex, private-IP ranges **anchored to dotted-quad boundaries** (an unanchored `10.0.` pattern
false-positives on ".NET 10.0", measured), and the NAS hostname and brand terms.

**Every critic dispatched at this plan gets told this rule**, or it quotes the finding back in a report that
gets pasted somewhere public. Both passes were briefed; that is why neither report reproduces a string.

## The decision gate — G1

**This milestone has an owner decision in the middle of it, and the plan stops there.** The spec anticipated
this ("fallback if history isn't publishable: fresh-history public mirror, owner decides at that point") but
framed it as a binary. Recon says the real choice is four-way, and the evidence now available makes the
question much sharper than "is history publishable."

**What the evidence already says (all measured 2026-07-31, before any sweep):**

- History metadata is **clean on the hardest-to-fix axis**. All 1776 commits, across all 5 refs, carry exactly
  one author identity and one committer identity, and it is the GitHub noreply address. Commit subjects and
  bodies produce zero landmine hits. Author identity is the classic unfixable-after-the-fact leak and it is
  simply not present.
- History is **structurally clean**. No binary, no database, no secret file, no real media was ever committed.
  The largest object in 1776 commits is a design mockup. The `.gitignore` already excludes the dangerous class
  by construction: `verify/out/` is where real-app screenshot captures land, and it is ignored.
- The residual surface is **enumerable and small**: finding E-1 (5 tracked files), finding S-1 (1 stray tracked
  file), 160 committed PNGs to triage, and 245 agent-voice `.md` docs to sample.
- The cluster that looked most dangerous going in **is not**. A sampled visual judgment (claims 21 and 22)
  found that the 40 `persona-handoff` "screenshots" are HTML mockups rather than app captures, and that the
  only real running-app screenshot ever committed is history-only and shows **seeded demo data**. The owner's
  own `.gitignore` discipline is what produced that outcome, and it held for 1776 commits.

**The honest counterweight, because the above reads as a clean bill of health and is not one.** Everything
above is *recon*, not the sweep. It scanned commit metadata exhaustively but scanned **file contents only at
HEAD**, and it viewed **7 of 160 images and 1 of 245 docs**. The strongest claim available today is "no
contamination found in the places most likely to hold it," which is a reason to expect A/A′ to survive, not a
substitute for Stage 1. **Do not let the recommendation below license skipping or thinning the sweep** — the
sweep is what converts an expectation into a verdict, and shape A is the one shape whose cost of being wrong is
unbounded.

**The four shapes:**

- **A — publish as-is, with full history.** Available only if the sweep closes at **zero BLOCKERs**. Gives the
  strongest artifact: 1776 real commits with real dates and real messages, which is a far better signal than a
  single squashed commit and cannot be faked.
- **A′ — full history, targeted rewrite.** `git filter-repo --replace-text` (for a string) or `--path`
  (for a path) rewrites the specific finding out of all 1776 commits while keeping dates, messages, authorship
  and structure. Every SHA after the first touched commit changes. **That is not quite harmless, and the first
  draft said it was** (pass-2 m6): nothing was ever pushed, so no collaborator is disrupted, but Curio's own
  `ROADMAP.md` cites roughly 99 short SHAs as merge references, and every one of them dangles after a rewrite.
  The repo's flagship narrative file would ship publicly full of references resolving to nothing. Remediable
  via `filter-repo`'s commit-map (rewrite the citations in the same pass), which is work to budget, not a
  blocker. Requires `git filter-repo`, **verified absent on this machine** (claim 20). **This is the expected
  landing spot if E-1 is ruled scrub rather than accept.**
- **B — fresh public history, same working repo.** Create an orphan commit whose tree is byte-identical to
  current HEAD, repoint `master` at it, keep the old history locally under a tag that is never pushed. It
  **deletes no bytes**, which makes it preferable to a squash-rewrite. But "non-destructive" oversells it
  (pass-1 MINOR-2): repointing `master` in a repo under continuous active development bifurcates the owner's
  own working history from that moment on, so `git log`, `git blame` and bisect all stop at the orphan commit
  for everyday local work. That is a real recurring cost in the repo the plan elsewhere calls his
  highest-velocity project. Cost also: the public repo opens with one commit, which reads as dumped code.
- **C — separate public mirror repo, local repo stays private.** Development stays unconstrained; each mirror
  update needs its own re-sweep. Cost: the public artifact goes stale between snapshots and has no live history.

**Recommendation, to be attacked at the critique gate rather than accepted:** **A′, falling back to A** if E-1
is ruled accept. The confidentiality argument that would have forced B or C has largely evaporated under
measurement, and the remaining question is one string, not a class of contamination.

The framing point that survives independently of confidentiality: publishing the working repo puts a permanent
confidentiality gate on the owner's highest-velocity project, mid-B6-redesign. That cost is **lower than it
looks for this specific repo**, because Curio contains no work-related content at all. It is a personal media
app. Its leak surface is personal-library data, which `.gitignore` already excludes mechanically and has
demonstrably excluded for 1776 commits. That is the reason to prefer A/A′ over C, and it is an argument from
this repo's measured history rather than from a general preference.

**That rebuttal is weaker than it reads, and pass 1 was right to say so (MINOR-3).** The cost named is
*friction* — having to think about a gate on every future commit to his fastest-moving repo — and the rebuttal
answers *probability*, which is a different axis. A low chance of leaking does not remove the per-commit
overhead. The honest version: the friction is real and permanent under A/A′/B, it is mostly discharged by
mechanisms that already exist (the `.gitignore` rules that held for 1776 commits), and shape C is the only one
that avoids it outright at the cost of a stale public artifact. **This is the trade the owner is actually
ruling on at G1, and it should be put to him in those terms rather than as a confidentiality question.**

**Five rulings are owed at G1** (rulings 4 and 5 were added at the pass-2 gate; the first draft asked three and
would have shipped a self-contradicting case-study page and published three root docs by default):

1. **E-1 disposition.** Accept the address being public (normal open-source practice — the API whose policy
   drives it wants a reachable contact), or replace it. **A third option the spec did not consider and which
   the plan recommends:** the API's contact policy is satisfied by a project **URL** as well as an address, so
   the `User-Agent` can carry `https://github.com/yovanmc/Curio` instead. That removes the address at HEAD for
   a functional reason rather than a defensive one, and then A′ scrubs it from history. Note that a GitHub
   noreply address is **not** a valid substitute here: it does not receive mail, which defeats the contact
   purpose the string exists for.

   **Rule this knowing finding E-2, discovered 2026-07-31 while checking this repo's commit convention.**
   The address is **already public**, in this repo, right now. Measured: **58 commits across all refs, 47 of
   them on `main`**, are authored with it — they are GitHub's server-side PR-merge commits, which use the
   account's *primary* email rather than the noreply identity that every hand-made commit correctly uses
   (152 commits). Curio, by contrast, has **zero** such commits. Three consequences, and the third is worth
   more than the scrub:
   - "The address is private" is false, so E-1's disposition is about **not widening an existing exposure**,
     not about protecting a secret. Accept-and-move-on is a more defensible ruling than it looked.
   - Scrubbing Curio while this repo keeps publishing it every merge is security theatre unless the source is
     fixed too.
   - **The source is fixable in one place and it is not this milestone.** GitHub account Settings → Emails →
     *Keep my email addresses private* plus *Block command line pushes that expose my email* makes every
     future merge commit use the noreply identity. The existing 47 cannot be removed without rewriting a
     published repo's history, which breaks every existing link and is almost certainly not worth it.
   **This is an owner action, not an agent action** — it is an account settings change (an explicitly
   confirm-first category). Surface it at G1; do not perform it.
2. **Publish shape.** A / A′ / B / C, on the sweep's evidence.
3. **CI.** Curio has **2824** tests (claim 2, measured) and no public CI workflow. Every other public repo of
   the owner's has CI (RiftReview 166, Compass 131, PlotArmor 194), so a 2824-test repo with no green badge
   under-sells itself by an order of magnitude against his own existing storefront. **This plan scopes CI OUT by default** and says so rather than silently dropping it, because a clean
   runner has no BASS DLLs and no owner-supplied `fpcalc.exe`, so the music-engine and identity paths take
   their by-design "unavailable" branches and the true pass count on CI is unknown until measured. Ruling
   wanted: follow-up milestone (recommended), or in-scope here and accept the size.
4. **The site's own prose contradicts this milestone, on the exact page it edits** (pass-2 M3). The `curio`
   summary at `src/content.ts:143` ends with the sentence *"The code is private for now."* T18 adds the
   `VIEW REPOSITORY` button to that same page. Ship both and the case study simultaneously links a public repo
   and asserts the code is private, on the surface an application link lands on. **Hard constraint 1 forbids
   agents rewriting owner prose, so this plan cannot fix it and must not try** — but letting the constraint
   decide by default ships a page that contradicts itself. Ruling wanted: the owner amends that one sentence in
   his own words (folded into T18's PR as an explicitly authorised one-sentence exception), **or** he knowingly
   accepts the contradiction. Secondary, same sentence family: the prose says Curio superseded all four
   predecessors, while T24 establishes publicly that `VideoTriage`'s successor is `Triage`.
5. **Publish or withhold the three root docs** (pass-2 M1). `CLAUDE.md` (agent runbook, carries local
   deploy-path fragments), `NORTHSTAR.md`, and `ROADMAP.md` (~2400 lines narrating the whole build, including
   candid assessments) all become public under A/A′/B. Publishing them is **on-brand** — the site's binding art
   direction is proudly-AI-built (A+C), and an agent runbook plus a full milestone history is unusually strong
   evidence of process. But it is an owner call, not an agent default, and no earlier draft asked it. Ruling
   wanted per file: publish as-is, trim first, or withhold. **Default: publish `ROADMAP.md` and `NORTHSTAR.md`,
   trim local paths from `CLAUDE.md`.**

## Scope

**In scope:** the sweep and its verdict; licence, notices and README for the Curio repo; the publish itself;
the site's repo link; predecessor archiving; the profile README line.

**Explicitly out of scope, stated so it is a decision rather than an omission:**

- Making `MangaReader` public, or re-sweeping the three predecessors that are **already** public
  (`VideoShelf`, `AudioShelf`, `VideoTriage`). Each is a separate repo that would need its own full sweep and
  its own gate. **Archiving them is in scope; auditing or changing their visibility is not.** Note the
  asymmetry honestly: those three are already public and this milestone does not improve that, it only adds a
  successor note to two of them.
- A CI workflow for Curio (see ruling 3).
- Any change to Curio's application behaviour, schema, or migrations. The only source edit contemplated is the
  `User-Agent` string under ruling 1.
- Repointing the site's `curio` figure or any `content.ts` prose. Hard constraint 1 stands: **no owner prose is
  rewritten in this milestone.** The site change is the addition of one `repo` field and nothing else.

## Stages and tasks

Ordering constraint that binds the whole plan: **T18 must not merge before T17 completes and the repo resolves
at its public URL.** Adding the site's repo link before the public repo exists ships a 404 button on the page an
application link lands on. (Pass 1 caught this sentence naming T16/T15 — a stale pair left over from a
mid-draft renumber. T15 is an authorisation and T16 is a review dispatch; neither is a mergeable PR, so the
sentence was vacuously true and the real hazard was unguarded.)

**Do not rely on stage order alone to enforce it.** T19 opens with an explicit precondition:
`gh repo view yovanmc/Curio > $null 2>&1` must exit 0, and the branch must not be pushed if it does not.
Stage order happens to protect this in the normal case, which is exactly why the failure mode is a
resequencing nobody re-checks.

### Stage 0 — private working dir and backup (touches no repo)

- **T0.** Create `C:\Agent Zone\_curio-publish\`. Confirm it is **not** inside any git repo
  (`git -C "C:\Agent Zone\_curio-publish" rev-parse --show-toplevel` must fail). Create `S4-FINDINGS.md` there
  with sections for each sweep pass. Every finding gets an ID (`E-n` for content strings, `S-n` for stray
  tracked files, `I-n` for images, `D-n` for docs).
- **T1.** Full backup of `C:\Agent Projects\Curio`, **including `.git`**, to
  `C:\Agent Zone\_curio-publish\Curio-backup-<date>\`. Use `robocopy /E`. **Never `/MIR`** (the repo's own
  deploy runbook rule). Verify the backup independently: `git -C <backup> rev-list --count --all` must equal
  the number recorded in claim 3. Do not proceed to any stage that rewrites history until this passes.
- **T2.** Re-measure the Curio baseline per the claim-2 note and record it in the findings file. Retry and
  isolate on a `Core.Tests` host-crash flake before believing a red result.

### Stage 1 — mechanical sweep (produces evidence, changes nothing)

- **T3.** Write `C:\Agent Zone\_curio-publish\sweep-curio.ps1`. Six passes, each writing a section of
  `S4-FINDINGS.md` plus a machine-readable `findings.json`:
  - **P1 path census.** Every path ever added (`git log --all --diff-filter=A --name-only`), deduped, classified
    against the deny-pattern list (binaries, databases, secret-shaped names, media extensions, paths containing
    `private`/`personal`/`backup`).
  - **P2 blob-size census.** Top 50 blobs ever, by size, with path.
  - **P3 content scan over unique blobs.** Dedup by blob SHA first (about 16k objects, tractable) and scan text
    blobs for the landmine set. **Deduping by SHA rather than iterating commits is what makes this feasible** —
    a naive commits-by-files scan is orders of magnitude larger for no extra coverage.
  - **P4 commit metadata.** Distinct author and committer identities; subject and body keyword scan.
  - **P5 ref names.** Branch and tag names are leak surfaces under gate rule 2.
  - **P6 binary inventory.** Every image and media blob ever committed, path plus size, grouped by directory,
    for the visual triage in T5.
  - **P7 image metadata and markup source.** Added at the pass-1 gate, which found that the six passes covered
    no surface the confidentiality gate's rule 2 names as *"image alt-text and EXIF"*. Two halves, and the gap
    was real in both:
    - **Metadata chunks.** T5 judges *rendered pixels*. A PNG's `tEXt`/`iTXt`/`zTXt` chunks and any JPEG EXIF
      are invisible to a visual judge and routinely carry the capturing tool's name, a working directory, a
      username, or a timestamp. Read the metadata of all 160 committed images and report every non-empty
      textual chunk. A rendered-clean image with a `C:\Users\...` path in its metadata passes T5 and leaks.
    - **Markup source.** Before this pass, P3's keyword regex was the only thing that had ever touched the
      HTML mockups, and by construction it catches only the fixed detector set, never an arbitrary identifying
      string a reader would notice. P7 extracts alt-text, HTML comments, `data-*` and title attributes for the
      T6 sampled read. **Enumerate the corpus as `git ls-files '*.html'`, never as `design/**.html`** — the
      root `design_handoff_curio_redesign/` tree is a sibling of `design/`, not a child, so that glob silently
      drops 27 mockups (pass-2 M1), and in PowerShell `**` matches one level anyway (lens 48).
    **Neither half is optional on the grounds that "they're just mockups."** The whole point of finding I-2 is
    that the mockup cluster was assumed fabricated and then had to be checked.
- **Known false-positive classes, recorded so the builder does not re-panic and does not silently suppress a
  real hit:** npm lockfile integrity hashes contain arbitrary alphanumeric substrings, so short uppercase
  keywords match inside them; and music metadata contains real artist names, so a surname keyword matches
  legitimately. Both were measured in planning. **Classify them as false positives with the reason recorded,
  never by deleting the keyword from the set.**
- **T4.** Run the sweep. Classify **every** hit BLOCKER / REVIEW / CLEAR into the findings file with an ID and
  a disposition field left empty. A hit is never dropped silently.
- **T5.** Visual triage of the P6 inventory. **Images are judged by pinned subagents that return TEXT verdicts;
  no PNG is ever loaded into the orchestrator.** Run
  `~\.claude\skills\roadmap\helpers\Test-CaptureSane.ps1` on any set before dispatching a judge.
  **Two different instruments, and the plan previously named only one** (pass-2 m8). `Test-CaptureSane`
  screens *captures*; it says nothing about an HTML file. For the HTML clusters, pick one and say which in the
  findings file: rasterise via the headless-Edge render loop and judge the pixels, **or** declare it a
  source-read and hand the markup to a text critic. "Visually triage 32 HTML files" is not executable as
  written, and a mandatory 32/32 floor on an unexecutable instruction is worse than no floor.
  Priority order, because risk is not uniform:
  1. **Any real running-app capture in history.** Planning found exactly one (finding I-1, claim 21) and judged
     it CLEAR. **Re-derive this set from history rather than trusting that count** — the search that found it
     keyed on the `verify/out` path, and a capture committed anywhere else would not have matched. Widen to:
     every PNG whose blob was added by a commit whose subject mentions capture, screenshot, seed, or verify.
  2. `design/ds/` (32 HTML) — project memory describes this as a **token mirror of the shipped app**, so it is
     the most likely place for real library values to have been copied in. One file was sampled and was
     placeholder content; **31 were not.** Do not assume "mockup" means "fabricated" for this directory.
  3. The 40 `design/persona-handoff/.../screenshots` — sampled at 6 of 40 and found to be HTML mockups, not app
     captures (claim 22). Widen the sample; the remaining 34 are unviewed.
  4. **`design_handoff_curio_redesign/` at the repo ROOT — 30 tracked files, 27 of them HTML mockups.**
     This cluster appeared in **no** inventory in the plan's first two drafts: not in T5's clusters, not in
     claim 12's PNG census, and outside a `design/**` glob because it is a sibling of `design/`, not a child
     (pass-2 M1). Project memory flags it as one of three look-alike design folders that already cost an hour
     of confusion once. Triage it like any other mockup cluster.
  5. `design/b6-mockups` (104 PNG + 104 HTML) and the rest, authored under a style guide and expected to be
     fabricated. Sample rather than exhaustively read.
  **Derive this cluster list from the data, not from this plan.** Re-run P6's directory grouping over all
  committed image and markup paths and reconcile it against the five entries above. A cluster that exists in
  the repo but not in this list is a finding, and the root cluster above is the proof that the list can be
  wrong.
  **Coverage floors, because "widen the sample" is satisfied by viewing one more file** (pass-1 MAJOR-7, which
  matched review lens 90: a check covering a proper subset of what it claims false-PASSes):
  - `design/ds/` — **32 of 32 mandatory before G1.** The plan itself names this the likeliest place for real
    library values, and 32 files is cheap. Anything less than full coverage on the cluster you flagged as
    highest-risk is indefensible.
  - The one history-only real-app capture and any sibling P6 finds — **100%.**
  - `design/persona-handoff/.../screenshots` (40) and `design/b6-mockups` (104+104) — full coverage, or a
    stated numeric residual carried to G1 as an owner-visible risk figure ("34 of 40 unviewed"). **Not a
    qualitative "sampled and looked fine."**
  **Record the sample size and unviewed remainder per cluster. Never report a sampled pass as complete** —
  claims 21 and 22 are labelled sampled for exactly this reason, and the sweep's job is to close that gap
  rather than inherit it.
- **T6.** Text-doc triage. P3 covers these mechanically; T6 is the *sampled* judgment read by a pinned critic
  for candid, embarrassing, or identifying content that no keyword catches.
  **Define the corpus as `git ls-files '*.md'` — all 248 tracked markdown files — and never as a glob**
  (pass-2 M1). Two reasons, both measured 2026-07-31:
  - The earlier figure of "245 `docs/**.md` files" matched **neither** real corpus. Tracked `.md` totals
    **248**; `docs/` holds **233**. 245 was a recon artifact, and the difference is not rounding — it is the
    three root files, which are the most candid documents in the repo: **`CLAUDE.md`** (agent runbook,
    contains local deploy-path fragments), **`NORTHSTAR.md`**, and **`ROADMAP.md`** (~2400 lines narrating the
    entire build, including candid assessments). A corpus defined as `docs/**` excludes all three by
    construction, so the one instrument that could read them never would have.
  - `docs/**.md` as a PowerShell `-Path` glob matches **one directory level**, not recursively (review lens
    48). The glob was wrong twice over.
  Second corpus: **HTML markup source** plus P7's extracted alt-text, comments and `data-*` attributes, over
  **both** mockup trees (see P7).
  Record the sample size **and the unviewed remainder** per corpus separately. A combined figure hides which
  corpus went unread.

### G1 — OWNER DECISION GATE. STOP.

Present the findings summary and the three rulings. **Do not proceed past this point without them.** Announce
in plain text that the run is blocked on the owner, so silence is never ambiguous.

### Stage 2 — prepare the publish surface (executes the ruling)

- **T7.** `LICENSE` at Curio root. MIT unless the owner rules otherwise at G1.
- **T8.** `THIRD-PARTY-NOTICES.md`: LibVLC and LibVLCSharp under LGPL-2.1 with a link to VideoLAN source;
  un4seen BASS and add-ons as proprietary, free for non-commercial use, not redistributed by this repo, with
  the un4seen link; SQLite public domain; `Microsoft.Data.Sqlite` MIT. Fetch the `bass_fx` licence page
  directly to close claim 19, or record it in the notices file as still unverified. **Do not state a licence
  you did not read.**
- **T9.** Root `README.md` — the repo has none today. Cover what Curio is, the four media types, the
  architecture, the build prerequisites, the test count measured in T2, and a pointer to `ROADMAP.md`. Two
  things it must state plainly because they are by-design and otherwise read as broken: a fresh clone has **no
  BASS DLLs and no `fpcalc.exe`**, so the music engine reports "unavailable" and identity features are inert
  until the user supplies them from un4seen; and the repo has no CI badge (see ruling 3).
  **Punctuation rule binds: no em dashes, no en dashes, no semicolons.** Agent-drafted repo READMEs have
  precedent (backend-harness PR #3, which passed the confidentiality gate), but this one is read by the owner
  before commit because it is prose published under his name.
- **T10.** `.gitignore` hardening and untracking finding S-1: `git rm --cached verify/out/ns2-m5-red-metrics.json`.
  Add whatever patterns the sweep proves necessary. Verify with `git status --porcelain` that nothing wanted
  became untracked as a side effect.
- **T11.** Apply the G1 ruling on E-1 at HEAD. If the ruling is scrub, this is where the `User-Agent` value
  changes in the working tree.
- **T12.** Dispose **every** finding — E-, S-, I-, D- alike. Each is removed, rewritten, or **owner-accepted**;
  never self-accepted, which is an explicit red flag in the confidentiality gate. Produce the definitive
  **remove-set**: the list of every finding whose disposition is "remove from history."
- **T-A′ — RUNS LAST IN STAGE 2, AFTER T12, AND SCRUBS THE WHOLE REMOVE-SET.** (Pass-1 MAJOR-5: this task
  previously sat between T11 and T12 and named only E-1, so any finding disposed "remove" at T12 had no scrub
  step at all and would have survived into public history — including S-1, whose `git rm --cached` at T10
  untracks it going forward but leaves the historical blob fully reachable under shapes A and A′.)
  - Applies whenever the remove-set is non-empty, **not only when G1 picks A′**. If G1 picks A and T12 produces
    a non-empty remove-set, then A was never actually available and the shape is A′ by definition. Say so and
    re-confirm with the owner rather than publishing around it.
  - Verify `git filter-repo` availability (claim 20); install it, or fall back to `git filter-branch` and
    accept that it is slow over 1776 commits.
  - Run the rewrite **against the T1 backup first**, diff the result, and only then against the working repo.
  - Batch the entire remove-set into **one** invocation. Repeated rewrites compound SHA churn for no benefit.
  - Afterwards re-run passes P1, P3, P4, **P5** and P7 and confirm **every** member of the remove-set is gone
    from **all** refs, not just `master`, and not just the one finding you were thinking about. P5 is in that
    list because a ref-name finding disposed "remove" is a branch rename or deletion, which is not a path
    removal and which P1 therefore cannot see (pass-2 m4).

- **T-M — FREEZE AND RE-MANIFEST. The last task in Stage 2, after T-A′.** Added at the pass-2 gate (M4),
  which found that the composition gate downstream could never have had a passing run.
  **The defect:** T14 was written to diff the pushed surface against "the sweep's cleared manifest" from
  Stage 1, and to STOP on any file the manifest does not list. But Stage 2 *necessarily* adds files the
  Stage-1 manifest cannot contain — LICENSE, notices, README, the `.gitignore` change, the E-1 fix — and
  T-A′ rewrites every SHA. As written, the gate either always STOPs or gets improvised past, and an
  improvised confidentiality gate is not a gate.
  1. **Declare the freeze window.** From here to T17, no ordinary Curio development lands. The plan calls this
     the owner's highest-velocity repo mid-redesign, so this window is a real cost and must be stated to him,
     not assumed. Any commit that does land inside it is **unswept** by P3/P4/P7 and reopens Stage 1 for the
     delta.
  2. **Re-derive the manifest** at final pre-push HEAD by re-running P1, P2 and P6. This is the manifest T14
     and T17 diff against. The Stage-1 manifest is evidence for the *sweep*, never the gate for the *push*.
  3. **Pin the SHA.** Record final pre-push HEAD in `S4-FINDINGS.md`. T13 pushes exactly that SHA, T16's
     `PUBLISH-CLEAR` verdict names it, and T17 asserts HEAD still equals it before publishing. **A
     `PUBLISH-CLEAR` that does not name a commit does not identify what was cleared.**
  4. Related fix (pass-2 M4): **T1's backup verification compares against a count measured at T1 time**, not
     against claim 3's frozen 1776, which goes spuriously red the moment any commit lands.

### Stage 3 — dry run (the HIGH-tier substitute, see Blast radius)

- **T13.** `gh repo create yovanmc/curio-publish-dryrun --private`, then push **exactly one branch** and nothing
  else. **Forbidden, and this is the whole point of the task:** `git push --mirror`, `git push --all`,
  `git push --tags`, `--follow-tags`. Any of them would push the 4 non-`master` branches, and under shape B
  would push the very history the shape exists to withhold.
- **T14.** Verify **server-side**, not locally: file count, commit count, largest objects, branch list, tag
  list. Diff that against **T-M's re-derived manifest at the pinned SHA** — not the Stage-1 manifest, which
  predates every file Stage 2 adds (pass-2 M4). Any file present on the server that the manifest does not list
  is a STOP condition, and so is a HEAD that does not match the pinned SHA.
- **T15.** Owner authorises deletion of the dry-run repo. **The agent does not delete a repo on its own
  initiative**, even one it created.

### Stage 4 — confidentiality gate

- **T16.** Invoke the `confidentiality-review` skill and run its canonical **three-lens panel** — identity
  inference, figures and internals, git surface — as pinned `sonnet` subagents, one lens each, returning quoted
  findings plus PASS/FAIL. Run it against the **actual dry-run surface**, not against this plan's description of
  it. Dispose every finding; re-run any failing lens after fixes. **A `PUBLISH-CLEAR` verdict is required before
  T17 and there is no override.**

### Stage 5 — publish

- **T17.** `gh repo create yovanmc/Curio --public` (name availability is claim 15; re-check it, since the
  planning check is dated). Push the single branch. Re-run the T14 server-side verification against the real
  repo. Set the description and topics.

**Incident runbook — what to do if a leak surfaces after publish.** Added at the pass-1 gate (MINOR-1): the
Blast radius section names this compounding failure explicitly and then no task defined the procedure, so the
plan had a precondition guard (T16) and a backup (T1) but no rollback story. Order matters, and the intuitive
order is wrong:

1. **Unlink the site FIRST**, before touching the repo. Revert the `repo` field in `src/content.ts` and merge
   it. The button disappears; nothing 404s. Doing this second means every visitor between deletion and revert
   hits a dead outbound link on a case-study page.
2. **Then contain the repo.** Making it private stops new readers immediately and is reversible, so it is the
   correct first containment move even though deletion is the eventual remedy.
3. **Deletion is the owner's call and the owner's action.** Consistent with T15: the agent does not delete a
   repo on its own initiative. Force-push is **not** a remedy here — that is confidentiality gate rule 1, and
   assuming otherwise is what cost a repo in July 2026.
4. Record the finding and its miss in `S4-FINDINGS.md`, and append the lens that would have caught it to
   `~\.claude\skills\dissect\references\review-lenses.md`.

### Stage 6 — site link (this repo, branch and PR)

- **T18.** Branch `feat/s4-curio-repo-link`. Add `repo: "https://github.com/yovanmc/Curio"` to the `curio`
  entry in `src/content.ts`. **One field. No other edit, and no prose touched** — see Scope.
- **T19.** **Precondition, as an executable first step of this task and not merely as prose in the ordering
  section above** (pass-2 M5a — the pass-1 fix put the guard in the preamble and never into the task, so the
  disposition table said FIXED while the builder's step list was unchanged):

  ```
  gh repo view yovanmc/Curio --json visibility
  ```

  It must return **`PUBLIC`**. Do not push the branch otherwise. **Testing existence is not enough**
  (pass-2 M5b): `gh repo view` exits 0 for the authenticated owner on a repo that is private or empty, so an
  exit-code guard false-passes in exactly the partial-failure case it was added for. The hazard is a link that
  is dead **for visitors**, and only `PUBLIC` rules that out. Casing is uppercase, verified live on gh 2.93.0.

  Then verify: `npm test` still green at the claim-1 count, `npm run build` green (remember that bare
  `npx tsc --noEmit` is a no-op in this repo — the root tsconfig is solution-style), plus a headless-Edge
  capture of `/work/curio/` judged by a pinned subagent confirming the `VIEW REPOSITORY` button renders with
  the right target. Run `Test-CaptureSane.ps1` before dispatching the judge. **Apply the S3 PR-A capture
  lesson**: scroll the subject into frame and assert its rect is inside the viewport before writing the file,
  and drive `closest('[data-scroll]')`'s `scrollTop` — `window.scrollTo` is a no-op on this app.
- **T20.** PR, CI green via foreground `gh pr checks <PR#> --watch`, then
  `gh pr merge --merge --delete-branch`, then sync main.

### Stage 7 — predecessor archiving

**Correction folded in at the pass-1 gate, recorded because the wrong version was briefed to the owner once
already.** An earlier draft of this stage claimed "the spec says 4 but only 3 exist" and tagged `AudioShelf`
PRIVATE. Both were wrong. The spec's list of four at `2026-07-02-spectacle-and-battle-design.md:40` is correct
and complete, and live visibility (re-verified 2026-07-31, claims 17 and 23) is **VideoTriage PUBLIC,
AudioShelf PUBLIC, VideoShelf PUBLIC, MangaReader PRIVATE**, none archived. The error's root cause is worth
naming: a recon subagent's reading of live GitHub state was carried into the ledger without re-verification.
**Re-check externally-observable facts before G1 consumes them.**

- **T21.** Re-run `gh repo list yovanmc --limit 100 --json name,visibility,isArchived` immediately before G1
  and reconcile claims 17 and 23 against it. Visibility can change between planning and build, and it decides
  which repos get a note in T22.
- **T22.** Three predecessors have Curio as their successor: `VideoShelf`, `AudioShelf`, `MangaReader`. Of
  those, **two are PUBLIC** (`VideoShelf`, `AudioShelf`) and get the "superseded by Curio" README note; the
  third is private and is handled in T23. So the note lands on **exactly two repos**. (Pass-2 m2: an earlier
  wording said "the three PUBLIC predecessors ... except MangaReader is private", conflating the
  successor-set with the public-set in a plan whose own header tells builders to STOP on a mismatch.)
  **Each note is a net-new public string and passes the confidentiality gate before commit** — it names
  Curio's public URL and nothing else. Then `gh repo archive` each. Archiving is reversible via
  `gh repo unarchive` (claim 16).
- **T23.** `MangaReader` is PRIVATE: archive only, no note, because a note on a private repo is visible to
  nobody. Defaulted to archive; the owner may prefer to leave it untouched, a one-line ruling.
- **T24. `VideoTriage` needs its own ruling and must not be swept into the Curio note (claim 23).** It is
  PUBLIC, and the spec supersedes it by **`Triage`**, not by Curio. But `Triage` is **PRIVATE**, so a
  "superseded by Triage" note would point every reader at a 404. Three options for the owner, none of which the
  agent picks alone: (a) archive `VideoTriage` with no successor note; (b) archive with a note that names no
  URL; (c) leave it alone until `Triage` is itself public. **Default (a).** Do not write "superseded by Curio"
  on it — that is factually wrong and would be publicly wrong.

### Stage 8 — profile README

- **T25.** Add Curio to the `yovanmc/yovanmc` profile README. **Pins are manual and stay manual**: no GraphQL
  pin mutation exists (API-verified 2026-07-02). Give the owner the click path. **Do not report Curio as
  pinned** — that is a claim the agent cannot make true.

### Stage 9 — ROADMAP

- **T26.** Flip S4 to ✅ with the merge reference and a Notes cell capped at ~60 words. Fold this milestone's
  plan-ready decision-log entry away rather than keeping both it and a shipped block. Run the hygiene and
  archive pass: the main table keeps open rows plus the last ~3 shipped, older ✅ rows move to
  `docs/roadmap-archive-2026-07.md` **after** their durable lessons are extracted. **Do not "correct" the
  spec's 4-repo count** — it is right; it was this plan's first draft that was wrong (see Stage 7). Commit.

## Verification summary

| Gate | How it is discharged here |
|---|---|
| Claim ledger + measured baseline | 23 rows above; `portfolio-rpg` measured in-session, Curio re-measured at T2 |
| Preflight recheck | `Check-PlanClaims.ps1` before T0; any FAIL reconciles the plan against HEAD first |
| Dissect pass 1 | `dissect-critic`, default pin |
| Dissect pass 2 | **pinned `fable`** — this plan is Opus-authored, so `opus` would share the author's blind spots. Framed "pass 1 found these, hunt only what it missed" |
| Per-commit diff review | Every commit, fixed lenses, HIGH cadence |
| Schema-evolution guard | Not owed; no serialized type changes (justified in Blast radius) |
| Synthetic-corpus dry run | Substituted by Stage 3; the substitution is stated for attack, not assumed |
| Confidentiality gate | Stage 4, three lenses, `PUBLISH-CLEAR` required, no override |

## Critique gate — dispositions

**Pass 1** (`dissect-critic`, pinned `sonnet`, 2026-07-31). Verdict FIX-THEN-SHIP. Blast-radius classification
attacked and held at HIGH. The schema-evolution exemption was independently verified by the critic reading
`AppServices.cs` and confirming the only in-scope code edit is a transient header string, not a persisted
field. **Every finding is disposed below; none was silently dropped.**

| # | Severity | Finding | Disposition |
|---|---|---|---|
| 1 | MAJOR | Predecessor recon wrong on live GitHub state: the spec's count of 4 is right, `AudioShelf` is PUBLIC not private, and `VideoTriage` is the 4th (superseded by `Triage`, not Curio) | **FIXED**, and re-verified by the orchestrator rather than taken on the critic's word. Claim 17 rewritten, claim 23 added, Stage 7 rebuilt with a new T24 for `VideoTriage`, Scope corrected, T26 corrected |
| 2 | MAJOR | G1 ruling 3 quoted the stale "2250 tests" three sections after the plan warned that number is wrong | **FIXED** — now 2824 per claim 2, and the comparison sharpened |
| 3 | MAJOR | The single stated ordering constraint named T16/T15, a stale pair from a mid-draft renumber; the real hazard is T18 vs T17 and was unguarded | **FIXED** — constraint corrected and backed by an explicit `gh repo view` precondition inside T19, so it no longer rests on stage order |
| 4 | MAJOR | No pass covered image metadata (EXIF/PNG text chunks) or HTML markup source, both enumerated by the confidentiality gate's rule 2 | **FIXED** — pass **P7** added; T6 widened to a second corpus |
| 5 | MAJOR | `T-A′` scrubbed only E-1 and ran *before* T12's disposition, so any other "remove" finding had no scrub step and would survive into public history | **FIXED** — T12 now precedes T-A′, T-A′ runs last in Stage 2 over the whole remove-set, and fires whenever the remove-set is non-empty rather than only under shape A′ |
| 6 | MAJOR | The public-repo HARD RULE bound only this repo's commit messages, not the new commits Stage 2 makes *inside Curio* — which become public at Stage 5 and postdate the scrub | **FIXED** — rule extended to Curio commits and branch names |
| 7 | MAJOR | "Widen the sample" had no floor; satisfied by viewing one more file, on the cluster the plan itself named highest-risk (review lens 90) | **FIXED** — `design/ds/` now 32 of 32 mandatory before G1; other clusters need full coverage or a numeric residual carried to G1 |
| 8 | MINOR | No rollback runbook for a leak found after publish, despite Blast radius naming that exact compounding failure | **FIXED** — incident runbook added after T17, unlink-before-contain ordering, deletion stays the owner's action |
| 9 | MINOR | Shape B's "non-destructive" framing undersold its cost to a repo under active development | **FIXED** — reframed as "deletes no bytes" with the bifurcation cost stated |
| 10 | MINOR | The "cost is low for this repo" argument rebutted a *friction* claim with a *probability* answer | **FIXED** — the axis mismatch is now stated in the plan, and G1 puts the trade to the owner in friction terms |

**The critic also noted that no publish/confidentiality-process lens exists in `review-lenses.md`** — this is
plausibly the first artifact of this shape to be dissected. Lenses **165, 166 and 167** were appended there from
this pass, as part of the ratchet, rather than left as a note here.

**Pass 2** (`dissect-critic`, pinned **`fable`** — a non-author model, since this plan is Opus-authored and an
Opus critic shares the author's blind spots; per-call model overrides the agent's `sonnet` frontmatter). Framed
"pass 1 found these, hunt only what it missed." Verdict FIX-THEN-SHIP. It held HIGH independently and cleared
feasibility (no hidden O(commits × files) pass; P6-equivalent reproduced claim 12's 160 PNGs in ~1s).

**Pass 2 found a BLOCKER and six MAJORs that pass 1 missed, and four of them were defects in pass 1's own
fixes.** That is the measured case for model-diverse second passes, on an artifact that had already cleared a
full six-pass dissection.

| # | Severity | Finding | Disposition |
|---|---|---|---|
| B1 | **BLOCKER** | The plan enumerated its own landmine **detector** set inline. Publishing the search terms discloses which associations are treated as sensitive — two are on the never-publish list. Lens 166 recursing into its own remedy: the ID-split was applied to findings, not to the detector | **FIXED**, and the window was verified still open (file untracked at the time). Claim 5 now points at a private `§Detector`; a new section states the rule and bans reconstruction hints. Both critics were pre-briefed, which is why neither report reproduces a string |
| M1 | MAJOR | The judgment-read corpus excluded the repo's most candid files. "245 docs" matched neither real corpus (248 tracked / 233 under `docs/`); the gap is the three ROOT docs incl. `CLAUDE.md`. Root cluster `design_handoff_curio_redesign/` (30 files, 27 HTML) appeared in no inventory at all. `docs/**.md` as a PS glob is one level (lens 48) | **FIXED** and independently re-measured. T6 corpus is now `git ls-files '*.md'`; T5 gains the root cluster as priority 4 and a derive-from-data instruction; P7 enumerates via `git ls-files '*.html'`; new **G1 ruling 5** asks whether the root docs publish at all |
| M2 | MAJOR | No network-identifier class in the detector: UNC share paths and the NAS hostname are in tracked docs | **FIXED** — added to the private detector spec, with the anchored-dotted-quad note (an unanchored private-IP pattern false-positives on ".NET 10.0") |
| M3 | MAJOR | `src/content.ts:143` says *"The code is private for now."* T18 adds the repo link to that same page, so S4 as written ships a case study that links a public repo and asserts it is private | **FIXED as a ruling, not as an edit** — hard constraint 1 forbids the agent touching that prose. New **G1 ruling 4**: owner amends the sentence or knowingly accepts. Verified at `content.ts:143` |
| M4 | MAJOR | T14's manifest gate could never pass: Stage 2 necessarily adds files the Stage-1 manifest cannot list, T-A′ rewrites every SHA, no task re-derived it, no SHA was pinned, and nothing froze development in the sweep→publish window | **FIXED** — new **T-M** (freeze, re-manifest, pin the SHA) closes Stage 2; T14/T17 diff against it; `PUBLISH-CLEAR` must name a commit; T1's backup check no longer compares against a frozen count |
| M5 | MAJOR | Pass 1's ordering fix landed in the preamble but never in T19's step list, and its predicate was wrong anyway — `gh repo view` exits 0 for the owner on a private or empty repo, so it false-passes exactly the case it guards | **FIXED** — precondition is now an executable first step of T19 and asserts `visibility == PUBLIC` |
| M6 | MAJOR | Claim 4 asserts one author **and** one committer email; its recheck counted only `%ae` (lens 90) | **FIXED** — recheck now folds `%ae%n%ce` |
| m1-m8 | MINOR | Stale "20 rows"; T22's set-conflation; P7's stale present-tense rationale; P5 missing from T-A′'s re-run; claim 20's cell FAILing live; A′'s ~99 dangling SHA citations in Curio's own ROADMAP; claim 14's non-discriminating recheck; `Test-CaptureSane` category-mismatched to HTML clusters | **ALL FIXED.** Claim 20 flipped from UNVERIFIED to verified-absent, which is a better row than the one it replaced |

**One pass-2 observation left open deliberately:** `review-lenses.md` carries duplicate numbers (two each of
114, 120, 127). Real, but it belongs to a session that owns that file, not to this milestone. Recorded here so
it is a decision rather than a drop.
