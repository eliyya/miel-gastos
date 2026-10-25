<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project workflow

- Finish every delivered change with a Git commit.
- This project runs on Node.js 24. Write scripts in TypeScript (`.ts`) rather than JavaScript.
- Do not use the Stripe types flag; it is not needed in this environment.
- Implement all new database functionality with Prisma 8. Keep existing Prisma 7 functionality on Prisma 7.
