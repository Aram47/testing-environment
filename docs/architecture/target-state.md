# Target State Architecture

## Architecture Principles

The target architecture keeps the control plane as a NestJS modular monolith and evolves only the execution plane where durability and isolation require it.

Principles:

- Keep users, companies, subscriptions, projects, environment configs, test suites, test runs, and reports in the monolith.
- Keep PostgreSQL as the source of truth for business state.
- Use WebSocket only for live updates, never as the source of truth.
- Move long-running execution to a durable queue and worker.
- Make test runs reproducible through immutable revisions.
- Avoid Kubernetes, gRPC, GraphQL, Kafka, and AI until the core REST plus Docker Compose workflow is production-ready.

## Component Overview

Target components:

- Control plane API: NestJS modular monolith serving REST, auth, authorization, project management, test authoring, reporting, and realtime gateway.
- PostgreSQL: durable source of truth for tenants, projects, revisions, test runs, execution state, and artifact metadata.
- Redis: BullMQ backing store for durable jobs, retries, locks, and worker coordination.
- Runner worker: separate Node/Nest process consuming execution jobs and running Docker Compose workflows.
- Artifact storage abstraction: local filesystem for development, object storage compatible implementation for production.
- Socket.IO gateway: live event fanout from persisted or sequenced run events.
- Future customer-hosted runner agent: optional remote execution plane registered to the control plane.

## Control Plane Modular Monolith

The control plane remains one deployable NestJS app with explicit modules:

- Identity and access: `auth`, `users`, guards, policy checks.
- Account and billing limits: `companies`, `subscriptions`.
- Project configuration: `projects`, `environment-configs`, `secrets`.
- Test authoring: `test-suites`.
- Execution coordination: `test-runs`, job enqueueing, state transitions.
- Reporting: `reports`, artifact metadata, logs reads.
- Realtime: WebSocket gateway and event fanout.

The control plane owns:

- REST APIs.
- Tenant ownership and permission checks.
- Revision creation.
- Execution plan creation.
- TestRun state machine.
- Job enqueue/cancel requests.
- Report and artifact read authorization.

The control plane must not run Docker Compose directly in the request/response path.

## Runner Worker

The runner worker is physically separate from the API process but can share code packages/modules where practical.

Worker responsibilities:

- Consume BullMQ jobs.
- Claim a `TestRun` for execution using durable state transitions.
- Load immutable environment revision, suite revisions, and canonical execution plan.
- Create isolated workspace.
- Validate Docker Compose against security policy.
- Start and stop Docker Compose.
- Execute healthcheck and test steps.
- Persist progress, results, logs/artifact metadata, and final status.
- Honor durable cancellation requests.
- Emit sequenced realtime events through a service boundary.

The worker does not own tenants, projects, billing, or API authorization decisions.

## BullMQ And Redis Job Queue

BullMQ should be introduced as the durable execution queue.

Minimum target behavior:

- A `test-run-execution` queue.
- Job ID derived from `testRunId` for idempotent enqueue.
- Database-backed claim step so only one worker can transition a run into active execution.
- Retry policy for transient infrastructure failures.
- No automatic retry for deterministic test failures.
- Dead-letter or failed-job inspection path.
- Worker concurrency limited by subscription plan and deployment capacity, enforced at claim time as well as enqueue time.
- Stalled job detection.
- Graceful shutdown that stops accepting new jobs and finishes or safely requeues active work.

PostgreSQL remains the source of truth. Redis/BullMQ coordinates execution and delivery, but durable run status is stored in PostgreSQL.

## Durable TestRun State Machine

Target `TestRun` states should be explicit and guarded.

Recommended state model:

- `CREATED`: run row exists before durable enqueue completes.
- `QUEUED`: durable job exists.
- `CLAIMED`: worker claimed the run.
- `PREPARING_WORKSPACE`, `VALIDATING_ENVIRONMENT`, `PULLING_IMAGES`,
  `STARTING_ENVIRONMENT`, `WAITING_FOR_HEALTHCHECK`, `EXECUTING_TESTS`,
  `COLLECTING_ARTIFACTS`, `CLEANING_UP`: durable runner phases.
- `CANCEL_REQUESTED`: cancellation requested and worker is stopping work.
- `PASSED`: completed with no failed tests.
- `TEST_FAILED`: user test assertions failed.
- `INFRA_FAILED`: platform/environment execution failed.
- `CANCELLED`: cancellation completed.
- `TIMED_OUT`: exceeded configured run timeout.

Rules:

- State transitions must be validated in one service.
- Final states are terminal.
- Cancellation request must be persisted.
- Worker heartbeat or lease metadata should allow recovery from crashed workers.
- API cancellation should move the run toward `CANCEL_REQUESTED`, not rely on an in-memory set.
- Repeated create/enqueue/cancel operations must be idempotent where clients or workers may retry.

