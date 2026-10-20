# Backend architecture

The existing React/Vite frontend remains in the parent repository. This directory is an independent Go repository and is not part of the frontend's deployment.

- `cmd/api`: application composition and HTTP lifecycle.
- `cmd/admin`: explicit administrative commands; no production public registration.
- `cmd/devdb`: development-only native PostgreSQL runner when Docker is unavailable.
- `internal/model`: domain data and typed errors, no infrastructure imports.
- `internal/repository`: interfaces; `postgres` implements persistence through pgx and Squirrel.
- `internal/service`: authorization, validation, board ownership, page operations and document rules.
- `internal/handler`: HTTP transport, JWT middleware, existing frontend API compatibility.
- `internal/auth`: password hashes and JWT signing/validation.
- `internal/config`: validated environment configuration.
- `migrations`: versioned SQL schema, applied transactionally by Go.
- `deploy`: PostgreSQL + Go + Caddy configuration. No Redis.

Dependencies point inward: handlers → services → repository interfaces/models. PostgreSQL contains tables, indexes and integrity constraints; no business triggers, stored procedures or generated business identifiers.

Boards and every page are stored in PostgreSQL. Opaque drawing objects remain JSONB so 3D geometry, annotations and future frontend fields survive round trips. Saves use optimistic revisions and transactions; stale writers receive HTTP 409. Uploaded chunks are immutable and owned by a student.

Authentication uses signed, expiring JWTs with explicit issuer/audience/algorithm validation. Browser compatibility uses an HttpOnly cookie; API clients may use Bearer tokens. Session IDs and revocations live in PostgreSQL. A password reset revokes all sessions. Passwords are never stored in plaintext. Role/ownership checks are performed by Go services.

The existing `/api/account?action=…` contract is retained to run the current frontend without a rewrite. An initial `/api/v1` API exposes authentication and board operations. Vite proxies `/api` to Go only when explicitly configured locally. Production Vercel is unchanged.

Git: commit each complete stage locally. No GitHub remote is assumed or created; push every subsequent commit after the backend remote is supplied and connected.
