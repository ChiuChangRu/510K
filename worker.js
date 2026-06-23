/**
 * FDA 510(k) PDF Proxy — Cloudflare Worker
 *
 * Deploy steps:
 *   1. https://dash.cloudflare.com → Workers & Pages → Create Worker
 *   2. Paste this entire file, deploy
 *   3. Copy the worker URL (e.g. https://fda-proxy.yourname.workers.dev)
 *   4. Paste it into index.html as PROXY_BASE
 *
 * Usage:
 *   GET /pdf?k=K241234          → returns PDF bytes (application/pdf)
 *   GET /health                 → returns {"ok":true}
 */

const ALLOWED_ORIGIN_PATTERN = /^https:\/\/([a-z0-9-]+)\.github\.io$/;
const FDA_PDF_BASE = "https://www.accessdata.fda.gov/cdrh_docs/pdf";

function corsHeaders(origin) {
  const allowed =
    origin === "http://localhost:8080" ||
    origin === "http://127.0.0.1:5500" ||
    ALLOWED_ORIGIN_PATTERN.test(origin);
  return {
    "Access-Control-Allow-Origin": allowed ? origin : "null",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

function kToPdfUrl(knum) {
  // K241234 → /pdf24/K241234.pdf
  // K031234 → /pdf3/K031234.pdf  (strip leading zero)
  const raw = knum.substring(1, 3); // "24" or "03"
  const folder = raw.replace(/^0/, ""); // "24" or "3"
  return `${FDA_PDF_BASE}${folder}/${knum}.pdf`;
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (url.pathname === "/pdf") {
      const knum = (url.searchParams.get("k") || "").toUpperCase().trim();
      if (!/^K\d{6}$/.test(knum)) {
        return new Response(
          JSON.stringify({ error: "Invalid K-number format. Expected K######" }),
          { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
        );
      }

      const pdfUrl = kToPdfUrl(knum);

      try {
        const upstream = await fetch(pdfUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (compatible; FDA510kExplorer/1.0; research tool)",
          },
          cf: { cacheTtl: 3600, cacheEverything: true },
        });

        if (!upstream.ok) {
          // Some older K-numbers use a slightly different path — try alternate
          const altUrl = `${FDA_PDF_BASE}${knum.substring(1, 3)}/${knum}.pdf`;
          const alt = await fetch(altUrl, {
            headers: { "User-Agent": "Mozilla/5.0 (compatible; FDA510kExplorer/1.0)" },
            cf: { cacheTtl: 3600, cacheEverything: true },
          });
          if (!alt.ok) {
            return new Response(
              JSON.stringify({ error: `PDF not found (${upstream.status})`, url: pdfUrl }),
              { status: 404, headers: { ...cors, "Content-Type": "application/json" } }
            );
          }
          const bytes = await alt.arrayBuffer();
          return new Response(bytes, {
            headers: {
              ...cors,
              "Content-Type": "application/pdf",
              "Cache-Control": "public, max-age=3600",
            },
          });
        }

        const bytes = await upstream.arrayBuffer();
        return new Response(bytes, {
          headers: {
            ...cors,
            "Content-Type": "application/pdf",
            "Cache-Control": "public, max-age=3600",
          },
        });
      } catch (err) {
        return new Response(
          JSON.stringify({ error: err.message }),
          { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response("Not found", { status: 404, headers: cors });
  },
};
