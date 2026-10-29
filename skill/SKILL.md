---
name: pubit
description: Publish and update static sites on a personal pubit instance via REST and WebDAV. Use when the user wants to deploy, update, or take down a static site, or change its password, short link, HTTP switch, or SPA fallback.
---

# Pubit

Use this skill to publish or update a static site on the user's personal Pubit host.

## When to use

The user wants to publish, update, or take down a static web build, or change a site's password, short link, HTTP switch, or SPA fallback.

## 1. Check configuration first

Read `PUBIT_BASE_URL` and `PUBIT_AGENT_TOKEN` from the environment, a local `.env`, or values the user already gave you.

If **either is missing, stop**. Ask the user how they want to configure this instance. Do not guess.

- `PUBIT_BASE_URL`: public origin of the Pubit instance, including scheme, no trailing slash (for example `https://pubit.example.com`)
- `PUBIT_AGENT_TOKEN`: the same token the server was started with (`PUBIT_AGENT_TOKEN`)

After the user provides both, ask them to put the values in the environment or a local `.env`. Confirm the instance is reachable:

```bash
curl -fsS "$PUBIT_BASE_URL/api/health"
```

Expect `{"ok":true}`. Only then continue.

REST auth header: `Authorization: Bearer $PUBIT_AGENT_TOKEN`.

## 2. Sites

Slug rules: lowercase `a-z`, `0-9`, and internal `-` (max 64 chars). Reserved: `admin`, `api`, `dav`, `s`.  
Short code rules: `a-z`, `A-Z`, `0-9`, `-` (max 32 chars).

Create a site (`409` if slug or short code already exists — ask the user for another name, never overwrite):

```bash
curl -fsS -X POST "$PUBIT_BASE_URL/api/sites" \
  -H "Authorization: Bearer $PUBIT_AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"slug":"hello","name":"Hello","http_enabled":true}'
```

Create fields: `slug` (required), `name`, `short_code` (auto-generated if omitted), `http_enabled` (default `true`), `password`, `spa_fallback`.

List / get / delete:

```bash
curl -fsS "$PUBIT_BASE_URL/api/sites" -H "Authorization: Bearer $PUBIT_AGENT_TOKEN"
curl -fsS "$PUBIT_BASE_URL/api/sites/hello" -H "Authorization: Bearer $PUBIT_AGENT_TOKEN"
curl -fsS -X DELETE "$PUBIT_BASE_URL/api/sites/hello" -H "Authorization: Bearer $PUBIT_AGENT_TOKEN"
```

Only delete a site when the user explicitly asks to remove it.

## 3. Files via WebDAV

WebDAV root: `$PUBIT_BASE_URL/dav/{slug}/`  
Basic auth username `agent`, password `$PUBIT_AGENT_TOKEN`.

Create parent folders with `MKCOL` before uploading into a nested path:

```bash
curl -fsS -u "agent:$PUBIT_AGENT_TOKEN" -T index.html "$PUBIT_BASE_URL/dav/hello/index.html"
curl -fsS -u "agent:$PUBIT_AGENT_TOKEN" -X MKCOL "$PUBIT_BASE_URL/dav/hello/assets"
curl -fsS -u "agent:$PUBIT_AGENT_TOKEN" -T app.js "$PUBIT_BASE_URL/dav/hello/assets/app.js"
curl -fsS -u "agent:$PUBIT_AGENT_TOKEN" "$PUBIT_BASE_URL/dav/hello/index.html"
curl -fsS -u "agent:$PUBIT_AGENT_TOKEN" -X DELETE "$PUBIT_BASE_URL/dav/hello/assets/app.js"
```

Stay inside that site root. Never use `..`. Only touch the site the user named.

## 4. Zip import / export

Import extracts from the root of the archive into the site directory (merging/overwriting matching files). Zip the **contents** of the build directory so `index.html` is at the archive root, not nested under `dist/`:

```bash
(cd dist && zip -qr /tmp/site.zip .)
curl -fsS -X POST "$PUBIT_BASE_URL/api/sites/hello/import" \
  -H "Authorization: Bearer $PUBIT_AGENT_TOKEN" \
  -F "file=@/tmp/site.zip"
```

Export the whole site as a zip:

```bash
curl -fsS "$PUBIT_BASE_URL/api/sites/hello/export" \
  -H "Authorization: Bearer $PUBIT_AGENT_TOKEN" \
  -o hello.zip
```

## 5. Settings

```bash
curl -fsS -X PATCH "$PUBIT_BASE_URL/api/sites/hello" \
  -H "Authorization: Bearer $PUBIT_AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"short_code":"hi","password":"share-secret","http_enabled":true,"spa_fallback":true}'
```

Patch fields (all optional): `name`, `short_code`, `http_enabled`, `password`, `clear_password` (bool, removes the password), `spa_fallback`.

- When `http_enabled` is `false`, browsers get `404` at `/{slug}/`, while REST and WebDAV keep working.
- When `password` is set, visitors see a password prompt page at `/{slug}/` and unlock the site with that password.
- On `409` (short code conflict), ask the user for a different code. Do not overwrite another site.

## 6. Return share URLs

Always give the user the public URL (`url`, `/{slug}/`) and short link (`short_url`, `/s/{code}`) from the API response. If a password was set, remind them to share the password alongside the link.
