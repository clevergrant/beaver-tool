/**
 * Frontend build script — replaces `vite build`.
 *
 * Uses Bun.build() with the SCSS plugin to bundle
 * the frontend from src/public/index.html into dist/public/.
 */

import type { BunPlugin } from "bun";
import * as sass from "sass";
import { rmSync } from "fs";

const scssPlugin: BunPlugin = {
  name: "scss-loader",
  setup(build) {
    build.onLoad({ filter: /\.scss$/ }, async (args) => {
      const result = sass.compile(args.path);
      return {
        contents: `export default ${JSON.stringify(result.css)};`,
        loader: "js",
      };
    });
  },
};

// Clean output directory
rmSync("dist/public", { recursive: true, force: true });

const result = await Bun.build({
  entrypoints: ["src/public/index.html"],
  outdir: "dist/public",
  minify: true,
  plugins: [scssPlugin],
});

if (!result.success) {
  console.error("Build failed:");
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}

console.log(
  `Frontend built: ${result.outputs.length} files to dist/public/`,
);
