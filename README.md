<p align="center">
  <img src="https://pub-687f7ee583cf4f339cab34d2b3a3871d.r2.dev/logo.svg" width="220" alt="WhatsRook JS" />
</p>

<h1 align="center">WhatsRook JS</h1>

<p align="center">
  <strong>High-performance, modern WhatsApp Web platform and interface.</strong><br />
  Built with Bun, TypeScript, Next.js 16 (App Router), and <a href="https://github.com/vinikjkkj/zapo">zapo-js</a>.
</p>

<p align="center">
  <img alt="runtime" src="https://img.shields.io/badge/runtime-Bun-FBF0DF?logo=bun&logoColor=black" />
  <img alt="language" src="https://img.shields.io/badge/language-TypeScript-3178C6?logo=typescript&logoColor=white" />
  <img alt="framework" src="https://img.shields.io/badge/framework-Next.js%2016-black?logo=next.js&logoColor=white" />
  <img alt="protocol" src="https://img.shields.io/badge/protocol-zapo--js-0A7EA4" />
  <img alt="license" src="https://img.shields.io/badge/license-MIT-green" />
</p>

---

## Overview

**WhatsRook JS** is a high-performance WhatsApp Web web application matching the real WhatsApp Web user experience. Built with Bun and the zero-copy, memory-efficient [`zapo-js`](https://github.com/vinikjkkj/zapo) library.

### Key Capabilities

1. **Authentication Experience**:
   - Matching WhatsApp Web pairing screen.
   - Live high-resolution QR Code scanning with auto-refresh via Server-Sent Events (SSE).
   - Link with Phone Number (8-digit code pairing).
2. **Conversations & Chat Workspace**:
   - **Sidebar**: Complete chats list with avatars, names, last message preview, unread badges, search filter, and category pills (All, Unread, Groups).
   - **Enter / Leave Chat**: Select any conversation to view real-time chat history. Close active chat or exit back to the overview.
   - **Group Management**: Automatic group synchronization and native **Leave Group** capability.
   - **Messaging**: Real-time incoming & outgoing messages with WhatsApp dark theme chat bubbles, timestamps, and delivery indicators.
   - **Start New Chat**: Quickly start conversations with any phone number or group JID.

---

## Quick Start

### 1. Installation

```bash
bun install
```

### 2. Configuration

Create your `.env` file:

```bash
cp .env.example .env
```

| Variable       | Description                                              | Default    |
| :------------- | :------------------------------------------------------- | :--------- |
| `SESSION_ID`   | Unique identifier for SQLite session storage             | `default`  |
| `AUTH_DIR`     | Storage directory for authentication state               | `.auth`    |
| `PORT`         | Port for Next.js web application                         | `3000`     |

### 3. Running

```bash
bun run dev
```

Navigate to `http://localhost:3000` in your browser.

---

## Development Scripts

Managed directly via Bun:

```bash
bun install         # Install dependencies
bun run dev         # Run Next.js WhatsApp Web dev server
bun run typecheck   # TypeScript static type checking
bun run lint        # Run ESLint
bun run build       # Compile Next.js production build
```

---

## Project Structure

```text
whatsapp-js/
├── src/
│   ├── app/                 # Next.js App Router (WhatsApp Web Dashboard & API)
│   │   ├── api/             # API Route Handlers
│   │   │   ├── auth/        # QR, pairing code, status, logout
│   │   │   ├── chats/       # Chat threads, group actions (leave)
│   │   │   ├── events/      # Server-Sent Events (SSE) real-time streaming
│   │   │   └── messages/    # Message retrieval & sending
│   │   ├── layout.tsx       # Root layout
│   │   └── page.tsx         # Complete WhatsApp Web Auth & Chat interface
│   ├── whatsapp/            # zapo-js connection & state layer
│   │   ├── client.ts        # WhatsApp client coordinator (zapo-js)
│   │   ├── store.ts         # Persistent SQLite store setup
│   │   ├── events.ts        # Typed event bus and thread storage
│   │   ├── helpers.ts       # JID & text parsing utilities
│   │   └── types.ts         # Session, chat, and message types
│   └── instrumentation.ts   # Next.js server startup hook
├── docs/                    # Onboarding & developer guides
└── README.md                # Project documentation
```

---

## Acknowledgements

Special thanks to:
- [`vinikjkkj/zapo`](https://github.com/vinikjkkj/zapo) – The high-performance WhatsApp Web protocol TypeScript library.
- [`whatsrook`](https://github.com/thruqe/whatsapp-go) – Architecture and engineering foundation.

---

## Licensing

Licensed under the [MIT License](./LICENSE).

---

## Support this project

If you found this project helpful, please consider sending a tip:

<a href="https://etherscan.io/address/0x76a5307e573401f2b7189fb721a33dc483e985a8"><img src="https://cdn-icons-png.flaticon.com/128/15301/15301597.png" width="24" height="24" alt="Donate ETH" /></a> `0x76a5307e573401f2b7189fb721a33dc483e985a8`
