/**
 * Transforms the Cloudflare Workers build output (dist/) into Vercel Build Output API v3
 * format (.vercel/output/), so the app can be deployed on Vercel.
 *
 * Run after `vite build`: the build command in Vercel should be `bun run build:vercel`
 */
import { cp, mkdir, writeFile } from "node:fs/promises";

await mkdir(".vercel/output/static", { recursive: true });
await mkdir(".vercel/output/functions/index.func", { recursive: true });

// Static assets → served directly by Vercel CDN
await cp("dist/client", ".vercel/output/static", { recursive: true });

// Server bundle → runs as a Vercel Edge Function
await cp("dist/server", ".vercel/output/functions/index.func", {
  recursive: true,
});

// Thin adapter: Cloudflare Workers export format → Vercel Edge Function format
await writeFile(
  ".vercel/output/functions/index.func/index.js",
  [
    'import server from "./server.js";',
    "export default (req) => server.fetch(req, {}, { waitUntil: () => {} });",
  ].join("\n"),
);

// Tell Vercel this is an Edge Function
await writeFile(
  ".vercel/output/functions/index.func/.vc-config.json",
  JSON.stringify({ runtime: "edge", entrypoint: "index.js" }, null, 2),
);

// Routing: serve static files that exist, everything else → SSR function
await writeFile(
  ".vercel/output/config.json",
  JSON.stringify(
    {
      version: 3,
      routes: [
        { handle: "filesystem" },
        { src: "/(.*)", dest: "/index" },
      ],
    },
    null,
    2,
  ),
);

console.log("✓ .vercel/output/ ready for deployment");
