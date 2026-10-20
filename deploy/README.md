# Production: ulianaa-learning.pro

GitHub repository: `godev256/uliana-learning-platform`. Frontend and Go backend are built together. The previous independent backend Git history is preserved locally in `.local/deploy/backend-history.bundle` and `.local/deploy/backend-go-git-backup`; neither contains deployment secrets in the repository.

## Release path

A push to `main` (or a manual run of **Test, publish GHCR images and deploy** on `main`) performs:

1. Go formatting, vet, real PostgreSQL integration tests with the race detector, and frontend build with `VITE_GO_BACKEND=true`.
2. Build and push Linux/amd64 images `ghcr.io/godev256/uliana-learning-api:<commit-sha>` and `ghcr.io/godev256/uliana-learning-web:<commit-sha>`.
3. SSH as `deploy`, execute only `deploy <full-commit-sha>`, pull both images, back up the database, wait for health checks, verify both public HTTPS endpoints, and retain the previous image tag on container-health failure.

The `codex/smooth-ink-icons` branch runs validation and publishes commit-tagged images, but its deployment job is explicitly disabled. Only `main` can deploy.

The web image includes React and Caddy. PostgreSQL 17 uses a persistent volume. Redis is not used. Only Caddy publishes ports 80/TCP, 443/TCP and 443/UDP. API and PostgreSQL ports are private Docker networks.

Caddy obtains and renews certificates from Let's Encrypt for `ulianaa-learning.pro` and `api.ulianaa-learning.pro`. Main-site `/api/*` requests also proxy to Go, keeping the current frontend's relative API paths and secure cookies compatible. The dedicated API domain supports the same routes. Credentialed CORS allows only configured origins.

## Secrets and host files

Repository Actions secrets: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS`.

Publishing uses the workflow's `GITHUB_TOKEN` with `packages:write`; deployment uses a separate job's `packages:read` token, transferred through SSH stdin. Temporary registry credentials are kept under `/run` and removed after deployment. There is no permanent GHCR personal token on the server.

Server `/opt/ulianaa/.env` is root-owned, mode 0600, containing database password, JWT secret, domains and the successful image SHA. Values are generated on installation and never committed. Compose and deployment scripts are root-owned; the CI key cannot alter them or obtain a shell. The `deploy` user is not in the Docker group and has sudo permission for exactly one validated deployment command.

Administrative SSH key on this workstation: `.local/deploy/keys/admin_ed25519`. Treat this as a private credential. The supplied root password remains enabled as requested. The CI account permits only its restricted SSH key, with forwarding and PTY disabled.

## Host protection

- UFW permits SSH and web traffic; database and API have no published ports.
- fail2ban protects SSH using journald and detects repeated failed API logins and known bot probes from Caddy JSON logs.
- Web bans attach to `DOCKER-USER`, because Docker-published ports bypass ordinary UFW input rules.
- Go login limits identify clients only through `X-Real-IP` from the fixed, private Caddy address. Direct clients cannot spoof that header.
- Standard Ubuntu unattended security updates remain enabled. Reboots are manual.

## Operations

```sh
cd /opt/ulianaa
docker compose --env-file .env -f compose.yaml ps
docker compose --env-file .env -f compose.yaml logs --tail=100 api caddy
fail2ban-client status
systemctl list-timers ulianaa-backup.timer
/usr/local/sbin/ulianaa-backup
```

Backups are custom-format PostgreSQL dumps under `/opt/ulianaa/backups`, retained for 14 days, scheduled daily at 03:30 UTC with up to 15 minutes of random delay. Assets are stored in PostgreSQL and included. These are backups on the same server; an independent off-server backup destination is not configured.

To inspect a dump without changing production:

```sh
cat backups/postgres-TIMESTAMP.dump | docker compose --env-file .env -f compose.yaml exec -T postgres pg_restore --list
```

Image rollback does not undo database migrations; schema changes must remain backward-compatible with the previous API version.

Test restore into a separate empty database first. Never run `down -v` on production; it deletes persistent data and certificates.

## Initial data migration

`backend-go/scripts/export-postgres.mjs` opens a repeatable-read, read-only transaction and writes a private mode-0600 snapshot. The importer `/app/import-local -file ...` validates it and imports in one transaction, refusing nonempty destinations. Account password hashes, notebooks, all pages and attachment bytes are retained; sessions are not copied. A fresh login is required after the move.

The anonymous boards at `localhost:5174/board` live in that browser origin's storage and are separate from the Go database; deploying this stack does not erase or automatically copy them.
