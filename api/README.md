# Root API Re-Export Directory

This directory contains entry-point shims that re-export the canonical API route handlers implemented under `app/api/`.

Every file here is a thin re-export:
- Canonical business logic and test suites reside in `app/api/`
- When adding new routes under `app/api/<path>.ts`, add the corresponding re-export shim here.
