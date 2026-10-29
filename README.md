# pubit

给个人 AI Agent 用的单人静态站点托管。每个站点是一个目录；Agent 用 REST 管站点、用 WebDAV 管文件。管理后台在 `/admin`。

## 本地运行

需要 Go 1.24+ 和 Node 22。

```bash
cd web && npm ci && npm run build && cd ..
export PUBIT_ADMIN_USER=admin
export PUBIT_ADMIN_PASSWORD=admin
export PUBIT_AGENT_TOKEN=change-me
export PUBIT_BASE_URL=http://localhost:8080
go run ./cmd/pubit
```

打开 http://localhost:8080/admin （默认 `admin` / `admin`）。

环境变量：

| 变量 | 默认 | 含义 |
|------|------|------|
| `PUBIT_LISTEN` | `:8080` | 监听地址 |
| `PUBIT_DATA` | `./data` | SQLite 与站点文件目录 |
| `PUBIT_BASE_URL` | `http://localhost:8080` | 返回给 Agent 的对外地址 |
| `PUBIT_ADMIN_USER` | `admin` | 后台用户名 |
| `PUBIT_ADMIN_PASSWORD` | `admin` | 后台密码 |
| `PUBIT_AGENT_TOKEN` | `change-me` | Agent REST / WebDAV 口令 |

容器只听 HTTP。HTTPS 交给前面的 Caddy / nginx。

## Docker

```bash
export PUBIT_ADMIN_PASSWORD=admin
export PUBIT_AGENT_TOKEN=change-me
docker compose up --build
```

数据卷挂在 `/data`，端口 `8080`。

## 安装 skill

把 `skill/SKILL.md` 拷到本机 Cursor skills 目录，例如：

```bash
mkdir -p ~/.cursor/skills/pubit
cp skill/SKILL.md ~/.cursor/skills/pubit/SKILL.md
```

或从已运行的实例拉取同一份文件：

```bash
curl -sS "$PUBIT_BASE_URL/skill.md" -o ~/.cursor/skills/pubit/SKILL.md
```

Agent 会先核对 `PUBIT_BASE_URL` 和 `PUBIT_AGENT_TOKEN`，缺了会停下来问你。

## Agent 示例

```bash
curl -sS -X POST "$PUBIT_BASE_URL/api/sites" \
  -H "Authorization: Bearer $PUBIT_AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"slug":"hello","name":"Hello"}'

curl -sS -u "agent:$PUBIT_AGENT_TOKEN" -T index.html "$PUBIT_BASE_URL/dav/hello/index.html"
```

公开地址：`$PUBIT_BASE_URL/hello/`，短链：`$PUBIT_BASE_URL/s/{code}`。
