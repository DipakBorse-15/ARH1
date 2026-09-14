import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "fs";
import { defineConfig, loadEnv, type Plugin } from "vite";

/**
 * Writes a GitHub Pages compatible 404.html fallback into the dist folder.
 * The number of path segments to preserve as the "base" is derived from the
 * configured base path, so project-page deployments (base: "/repo/") and
 * custom-domain / root deployments (base: "/") both work without manual edits.
 */
function githubPagesFallback(base: string): Plugin {
  const segments = base.split("/").filter(Boolean).length;
  return {
    name: "github-pages-404-fallback",
    closeBundle() {
      const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>AARAAH — Redirecting…</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <script>
      (function () {
        var pathSegmentsToKeep = ${segments};
        var l = window.location;
        l.replace(
          l.protocol + '//' + l.hostname + (l.port ? ':' + l.port : '') +
          l.pathname.split('/').slice(0, 1 + pathSegmentsToKeep).join('/') + '/?/' +
          l.pathname.slice(1).split('/').slice(pathSegmentsToKeep).join('/').replace(/&/g, '~and~') +
          (l.search ? '&' + l.search.slice(1).replace(/&/g, '~and~') : '') +
          l.hash
        );
      })();
    </script>
  </head>
  <body>Redirecting…</body>
</html>
`;
      fs.writeFileSync("dist/404.html", html, "utf-8");
    },
  };
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  // VITE_BASE_PATH controls the deployment base path so the same codebase
  // works on: local dev ("/"), GitHub Pages project sites ("/<repo>/"),
  // and a custom domain such as https://aaraah.in/ ("/").
  const base = env.VITE_BASE_PATH || "/";

  return {
    base,
    plugins: [react(), tailwindcss(), githubPagesFallback(base)],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },
    build: {
      outDir: "dist",
      sourcemap: false,
      chunkSizeWarningLimit: 900,
    },
  };
});
