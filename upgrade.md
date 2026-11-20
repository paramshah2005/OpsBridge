# Dependency upgrades in OpsBridge

Status: Feature proposal; not implemented.

## Purpose

Add dependency update discovery, upgrade PR creation, and evidence-backed upgrade investigations to OpsBridge. This is a repository-scoped feature inside the existing product, not a standalone application.

The feature answers three questions:

1. Which dependencies have newer versions available?
2. Can OpsBridge prepare an upgrade PR for me?
3. How might that upgrade affect my application, and what checks support the result?

## Agreed product behavior

- Scan npm for new versions of dependencies already used by connected repositories.
- Show available upgrades in OpsBridge and announce newly discovered updates in the repository chat.
- Offer a **Create upgrade PR** button. This is the precise label for the discussed “Upgrade now” action: clicking proposes an upgrade; merging applies it to the default branch.
- On click, create a branch, update the relevant dependency files, and open a draft PR.
- Start an investigation of the resulting PR and surface evidence and verification results in OpsBridge.
- Leave PR review and merging to the user. Do not automatically merge upgrades.
- Also detect dependency changes in existing PRs and direct pushes.

## Initial scope

- npm projects with one package at the repository root.
- `package.json` and supported `package-lock.json` formats.
- JavaScript and TypeScript application code.
- Public npm registry dependencies and stable published releases.
- One direct dependency upgrade per bot-created PR, including its resulting transitive changes.
- Explicit handling of unsupported repositories, private registry dependencies, missing lockfiles, and unavailable documentation.

Workspaces, other package managers, private registries, grouped upgrades, prerelease tracks, and automatic source migrations are later extensions. Inventory can work across many libraries; detailed migration rules should initially support a small, declared set.

## Detection triggers

| Trigger | What happens |
| --- | --- |
| Scheduled registry scan | Compare the default branch's resolved dependencies with published npm versions. Proposed initial cadence: daily, configurable later. |
| Check for updates | Run the same scan on demand. |
| Default-branch push | Refresh inventory and detect committed dependency changes from the previous and new snapshots. |
| PR opened, synchronized, or reopened | Inspect changed dependency files and compare the PR baseline and candidate. |

A newly published version is an **available update**, not a committed repository change. Keep those events distinct.

Changing a manifest or lockfile triggers inspection; semantic comparison determines whether versions actually changed. Classify additions, removals, upgrades, downgrades, and range-only changes separately. A lockfile-only update can change resolved versions even when manifest ranges stay unchanged.

Record resolved versions, not just declared ranges. For example, `^3.0.0` may resolve to `3.8.2`. Preserve package locations when multiple versions occur in the dependency tree.

Local, unpushed edits are outside the hosted feature's visibility.

## Primary user flow

### 1. Discover an update

The user opens a connected repository in OpsBridge. The Dependencies view and repository chat show a card such as:

```text
Dependency update available

example-validator: 3.8.2 -> 4.0.0
Major update | Outside your current manifest range

[View release notes] [Create upgrade PR] [Dismiss]
```

This package and version pair is illustrative.

Show the current resolved version, target version, declared range, update category, and last scan time. Distinguish a newer release within the current range from one requiring a range change. A major version is a review signal, not proof of a breaking change.

Do not notify repeatedly about the same repository/package/target combination. Persist dismissals. An existing matching open PR replaces the creation button with **View PR**.

### 2. Request an upgrade PR

Clicking **Create upgrade PR** authorizes branch and PR creation for the displayed repository, package, and target version.

The backend must:

1. Check the user's repository access and the bot's write/PR permissions.
2. Resolve the latest default-branch commit and confirm the target is still applicable.
3. Check for an existing open upgrade PR and an in-progress request for the same upgrade.
4. Prepare an isolated copy of that exact commit.
5. Update the dependency specification only as needed, preserving dependency category and the project's range convention where practical.
6. Regenerate the lockfile with a supported, recorded npm version. Never hand-edit resolved lockfile records.
7. Confirm that the intended target actually resolved and capture the complete dependency diff.
8. Create a branch and commit the manifest/lockfile changes.
9. Open a draft PR and store its URL and commit SHAs.
10. Start an investigation and announce the linked PR in repository chat.

