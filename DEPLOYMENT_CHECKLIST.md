# Deployment Checklist — Manoj S Portfolio

## Pre-build
- [ ] Run `npm install` to fetch build tooling (`terser`, `clean-css`,
      `javascript-obfuscator`, `html-minifier-terser`, `imagemin*`, `fs-extra`)
- [ ] Confirm no secrets/API keys exist in `index.html` (already verified clean)
- [ ] Verify `images/` contains only optimized source assets you want shipped

## Build
- [ ] Run `npm run build`
- [ ] Confirm `dist/index.html` was created and is smaller than the source
- [ ] Confirm `dist/images/` contains recompressed images
- [ ] Confirm `dist/.htaccess` exists
- [ ] Spot-check `dist/index.html` in a local server:
      `npm run serve:dist` then open the printed URL
- [ ] Verify all sections render, animations run, and no console errors
      appear (obfuscation can occasionally break edge-case JS — test
      thoroughly before shipping)

## Server / Hosting
- [ ] Confirm the host runs **Apache** with `AllowOverride All` (required
      for `.htaccess` to take effect) — if Nginx, port the rules manually
- [ ] Confirm `mod_headers`, `mod_deflate`, `mod_expires`, `mod_rewrite`
      are enabled on the server
- [ ] Upload the **contents of `dist/`** (not the project root) to the
      web root
- [ ] Confirm `.htaccess` uploaded correctly (some FTP clients hide
      dotfiles — enable "show hidden files")
- [ ] Confirm SSL/TLS certificate is active (Let's Encrypt or host-issued)
- [ ] Uncomment the force-HTTPS block in `.htaccess` once SSL is confirmed live
- [ ] Set `ServerTokens Prod` in the main Apache config if you control it
      (shared hosting usually can't override this via `.htaccess`)

## Post-deploy verification
- [ ] Load the live URL over HTTPS — check for the padlock, no mixed-content warnings
- [ ] Check response headers (e.g. via browser DevTools → Network → Headers, or
      `curl -I https://yourdomain.com`) for:
      - `x-frame-options: SAMEORIGIN`
      - `x-content-type-options: nosniff`
      - `strict-transport-security`
      - `content-security-policy`
      - `content-encoding: gzip` or `br`
- [ ] Try to directly load a blocked path, e.g. `/.env`, `/.git/config`,
      `/package.json` — all should return 403/404
- [ ] Try `https://yourdomain.com/?/` or a nonexistent folder to confirm
      directory listing is disabled
- [ ] Run the site through:
      - [Google PageSpeed Insights](https://pagespeed.web.dev/)
      - [Mozilla Observatory](https://observatory.mozilla.org/) (security headers grade)
      - [SecurityHeaders.com](https://securityheaders.com/)
- [ ] Confirm images lazy-load (Network tab: below-fold project images
      load only on scroll)
- [ ] Confirm fonts and CDN scripts show `preconnect`/`dns-prefetch` in
      the Network waterfall (should connect earlier than without hints)

## Ongoing maintenance
- [ ] Re-run `npm run build` after every content/code change before
      redeploying
- [ ] Periodically re-check `SECURITY.md` recommendations (e.g. migrating
      off the Tailwind CDN for a stricter CSP)
- [ ] Rotate/replace the resume PDF and images as needed — the build
      script re-optimizes them automatically on the next `npm run build`
