<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Database Workflow

Whenever you add or modify Prisma schema/models:
- Run `npx prisma migrate dev` (or `prisma migrate deploy` in prod) to apply migrations.
- Run `npx prisma generate` to keep the Prisma client in sync with the schema.
- Restart any dev servers so the regenerated client and new tables are picked up.

## Environment Sync

Whenever you change `.env` or `.env.local`, immediately mirror those values to Vercel by running:

```
scripts/sync-vercel-env.sh
```

The script walks through `DATABASE_URL`, `POSTGRES_URL`, `PRISMA_DATABASE_URL`, `OPENAI_API_KEY` (and any others you confirm) for production, preview, and development. Keep the hosted project aligned so deploys don’t diverge from local settings.

**Updating existing values:** Vercel won’t overwrite secrets that already exist. If you need to change an existing value, remove it first:

```
npx vercel env rm <VAR_NAME> <environment>
```

Then rerun `scripts/sync-vercel-env.sh` to add the new value. Repeat for each environment (production/preview/development).
