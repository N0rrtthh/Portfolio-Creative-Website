/* ══════════════════════════════════════════════════════════
   build-cert-previews — renders every certificate to a WebP image
   ──────────────────────────────────────────────────────────
   The credential inspector used to embed pdfhost.io's own viewer in an
   iframe. That viewer renders the page at 100% under ~150px of toolbars,
   so a landscape certificate never fit — visitors had to scroll inside
   the frame to see it — and every open also pulled in pdfhost's ads and
   reCAPTCHA. A pre-rendered image shows the whole certificate instantly.

   Usage (after adding a certificate / variant in Certifications.tsx):
     node scripts/build-cert-previews.mjs          # only missing previews
     node scripts/build-cert-previews.mjs --force  # re-render everything

   Writes public/certs/<variantId>.webp and src/data/certPreviews.json
   ({ variantId: [width, height] }). Needs system Chrome (Playwright
   `channel: "chrome"`) and network access to pdfhost.io.
   ══════════════════════════════════════════════════════════ */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(root, "src/components/sections/Certifications.tsx");
const OUT_DIR = path.join(root, "public/certs");
const MANIFEST = path.join(root, "src/data/certPreviews.json");
const PDFJS = path.join(root, "node_modules/pdfjs-dist/build");
const TARGET_WIDTH = 1600;
const force = process.argv.includes("--force");

// variant id → viewer URL, straight from the component's data block.
const src = fs.readFileSync(SRC, "utf8");
const variants = [...src.matchAll(/id:\s*"(v-[^"]+)",\s*name:\s*"[^"]*",\s*viewWebUrl:\s*"([^"]+)"/g)].map(
  ([, id, url]) => ({ id, url })
);

fs.mkdirSync(OUT_DIR, { recursive: true });
const manifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, "utf8")) : {};
const todo = variants.filter((v) => force || !manifest[v.id] || !fs.existsSync(path.join(OUT_DIR, `${v.id}.webp`)));
console.log(`${variants.length} variants, ${todo.length} to render`);

const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext();

// A tiny fake origin that serves pdf.js, so rendering runs in a real browser.
const RENDER_ORIGIN = "https://render.local";
await ctx.route(`${RENDER_ORIGIN}/**`, (route) => {
  const file = new URL(route.request().url()).pathname.slice(1) || "index.html";
  if (file === "index.html") {
    return route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><script src="/pdf.min.js"></script><script>pdfjsLib.GlobalWorkerOptions.workerSrc="/pdf.worker.min.js";</script>`,
    });
  }
  return route.fulfill({ contentType: "text/javascript", body: fs.readFileSync(path.join(PDFJS, file)) });
});
const renderer = await ctx.newPage();
await renderer.goto(`${RENDER_ORIGIN}/`);

const pdfCache = new Map();
for (const v of todo) {
  try {
    // 1. Find the PDF behind the pdfhost viewer page.
    const viewer = await ctx.newPage();
    const pdfUrl = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("no PDF response")), 30000);
      viewer.on("response", (r) => {
        if ((r.headers()["content-type"] || "").includes("application/pdf")) {
          clearTimeout(timer);
          resolve(r.url());
        }
      });
      viewer.goto(v.url, { waitUntil: "domcontentloaded" }).catch(reject);
    });
    await viewer.close();

    // 2. Download it (Node side — no CORS involved) and render page 1 at
    //    TARGET_WIDTH in the pdf.js page.
    let rendered = pdfCache.get(pdfUrl);
    if (!rendered) {
      // pdfhost rate-limits bursts with 502s — back off and retry.
      let res;
      for (const wait of [0, 4000, 9000, 20000]) {
        if (wait) await new Promise((r) => setTimeout(r, wait));
        // Node's own fetch: Playwright's request client got persistent
        // 502s from pdfhost for some files that plain HTTP serves fine.
        res = await fetch(pdfUrl, { headers: { "User-Agent": "Mozilla/5.0", Referer: v.url } });
        if (res.ok) break;
      }
      if (!res.ok) throw new Error(`PDF ${res.status}`);
      const b64 = Buffer.from(await res.arrayBuffer()).toString("base64");
      rendered = await renderer.evaluate(
        async ({ b64, TARGET_WIDTH }) => {
          const data = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
          const doc = await window.pdfjsLib.getDocument({ data }).promise;
          const page = await doc.getPage(1);
          const base = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: TARGET_WIDTH / base.width });
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(viewport.width);
          canvas.height = Math.round(viewport.height);
          const c = canvas.getContext("2d");
          c.fillStyle = "#fff";
          c.fillRect(0, 0, canvas.width, canvas.height);
          await page.render({ canvasContext: c, viewport }).promise;
          return { dataUrl: canvas.toDataURL("image/webp", 0.86), width: canvas.width, height: canvas.height };
        },
        { b64, TARGET_WIDTH }
      );
      pdfCache.set(pdfUrl, rendered);
    }
    const { dataUrl, width, height } = rendered;

    fs.writeFileSync(path.join(OUT_DIR, `${v.id}.webp`), Buffer.from(dataUrl.split(",")[1], "base64"));
    manifest[v.id] = [width, height];
    console.log(`  ✓ ${v.id} ${width}×${height}`);
    await new Promise((r) => setTimeout(r, 1500)); // stay under the rate limit
  } catch (e) {
    console.warn(`  ✗ ${v.id}: ${e.message}`);
  }
}

// Drop entries for variants that no longer exist.
for (const id of Object.keys(manifest)) if (!variants.some((v) => v.id === id)) delete manifest[id];
const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
fs.writeFileSync(MANIFEST, JSON.stringify(sorted, null, 2) + "\n");
await browser.close();
console.log(`manifest: ${Object.keys(sorted).length} previews`);
