# Contributing Guidelines

Welcome to **whatsapp-js**. These guidelines should be reviewed before submitting issues or pull requests.

## 1. Development Management

All development workflows are managed through Bun scripts:

| Script      | Command             | Description                                               |
| :---------- | :------------------ | :-------------------------------------------------------- |
| `install`   | `bun install`       | Download and install project dependencies.                |
| `dev`       | `bun run dev`       | Start the Next.js development server on `localhost:3000`. |
| `typecheck` | `bun run typecheck` | Run static TypeScript validation (`tsc --noEmit`).        |
| `lint`      | `bun run lint`      | Lint the codebase with ESLint.                            |
| `build`     | `bun run build`     | Compile Next.js production bundle.                        |

## 2. Architecture & Code Quality

- **AI Agents**: If you are an AI assistant, read [AGENTS](../AGENTS.md) carefully before making modifications.
- **Protocol Library**: All WhatsApp protocol logic must use [`zapo-js`](https://github.com/vinikjkkj/zapo) and `@zapo-js/store-sqlite`. Do not introduce deprecated or incompatible libraries.
- **Strict Types**: Every module, interface, and handler must have comprehensive TypeScript type definitions. Do not use unchecked `any`.
- **Formatting**: Code must adhere to strict formatting and pass `bun run lint` & `bun run typecheck` before creating PRs.
- **Commits**: Conventional commit conventions must be followed (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`).

## 3. Pull Request Workflow

1. Fork and create a feature branch from `main`.
2. Implement your changes following project conventions.
3. Validate locally with `task typecheck`, `task lint`, and `task build`.
4. Submit a Pull Request targeting the `main` branch.
