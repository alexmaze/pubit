# Pubit

**English** | [简体中文](README.zh-CN.md)

Personal static web hosting for AI agents. Single Go binary with an embedded React admin and SQLite: agents create and configure sites over **REST**, upload files over **WebDAV** or **ZIP**, and return shareable URLs and short links.

![Sites dashboard](docs/images/sites.png)

## Features

- **Directory-isolated sites** — each `slug` maps to `sites/{slug}/`; paths stay inside the site root (`..` is rejected).
- **Agent-native protocols** — `Bearer` token for the JSON API, HTTP Basic (`agent` + token) for WebDAV, or one-shot ZIP import/export.
- **Sharing controls** — standalone password unlock page, auto or custom short links (`/s/{code}`), one-click HTTP toggle (WebDAV still works while Offline), and SPA `index.html` fallback.
- **Built-in `/admin` workspace** — file tree, drag-and-drop upload/ZIP extract, inline code editor (`⌘S`), and desktop/mobile live preview.
- **Single binary** — frontend and `skill/SKILL.md` are embedded via `go:embed`. Listens on HTTP `:8080`; put Caddy or Nginx in front for HTTPS.

| Workspace & live preview | Inline editor |
| --- | --- |
| ![Workspace](docs/images/workspace.png) | ![Editor](docs/images/editor.png) |

| Access & sharing drawer | Visitor password page |
| --- | --- |
| ![Sharing](docs/images/sharing.png) | ![Password Unlock](docs/images/password-unlock.png) |

## Quick Start

### 1. Docker (recommended)

Pushes to `main` publish multi-arch (`linux/amd64`, `linux/arm64`) images to `ghcr.io/alexmaze/pubit:latest`:

```bash
docker run -d --name pubit \
  -p 8080:8080 \
  -v pubit-data:/data \
  -e PUBIT_BASE_URL=https://pubit.example.com \
  -e PUBIT_ADMIN_USER=admin \
  -e PUBIT_ADMIN_PASSWORD=your-password \
  -e PUBIT_AGENT_TOKEN=your-agent-token \
  ghcr.io/alexmaze/pubit:latest
```

Or with `docker-compose.yml`:

```bash
export PUBIT_ADMIN_PASSWORD=your-password
export PUBIT_AGENT_TOKEN=your-agent-token
docker compose up -d --build
```

Open `http://localhost:8080/admin` to sign in.

### 2. From Source

Requires Go 1.24+ and Node 22:

```bash
cd web && npm ci && npm run build && cd ..
export PUBIT_ADMIN_USER=admin
export PUBIT_ADMIN_PASSWORD=admin
export PUBIT_AGENT_TOKEN=change-me
export PUBIT_BASE_URL=http://localhost:8080
go run ./cmd/pubit
```

## Environment Variables

| Variable | Default | Description |
| --- | --- | --- |
| `PUBIT_LISTEN` | `:8080` | HTTP listen address |
| `PUBIT_DATA` | `./data` | Data directory (`pubit.db` and `sites/{slug}/`) |
| `PUBIT_BASE_URL` | `http://localhost:8080` | Public origin (no trailing slash) used in returned URLs |
| `PUBIT_ADMIN_USER` | `admin` | Admin UI username |
| `PUBIT_ADMIN_PASSWORD` | `admin` | Admin UI password |
| `PUBIT_AGENT_TOKEN` | `change-me` | Shared token for Agent REST and WebDAV |

## Install the Agent Skill

Fetch `skill.md` from a running instance (or copy `skill/SKILL.md` from this repo):

```bash
mkdir -p ~/.cursor/skills/pubit
curl -fsS "$PUBIT_BASE_URL/skill.md" -o ~/.cursor/skills/pubit/SKILL.md
```

You can also copy the install command from **Agent Setup** in the top bar of `/admin`.

When invoked, the skill checks `PUBIT_BASE_URL` and `PUBIT_AGENT_TOKEN` in the environment (or local `.env`) first. If either is missing, the agent stops and asks before continuing.

## Routes & API

| Path | Description |
| --- | --- |
| `/admin` | Admin SPA |
| `/api/health` | Health check (`{"ok":true}`) |
| `/api/sites` | `GET` list / `POST` create site (`409` on slug or short code conflict) |
| `/api/sites/{slug}` | `GET` detail / `PATCH` name, short code, password, HTTP, SPA / `DELETE` site |
| `/api/sites/{slug}/import` | `POST` upload and extract a site ZIP |
| `/api/sites/{slug}/export` | `GET` download the site as a ZIP |
| `/dav/{slug}/` | Site WebDAV root (Basic user `agent`, password `PUBIT_AGENT_TOKEN`) |
| `/{slug}/...` | Public static files (`404` when Offline; password page when protected) |
| `/s/{code}` | Short link (`302` to `/{slug}/`) |
| `/skill.md` | Serves `skill/SKILL.md` |

> Reserved slugs: `admin`, `api`, `dav`, `s`.

### Minimal curl Example

```bash
# 1. Create a site
curl -fsS -X POST "$PUBIT_BASE_URL/api/sites" \
  -H "Authorization: Bearer $PUBIT_AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"slug":"hello","name":"Hello"}'

# 2. Upload a file via WebDAV
curl -fsS -u "agent:$PUBIT_AGENT_TOKEN" -T index.html "$PUBIT_BASE_URL/dav/hello/index.html"

# 3. Or import a build directory as a ZIP
(cd dist && zip -qr /tmp/site.zip .)
curl -fsS -X POST "$PUBIT_BASE_URL/api/sites/hello/import" \
  -H "Authorization: Bearer $PUBIT_AGENT_TOKEN" \
  -F "file=@/tmp/site.zip"
```