If the target fits the existing manifest range, a lockfile-only change may be appropriate. If resolution fails, show the peer conflict or other error and do not open an invalid upgrade PR. Never use forced dependency resolution silently.

Use idempotency and a database uniqueness/locking strategy so repeated clicks, retries, and webhook deliveries do not create duplicate PRs. Recover partial failures: if the branch exists but PR creation failed, retry from the recorded state.

### 3. Review the investigation

The PR detail page displays progress and then an investigation summary:

```text
Upgrade investigation
example-validator: 3.8.2 -> 4.0.0

2 compatibility findings
3 behavior changes to review
6 files potentially affected

Verification: In progress

[View findings] [View migration plan] [Open PR]
```

These numbers illustrate the layout; actual values come from the investigation.

Group the report into Findings, Affected code, Dependency changes, and Verification. Show documentation coverage and analysis limitations beside the summary.

### 4. Review a finding

Each finding connects:

- The documented upstream change and exact supporting passage.
- The relevant code usage at the analyzed commit, with file and line references.
- Why the change may affect that usage.
- A suggested migration action supported by the evidence.
- Related compiler, test, or build diagnostics, if available.

Allow Reviewed, Needs work, and Not applicable decisions. Keep user decisions separate from evidence strength and verification status.

### 5. Verify and merge through the normal PR workflow

Compare the baseline and candidate in equivalent isolated environments. Show existing failures separately from newly introduced failures. Produce a migration checklist linked to findings and checks.

The user reviews the PR, makes any required code changes, and merges through the normal GitHub workflow. Later source changes trigger refreshed verification and make older commit-specific results visibly outdated.

## Investigation engine

### Snapshot and dependency analysis

Pin every investigation to exact baseline and candidate commit SHAs. For PRs, record the comparison baseline, such as the merge base, rather than silently comparing unrelated moving branch tips. Record manifest/lockfile hashes, Node/npm versions, environment, analyzer version, and rule version.

Use npm-aware dependency graph analysis, such as `@npmcli/arborist`, to inspect resolved versions, dependency paths, peer requirements, and runtime engine constraints. Analyze the full candidate dependency diff; one requested upgrade can change several transitive dependencies.

### Evidence collection

Collect official release notes, changelogs, migration guides, package metadata, and relevant type declarations. Cover the full upgrade interval, including intermediate major versions.

Store source URLs, retrieval times, version relevance, content hashes, and cited passages. Missing documentation is a coverage gap, not evidence that an upgrade has no breaking changes.

### Code usage analysis

Locate imports and resolve references, including aliases, namespaces, CommonJS usage, and supported re-exports. Use a version-pinned source analysis adapter, such as the appropriate TypeScript compiler API.

Treat dynamic loading, computed access, unresolved wrappers, and missing types as explicit blind spots. Do not claim that static analysis proves runtime compatibility.

### Matching and AI assistance

Use deterministic rules for version comparisons, resolved imports, documented removed APIs, engine requirements, and verification results.

Use an LLM to extract structured changes from supplied documentation and explain findings. Require source-backed output and validate references. Treat repository content and retrieved documents as untrusted data, not instructions. Unsupported replacements and guesses remain unconfirmed.

### Finding classification

| Dimension | Values |
| --- | --- |
| Impact | Blocker, high, medium, low |
| Evidence strength | Confirmed, supported, speculative |
| Verification | Passed, failed, not run, inconclusive |

Avoid a synthetic safety percentage. A passing build does not establish that runtime behavior is unchanged.

## Verification

Run baseline and candidate checks against the same repository snapshot context and equivalent environments:

| Check | Baseline | Candidate | Meaning |
| --- | --- | --- | --- |
| Install | Pass | Fail | Candidate resolution or installation regression |
| Typecheck | Pass | Fail | New compile problem |
| Tests | Same failure | Same failure | Existing failure, not newly attributed to the upgrade |
| Build | Pass | Pass | Build check passed; runtime coverage remains separate |
| Behavior test | Missing | Missing | Unverified behavior |

Use clean, lockfile-backed installs. Preserve relevant npm resolution configuration and record any deviations. Capture commands, exit codes, durations, logs, and environment details.

