<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS & CONTRIBUTOR GUIDELINES

If you are an AI reading this, take every single word in this file literally. This project is a high-performance WhatsApp Web platform built with **Bun**, **TypeScript**, **Next.js (App Router)**, and **`zapo-js`**.

## 1. Project Principles & Architecture

All code here adheres to a deliberate structure designed for high reliability, minimal resource footprint, and type safety:

- **Library First (`zapo-js`)**: Never invent protocols or rely on outdated Baileys/WPPConnect APIs. Always adhere strictly to `zapo-js` and `@zapo-js/store-sqlite` contracts.
- **WhatsApp Web Parity**: The UI adheres to WhatsApp Web conventions:
  - Auth page with live QR code and 8-digit phone pairing code.
  - Two-pane workspace with searchable sidebar, filter pills (All, Unread, Groups), conversation history, and composer.
  - Native chat navigation: entering chats, closing chats, and group management (including leaving groups via `client.group.leaveGroup()`).
- **No Bot Commands**: This project does not use bot command prefix pipelines; it is an authentic WhatsApp Web client.
- **Next.js Fullstack Architecture**:
  - Web UI uses React 19 and Next.js App Router (`src/app/page.tsx`, `src/app/layout.tsx`).
  - REST & SSE Endpoints live in `src/app/api/` (`/api/auth/*`, `/api/chats`, `/api/events`, `/api/messages`).
  - Background WhatsApp engine lifecycle managed via `src/instrumentation.ts` (`register()` hook).

## 2. Directory Structure

```text
whatsapp-js/
├── src/
│   ├── app/                 # Next.js App Router (Dashboard & API endpoints)
│   │   ├── api/             # API Route Handlers (auth, chats, events, messages)
│   │   ├── layout.tsx       # Root layout
│   │   └── page.tsx         # WhatsApp Web interface (Auth & Chats)
│   ├── whatsapp/            # zapo-js connection & state layer
│   │   ├── client.ts        # WaClient lifecycle & group/message manager
│   │   ├── store.ts         # SQLite persistent store initialization
│   │   ├── events.ts        # Typed event bus and thread storage
│   │   ├── helpers.ts       # JID utilities & message text extractors
│   │   └── types.ts         # Session, chat, and message interfaces
│   └── instrumentation.ts   # Next.js server startup hook
├── docs/                    # Architectural & onboarding documentation
└── README.md                # Comprehensive project documentation
```

## 3. Workflow & Bun Scripts

Use Bun scripts in `package.json` for repository operations:
- `bun install` – Install project dependencies.
- `bun run dev` – Start Next.js development server.
- `bun run build` – Compile production bundle.
- `bun run typecheck` – Run TypeScript type checking (`tsc --noEmit`).
- `bun run lint` – Run ESLint checks.
