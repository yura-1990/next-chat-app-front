This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

### Install

```bash
bun install
```

Corp network: proxy MITMs TLS. `bun install` may fail with `UNABLE_TO_VERIFY_LEAF_SIGNATURE`. Fix: export corp root CA, pass to bun.

```powershell
$cert = Get-ChildItem Cert:\LocalMachine\Root | Where-Object { $_.Subject -eq "CN=Organization Certificate Authority 3, C=EN" }
Export-Certificate -Cert $cert -FilePath "$env:TEMP\corp-proxy-ca.cer" | Out-Null
certutil -encode "$env:TEMP\corp-proxy-ca.cer" "$env:TEMP\corp-proxy-ca.pem" | Out-Null
```

```bash
bun install --cafile "$TEMP/corp-proxy-ca.pem"
```

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Backend (rust-chat-app-back)

Sibling repo, `../rust-chat-app-back`. Gateway serves HTTP + WebSocket this frontend talks to.

### DB + infra

Two options, pick one.

**Docker** (simplest, needs Docker Desktop):

```sh
cd ../rust-chat-app-back
docker compose up -d
```

Gives Postgres, Dragonfly, MinIO, NATS on default ports.

**Native** (no Docker), example with Postgres 17 via Laragon:

```sh
PGBIN="C:/laragon/bin/postgresql/postgresql-17.2-3/bin"
"$PGBIN/initdb.exe" -D .data/postgres -U chat -A trust -E UTF8   # once
"$PGBIN/pg_ctl.exe" -D .data/postgres -l .data/postgres.log -o "-p 5433" start
"$PGBIN/createdb.exe" -p 5433 -U chat chat                        # once

# via `scoop install nats-server minio`
nats-server -p 4222
minio server .data/minio --console-address ":9001"
```

Migrations (`users`, `chats`, `chat_members`, `messages`) run automatically on gateway startup, no manual step.

### Run gateway

```sh
cd ../rust-chat-app-back
export DATABASE_URL="postgres://chat@127.0.0.1:5433/chat"
export NATS_URL="127.0.0.1:4222"
export JWT_SECRET="change-me"   # omit -> warns, uses insecure dev default
cargo run -p gateway
```

Check: `GET http://127.0.0.1:8080/health` -> `ok`. WebSocket at `ws://127.0.0.1:8080/ws`. `GATEWAY_ADDR` overrides bind address (default `127.0.0.1:8080`).

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
