@AGENTS.md

## Claude Code notes

- AGENTS.md (imported above) is the source of truth for architecture and rules. Put project knowledge there, not here, so other agents get it too.
- This is a Windows machine. The Bash tool is Git Bash; PowerShell is also available.
- Never put real keys in committed files. `.env.local` is gitignored, and `.env.example` is the committed template.
- Never run SQL against the user's Supabase project, or apply migrations to it, without asking. Hand them the SQL or the file to run.
- When changing caching, Suspense boundaries or route files, run `npm run build`. Cache Components errors only show up at build time or in the dev overlay.
- Keep the bundle lean: prefer Server Components, and add `"use client"` only to the interactive leaf.
