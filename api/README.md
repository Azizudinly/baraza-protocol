# Why this directory exists

The Vercel project's Root Directory is set to the repo root, not `app/`.
Vercel's zero-config function discovery only looks for serverless
functions inside a literal `<root-directory>/api/` folder — it cannot
see `app/api/`, where the real route implementations and their tests
live. (The former `app/vercel.json` was a duplicate of this root
config and has been removed — the root `vercel.json` is the only
Vercel configuration read while Root Directory stays at the repo root.)

Every file here is a thin re-export shim: real logic stays in
`app/api/`. When adding a new route under `app/api/<path>.ts`, add a
matching shim here (copy an existing one, fix the import path and the
`config.runtime` value) or it silently won't deploy.

The durable fix is flipping Project Settings → Root Directory to `app`
in the Vercel dashboard, then deleting this directory and the root
`vercel.json`.
