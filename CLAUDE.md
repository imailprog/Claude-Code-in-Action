# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

UIGen is an AI-powered React component generator with live preview. Users describe components via chat, and Claude generates/edits files in a virtual file system with real-time iframe preview.

## Commands

```bash
npm run setup      # First-time setup: install deps + Prisma generate + migrations
npm run dev        # Dev server with Turbopack
npm run build      # Production build
npm start          # Production server
npm run lint       # ESLint
npm test           # Vitest (all tests)
npx vitest run src/lib/__tests__/file-system.test.ts  # Run a single test file
npm run db:reset   # Force-reset SQLite database
```

## Architecture

**Stack**: Next.js 15 (App Router) + React 19 + TypeScript + Prisma/SQLite + Tailwind CSS v4

### Key Data Flow

1. User sends prompt → `ChatProvider` (Vercel AI SDK `useChat`) → `POST /api/chat`
2. API streams Claude responses with tool calls (`str_replace_editor`, `file_manager`)
3. Tool calls are executed client-side against the `FileSystemProvider` (virtual in-memory FS)
4. `PreviewFrame` watches FS changes → Babel transforms JSX → generates iframe with import map (esm.sh CDN for npm packages, blob URLs for local files)

### Dual Mode

- **With `ANTHROPIC_API_KEY`**: Uses Claude Haiku 4.5 with prompt caching, max 40 tool steps
- **Without API key**: `MockLanguageModel` in `src/lib/provider.ts` returns static component code (max 4 steps)

### State Management

Two React Context providers wrap the app:
- **ChatProvider** (`src/lib/contexts/chat-context.tsx`): chat messages, AI streaming, tool call handling
- **FileSystemProvider** (`src/lib/contexts/file-system-context.tsx`): virtual file CRUD, selected file, tool result processing

### Auth

JWT sessions (jose) in HTTP-only cookies, bcrypt password hashing. Server actions in `src/actions/index.ts`. Anonymous users get localStorage-based persistence via `src/lib/anon-work-tracker.ts`.

### Core Modules

- `src/lib/file-system.ts` — `VirtualFileSystem` class: in-memory tree with serialize/deserialize for Prisma storage
- `src/lib/transform/jsx-transformer.ts` — Babel JSX transform + import map generation + preview HTML construction
- `src/lib/tools/str-replace.ts` — Zod-validated tool schema for AI file editing (create/str_replace/insert/view)
- `src/lib/tools/file-manager.ts` — AI tool for rename/delete operations
- `src/lib/prompts/generation.tsx` — System prompt for component generation

### Database

SQLite via Prisma. Two models: `User` and `Project`. Project stores chat messages and virtual FS state as JSON strings. Schema at `prisma/schema.prisma`.

### UI Layout

Resizable panels: Chat (left, 35%) | Preview+Code (right, 65%). Code view splits into FileTree + Monaco CodeEditor. Built with shadcn/ui (New York style) + Radix UI primitives.

### Path Alias

`@/*` maps to `./src/*` in tsconfig.

## Code Style

- Use comments sparingly. Only comment complex code.