For backward compatibility, frontend status labels can initially map detailed internal states to the existing coarse statuses.

## Immutable Revisions

Target model:

- `EnvironmentConfig` remains editable current draft/current config.
- `EnvironmentConfigRevision` stores immutable compiled runtime config.
- `TestSuite` remains editable current draft/current suite.
- `TestSuiteRevision` stores immutable compiled suite YAML and visual flow snapshot.
- `TestRun` references exact revision IDs.

Revision content should include:

- Original visual definition when applicable.
- Compiled YAML.
- Compiler version.
- Created by user ID.
- Created timestamp.
- Content hash.

This enables reproducible test runs even after users edit project configuration or suites.

## Canonical Execution Plan

Before enqueueing execution, the control plane should build a canonical execution plan.

The execution plan should include:

- Plan version.
- Project ID and company ID.
- Environment revision ID.
- Suite revision IDs.
- Ordered step list with stable step IDs.
- Step type: `apiRequest`, `wait`, `pollUntil`.
- Request details after validation but before runtime variable interpolation.
- Expected assertions.
- Save-variable definitions.
- Run settings, timeout, cleanup setting.
- Content hash.

Benefits:

- Runner executes one canonical shape instead of re-parsing mutable project state.
- Reports can explain exactly what was executed.
- Future customer-hosted agents receive a stable contract.

## Docker Compose Security Policy

Target policy should be explicit, versioned, and test-covered.

Minimum deny list:

- `privileged: true`
- `network_mode: host`
- Docker socket mounts.
- Root host path mounts.
- Dangerous Linux capabilities.
- Host PID/IPC modes.
- Unsafe devices.
- Unbounded resource usage.
- Unsupported Compose keys that weaken isolation.

Minimum allow/constraint list:

- Allowed service fields.
- Allowed volume types and path patterns.
- CPU and memory limits where supported.
- Network model controlled by runner.
- Build context restrictions or a policy to disable builds in hosted SaaS mode.
- Image pull policy and optional registry allowlist.
- Secrets handling rules.

Hosted SaaS should not execute untrusted customer containers on a shared Docker host. For SaaS execution, prefer isolated VMs or a customer-hosted runner agent model.

## Object Storage Abstraction For Logs And Artifacts

PostgreSQL should store metadata and small indexed summaries. Large artifacts should move behind an abstraction.

Artifact types:

- Docker logs.
- Full HTTP request/response bodies.
- JSON reports.
- Runner workspace diagnostics.
- Optional screenshots or future binary artifacts.

Storage interface:

- `putArtifact(metadata, stream|buffer)`
- `getArtifact(artifactId, authorizationContext)`
- `deleteArtifact(artifactId)`
- `createSignedReadUrl(artifactId)` where supported.

Development backend can use local filesystem. Production can use S3-compatible object storage. PostgreSQL stores artifact ID, type, size, content type, hash, retention timestamp, and tenant/project/run ownership.

Artifact reads must always authorize through tenant ownership of the parent project/run. Signed URLs, if used, should be short-lived and scoped to one artifact.

## Realtime Events With Sequence Number

Realtime events should be sequenced and replayable.

Target event shape:

- `eventId`
- `testRunId`
- `companyId`
- `sequence`
- `type`
- `schemaVersion`
- `payload`
- `createdAt`

Rules:

- Sequence increments per test run.
- Events are persisted before or at the same reliability level as fanout.
- WebSocket emits only live delivery.
- REST endpoint can return current run state and optionally event history since a sequence.
- Frontend can reconnect and request missed events.
- Event reads and subscriptions must both enforce company ownership of the parent run.

## Future Customer-Hosted Runner Agent

The future agent should be an optional execution plane, not a rewrite of the control plane.

Target responsibilities:

- Register runner capability and heartbeat.
- Poll or receive assigned jobs.
- Download canonical execution plan and allowed secrets.
- Execute in customer's infrastructure.
- Upload sequenced events, results, logs, and artifacts.
- Support cancellation through durable control-plane state.

Security model:

- Agent-scoped credentials.
- Tenant-bound job assignment.
- Short-lived tokens for artifact upload/download.
- No direct database access from agents.
- Idempotent upload semantics for events, results, and artifacts so agent retries cannot duplicate run output.

This should come after durable queue, revisions, execution plan, and artifact storage are stable.

## Compatibility Strategy

Preserve current REST endpoints where practical.

Recommended compatibility approach:

- Keep current run create/list/detail/cancel endpoints.
- Add fields instead of replacing fields.
- Preserve frontend adapters for old/new names during transition.
- Map detailed internal states to existing frontend statuses until UI is upgraded.
- Keep manual YAML authoring supported.
- Add new revision and artifact APIs incrementally.
