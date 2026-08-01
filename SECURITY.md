# Security Recommendations — Manoj S Portfolio

This document explains what was hardened, why, and what to do next.
It follows the principle stated up front: **HTML/CSS/JS cannot be hidden
from a browser** — View Source and DevTools will always work, and that's
fine. Security here means protecting the *server*, the *transport*, and
*data*, not obscuring client code.

## 1. What `.htaccess` now enforces

| Area | Directive | Effect |
|---|---|---|
| Directory listing | `Options -Indexes` | Prevents browsing folder contents if `index.html` is missing |
| Hidden files | `FilesMatch` + `RewriteRule "(^|/)\."` | Blocks `.env`, `.git`, `.htaccess`, `.gitignore` from being served |
| Sensitive extensions | `FilesMatch \.(env|ini|log|sql|bak|config|json|yml|yaml)$` | Blocks accidental exposure of config/DB dumps |
| Lockfiles | `composer.json/.lock`, `package.json/-lock.json` | Prevents dependency-fingerprinting / supply-chain recon |
| Compression | `mod_deflate` + optional `mod_brotli` | Smaller payloads, faster TTFB |
| Caching | `mod_expires` + `Cache-Control` | Images/fonts 1yr, CSS/JS 1mo, HTML always revalidated |
| Headers | `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `HSTS`, `CSP` | Standard OWASP secure-header baseline |
| ETags | `FileETag None` | Avoids leaking inode/filesystem metadata across servers |
| Server signature | `ServerSignature Off`, `Header unset Server` | Reduces fingerprinting (full effect needs `ServerTokens Prod` in `httpd.conf`, not always overridable via `.htaccess` on shared hosts) |
| Protected folders | `assets/private`, `config`, `uploads/private`, `storage` | 403s any request even if the folder exists on disk |

### Content-Security-Policy caveat
The current CSP includes `'unsafe-inline'` and `'unsafe-eval'` in
`script-src` because the site loads the **Tailwind CDN JIT compiler**
(`cdn.tailwindcss.com`) and keeps CSS/JS inline in `index.html`. This is
required for the site to function as-is.

**To reach a strict CSP (no `unsafe-inline`/`unsafe-eval`) later:**
1. Replace the Tailwind CDN `<script>` with a compiled Tailwind CSS file
   (`npx tailwindcss -o styles.css --minify`) referenced via `<link>`.
2. Move all inline `<script>`/`<style>` blocks into external files.
3. Add a `nonce-` or `sha256-` hash per remaining inline block if any
   must stay inline.
4. Tighten `script-src`/`style-src` to drop `'unsafe-inline'`/`'unsafe-eval'`.

## 2. No secrets in the codebase

The repo was scanned for API keys, tokens, DB/FTP credentials, and none
were found — the site is fully static (no backend calls, no forms
posting to a server). Keep it that way:

- **Never** commit `.env` files — `.gitignore` and `.htaccess` both block them.
- If a contact form or analytics endpoint is added later, put any
  key/secret in a serverless function or backend proxy — **never** in
  client-side HTML/JS, since anything shipped to the browser is public
  by definition (obfuscation is not a substitute for keeping secrets
  off the client).

## 3. Build-time hardening (`build.js`)

Running `npm install && npm run build` produces a `dist/` folder with:
- Inline JS obfuscated (`javascript-obfuscator`): identifiers mangled,
  strings base64-encoded, `console.*` calls stripped at runtime via
  `disableConsoleOutput`.
- Inline CSS minified (`clean-css`, level 2).
- Full HTML minified (`html-minifier-terser`): comments and redundant
  whitespace/attributes removed.
- Images recompressed (`mozjpeg`, `pngquant`, `svgo`).
- `.htaccess` and the resume PDF copied verbatim into `dist/`.

**Deploy the contents of `dist/`, not the source root.**

## 4. What was intentionally NOT done

Per explicit instruction, this hardening does **not**:
- Disable right-click, F12, Ctrl+Shift+I, or Ctrl+U.
- Use fake/"anti-DevTools" JavaScript tricks (they don't work reliably
  and break accessibility tools / legitimate users).
- Attempt to hide HTML/CSS/JS from the browser — that is not possible
  for a client-rendered site and isn't a real security boundary.

## 5. Ongoing recommendations

- Enable HTTPS (Let's Encrypt / host-provided SSL) and uncomment the
  force-HTTPS block in `.htaccess`.
- If the host is Nginx instead of Apache, `.htaccess` rules do not
  apply — port the same directives into the `server {}` block (ask if
  you need the Nginx equivalent).
- Periodically re-run `npm audit` on `devDependencies` used for the
  build pipeline.
- If a contact form becomes server-backed, add CSRF protection, rate
  limiting, and server-side input validation.
- Consider a CDN (Cloudflare, etc.) in front of the site for DDoS
  mitigation, automatic Brotli, and edge caching.
