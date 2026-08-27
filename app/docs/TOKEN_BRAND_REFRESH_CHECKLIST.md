# Baraza Token And Logo Refresh Checklist

## Completed In Repo

- [x] Keep the fire-and-council SVG as the canonical Baraza mark.
- [x] Add cache-safe `/baraza-logo-v2.svg` and point app chrome, favicon, and structured data to it.
- [x] Add square `/brza-token-logo.svg` for BRZA token surfaces.
- [x] Add `/brza-token.json` with BRZA identity, decimals, website, and token-logo URL.
- [x] Expose BRZA logo and metadata URLs from `BRZA_ASSET`.
- [x] Replace the stale social-card checkmark with the current fire-and-council mark.
- [x] Update the brand guide and README to describe the active mark.

## Deployment Follow-Up

- [x] Redeploy Vercel so the new static assets are public.
- [x] Confirm `/baraza-logo-v2.svg`, `/brza-token-logo.svg`, and `/brza-token.json` return `200`.
- [ ] Update the Stellar issuer account home domain to the production Baraza domain.
- [ ] Publish or update the issuer-domain `/.well-known/stellar.toml` entry for BRZA with the final issuer address and `/brza-token-logo.svg` image URL.
- [ ] Verify the BRZA logo in Stellar explorers and wallets after their metadata caches refresh.
- [x] Refresh the deployed OG asset so social preview refreshers can fetch the new mark.
