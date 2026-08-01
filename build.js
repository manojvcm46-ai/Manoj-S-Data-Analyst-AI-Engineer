/**
 * Production build script for the Manoj S portfolio (static site).
 *
 * Pipeline:
 *   1. Extract inline <script> (non-src) blocks from index.html
 *   2. Obfuscate + minify JS with javascript-obfuscator (mangles names,
 *      strips console.* and debugger statements)
 *   3. Minify inline <style> blocks with clean-css
 *   4. Re-inject the processed JS/CSS back into the HTML
 *   5. Minify the full HTML (removes comments/whitespace) with
 *      html-minifier-terser
 *   6. Optimize images (sharp for PNG/JPEG, svgo for SVG) into dist/images
 *   7. Copy static assets (.htaccess, PDF, images) into dist/
 *
 * Run with:  npm run build   ->  output in ./dist
 */
const fs = require('fs-extra');
const path = require('path');
const { minify: minifyHtml } = require('html-minifier-terser');
const CleanCSS = require('clean-css');
const JavaScriptObfuscator = require('javascript-obfuscator');
const sharp = require('sharp');
// svgo v3 is ESM-only — loaded lazily via dynamic import() inside main()
// so this file can stay CommonJS.

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
const SRC_HTML = path.join(ROOT, 'index.html');

const SCRIPT_BLOCK_RE = /<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi;
const STYLE_BLOCK_RE = /<style([^>]*)>([\s\S]*?)<\/style>/gi;

async function main() {
  console.log('▶ Cleaning dist/ ...');
  await fs.remove(DIST);
  await fs.ensureDir(DIST);

  console.log('▶ Reading index.html ...');
  let html = await fs.readFile(SRC_HTML, 'utf8');

  console.log('▶ Obfuscating & minifying inline <script> blocks ...');
  html = html.replace(SCRIPT_BLOCK_RE, (match, attrs, code) => {
    const trimmed = code.trim();
    if (!trimmed) return match; // empty script (e.g. tailwind config placeholder handled below)
    try {
      const obfuscated = JavaScriptObfuscator.obfuscate(trimmed, {
        compact: true,
        controlFlowFlattening: false, // keep true perf impact low for a portfolio site
        deadCodeInjection: false,
        debugProtection: false,
        disableConsoleOutput: true, // strips console.* calls at runtime
        identifierNamesGenerator: 'hexadecimal',
        renameGlobals: false,
        selfDefending: false,
        stringArray: true,
        stringArrayEncoding: ['base64'],
        stringArrayThreshold: 0.6,
        splitStrings: false,
        target: 'browser'
      }).getObfuscatedCode();
      return `<script${attrs}>${obfuscated}</script>`;
    } catch (err) {
      console.warn('  ! Skipped obfuscation for a script block:', err.message);
      return match;
    }
  });

  console.log('▶ Minifying inline <style> blocks ...');
  const cleanCss = new CleanCSS({ level: 2 });
  html = html.replace(STYLE_BLOCK_RE, (match, attrs, code) => {
    const trimmed = code.trim();
    if (!trimmed) return match;
    const output = cleanCss.minify(trimmed);
    if (output.errors.length) {
      console.warn('  ! CSS minify errors, keeping original block:', output.errors);
      return match;
    }
    return `<style${attrs}>${output.styles}</style>`;
  });

  console.log('▶ Minifying HTML (removing comments & whitespace) ...');
  const minifiedHtml = await minifyHtml(html, {
    collapseWhitespace: true,
    conservativeCollapse: false,
    removeComments: true,
    removeRedundantAttributes: true,
    removeEmptyAttributes: true,
    removeScriptTypeAttributes: true,
    removeStyleLinkTypeAttributes: true,
    useShortDoctype: true,
    minifyCSS: false, // already minified above
    minifyJS: false,  // already obfuscated/minified above
    sortAttributes: true,
    sortClassName: false,
    collapseBooleanAttributes: true
  });

  await fs.writeFile(path.join(DIST, 'index.html'), minifiedHtml, 'utf8');
  console.log(`  ✓ index.html: ${(html.length / 1024).toFixed(1)}KB -> ${(minifiedHtml.length / 1024).toFixed(1)}KB`);

  console.log('▶ Optimizing images ...');
  const imagesSrc = path.join(ROOT, 'images');
  const imagesDist = path.join(DIST, 'images');
  if (await fs.pathExists(imagesSrc)) {
    await fs.ensureDir(imagesDist);
    const entries = await fs.readdir(imagesSrc);
    let optimizedCount = 0;
    let svgOptimize = null;

    for (const entry of entries) {
      const ext = path.extname(entry).toLowerCase();
      const srcPath = path.join(imagesSrc, entry);
      const destPath = path.join(imagesDist, entry);

      try {
        if (ext === '.png') {
          await sharp(srcPath).png({ quality: 80, compressionLevel: 9 }).toFile(destPath);
          await sharp(srcPath).webp({ quality: 80 }).toFile(destPath.replace(/\.png$/i, '.webp'));
          optimizedCount++;
        } else if (ext === '.jpg' || ext === '.jpeg') {
          await sharp(srcPath).jpeg({ quality: 78, mozjpeg: true }).toFile(destPath);
          await sharp(srcPath).webp({ quality: 80 }).toFile(destPath.replace(/\.jpe?g$/i, '.webp'));
          optimizedCount++;
        } else if (ext === '.webp') {
          await sharp(srcPath).webp({ quality: 80 }).toFile(destPath);
          optimizedCount++;
        } else if (ext === '.svg') {
          if (!svgOptimize) {
            ({ optimize: svgOptimize } = await import('svgo'));
          }
          const svgContent = await fs.readFile(srcPath, 'utf8');
          const result = svgOptimize(svgContent, { multipass: true });
          await fs.writeFile(destPath, result.data, 'utf8');
          optimizedCount++;
        } else {
          // Unknown type — copy verbatim
          await fs.copy(srcPath, destPath);
        }
      } catch (err) {
        console.warn(`  ! Failed to optimize ${entry}, copying original:`, err.message);
        await fs.copy(srcPath, destPath);
      }
    }
    console.log(`  ✓ Optimized ${optimizedCount}/${entries.length} image(s)`);
  } else {
    console.log('  (no images/ directory found, skipping)');
  }

  console.log('▶ Copying static assets ...');
  const staticFiles = ['.htaccess'];
  for (const f of staticFiles) {
    const src = path.join(ROOT, f);
    if (await fs.pathExists(src)) {
      await fs.copy(src, path.join(DIST, f));
      console.log(`  ✓ ${f}`);
    }
  }
  // Copy the resume PDF (or any other top-level asset files) verbatim
  const rootEntries = await fs.readdir(ROOT);
  for (const entry of rootEntries) {
    if (entry.toLowerCase().endsWith('.pdf')) {
      await fs.copy(path.join(ROOT, entry), path.join(DIST, entry));
      console.log(`  ✓ ${entry}`);
    }
  }

  console.log('\n✅ Build complete → ./dist');
}

main().catch(err => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});