Repository commands and dependencies execute code. Keep execution in disposable isolated workers with resource/time limits, restricted network access, and no production secrets. Keep GitHub write credentials outside the execution sandbox. If required install scripts or environment setup are unavailable, mark affected checks inconclusive instead of blaming the upgrade.

## Integration architecture

- Reuse existing OpsBridge authentication, repository context, webhook ingestion, persistence, chat feed, and PR surfaces where implemented and suitable.
- Verify the current repository implementation before treating an integration point as available.
- Add a scheduler and persistent job queue for scans, PR preparation, and investigations.
- Run analysis outside short-lived web requests; run repository code in a separate isolated execution service.
- Expose progress and partial results through the existing application communication pattern.
- Use repository-scoped authorization for every read and write action.
- Support repositories without write access in discovery mode, with a clear explanation when PR creation is unavailable.

Suggested backend operations:

```text
POST /api/repos/:id/dependencies/scan
GET  /api/repos/:id/dependencies
POST /api/repos/:id/upgrades
GET  /api/upgrades/:id
POST /api/upgrades/:id/investigations
GET  /api/investigations/:id
POST /api/investigations/:id/verification
```

These routes are proposed contracts, not existing endpoints. Validate target versions and package names and pass process arguments without shell interpolation.

## Persistence

Suggested records:

- Repository dependency snapshots and resolved package instances.
- Available updates, dismissals, and notification state.
- Upgrade requests, branch/PR references, and idempotency keys.
- Investigations, stage progress, baseline/candidate SHAs, and freshness state.
- Source documents/passages, code usages, findings, and evidence links.
- Verification runs, diagnostics, migration checklist items, and user review decisions.

Use object storage for large logs and document snapshots. Cache public package/version evidence independently from commit-specific analysis. Do not persist registry or repository credentials in reports.

## Failure and lifecycle behavior

- Registry unavailable: retain the last successful scan and label it stale; retry with backoff.
- No valid target: explain why no stable upgrade is offered.
- Resolution conflict: retain the failure report; do not claim a PR was created.
- Duplicate request: return the existing job or PR.
- New PR commits: mark old results outdated and refresh the relevant analysis.
- Baseline or target branch changes: reassess whether the comparison and merge verification remain current.
- PR closed or merged: stop presenting it as an actionable open upgrade and refresh inventory as needed.
- Unsupported project or incomplete evidence: preserve useful results and label the limits.

## Delivery milestones

1. **Inventory and discovery:** Read dependency files, scan npm, display available updates, and support manual refresh.
2. **Notifications and PR creation:** Deduplicated chat cards, dismissals, isolated lockfile generation, branch creation, and draft PR creation.
3. **Push and PR detection:** Detect semantic dependency changes from webhooks and associate them with investigations.
4. **Evidence and code impact:** Retrieve version-specific sources, map usage, and produce traceable findings for supported libraries.
5. **Verification and migration plan:** Compare baseline/candidate checks and generate a source-backed checklist.
6. **Polish and expansion:** Retry/recovery UX, richer library rules, workspaces, grouped upgrades, and optional verified source patches.

## Acceptance criteria

- A registry scan discovers an update without requiring an open PR.
- Repeated scans do not produce duplicate notifications.
- The creation button produces one draft PR with valid generated dependency changes, even if clicked repeatedly.
- Resolution failure produces a useful report without an invalid upgrade PR.
- The default branch changes only through the normal merge workflow.
- Lockfile-only changes and transitive changes are represented correctly.
- Findings link to reproducible code locations and supporting evidence.
- Existing failures are distinguished from new candidate failures.
- Missing evidence and unrun checks remain visible.
- No automatic merge or undocumented source edits occur.

## Reference documentation

- Dependabot version updates: https://docs.github.com/en/code-security/concepts/supply-chain-security/dependabot-version-updates
- npm Arborist: https://github.com/npm/cli/tree/latest/workspaces/arborist
- npm clean installation: https://docs.npmjs.com/cli/v11/commands/npm-ci
- TypeScript compiler API: https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API

These references informed the proposal; implementation must verify the exact supported tool versions and APIs.
