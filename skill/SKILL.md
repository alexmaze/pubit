---
name: pubit
description: Publish and update static sites on a personal pubit instance via REST and WebDAV. Use when the user wants to deploy, update, or take down a static site, or change its password, short link, HTTP switch, or SPA fallback.
---

# pubit

Use this skill to publish or update a static site on the user's personal pubit host.

## When to use

The user wants to publish, update, or take down a static web build, or change a site's password, short link, HTTP switch, or SPA fallback.

## 1. Check configuration first

Read `PUBIT_BASE_URL` and `PUBIT_AGENT_TOKEN` from the environment, a local `.env`, or values the user already gave you.

If **either is missing, stop**. Ask the user how they want to configure this instance. Do not guess.

- `PUBIT_BASE_URL`: public origin of the pubit instance, including scheme, no trailing slash. Example: `https://pubit.example.com`
- `PUBIT_AGENT_TOKEN`: the same token the server was started with (`PUBIT_AGENT_TOKEN`)

After the user provides both, ask them to put the values in the environment or a local `.env`. Confirm the instance is reachable:

```bash
curl -sS "$PUBIT_BASE_URL/api/health"
```

Expect `{"ok":true}`. Only then continue.

Auth for REST: `Authorization: Bearer $PUBIT_AGENT_TOKEN`.

## 2. Sites

Create (409 if slug or short code already exists — ask for another name, never overwrite):

```bash
curl -sS -X POST "$PUBIT_BASE_URL/api/sites" \
  -H "Authorization: Bearer $PUBIT_AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"slug":"hello","name":"Hello","http_enabled":true}'
```

JSON fields: `slug` (required), `name`, `short_code` (optional; auto-generated if omitted), `http_enabled`, `password`, `spa_fallback`.

The response includes `url`, `short_url`, and `dav_url`. Give those share links back to the user.

```bash
curl -sS "$PUBIT_BASE_URL/api/sites" -H "Authorization: Bearer $PUBIT_AGENT_TOKEN"
curl -sS -X DELETE "$PUBIT_BASE_URL/api/sites/hello" -H "Authorization: Bearer $PUBIT_AGENT_TOKEN"
```

## 3. Files via WebDAV

WebDAV root: `$PUBIT_BASE_URL/dav/{slug}/`  
Basic auth username `agent`, password `$PUBIT_AGENT_TOKEN`.

```bash
curl -sS -u "agent:$PUBIT_AGENT_TOKEN" -T index.html "$PUBIT_BASE_URL/dav/hello/index.html"
curl -sS -u "agent:$PUBIT_AGENT_TOKEN" "$PUBIT_BASE_URL/dav/hello/index.html"
curl -sS -u "agent:$PUBIT_AGENT_TOKEN" -X DELETE "$PUBIT_BASE_URL/dav/hello/index.html"
curl -sS -u "agent:$PUBIT_AGENT_TOKEN" -X MKCOL "$PUBIT_BASE_URL/dav/hello/assets"
```

Stay inside that site root. Never use `..`. Only touch the site the user named.

## 4. Zip import

Upload a build zip into the site (merge/overwrite files from the archive):

```bash
curl -sS -X POST "$PUBIT_BASE_URL/api/sites/hello/import" \
  -H "Authorization: Bearer $PUBIT_AGENT_TOKEN" \
  -F "file=@dist.zip"
```

Export: `GET $PUBIT_BASE_URL/api/sites/hello/export`.

## 5. Settings

```bash
curl -sS -X PATCH "$PUBIT_BASE_URL/api/sites/hello" \
  -H "Authorization: Bearer $PUBIT_AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"short_code":"hi","password":"share-secret","http_enabled":true,"spa_fallback":true}'
```

Fields: `name`, `short_code`, `http_enabled`, `password`, `clear_password` (bool), `spa_fallback`.

If HTTP is off, browsers get 404 at `/{slug}/`, but REST and WebDAV still work.

On 409 (slug or short code conflict), ask the user for a different value. Do not overwrite.

## 6. Return share URLs

Always give the user the public URL (`/{slug}/`) and short URL (`/s/{code}`) from the API response.
