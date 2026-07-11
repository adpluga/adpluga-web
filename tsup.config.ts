import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { index: "src/index.ts" },
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    clean: true,
    target: "es2020",
    treeshake: true,
    minify: false,
    splitting: false,
  },
  {
    entry: { element: "src/element-entry.ts" },
    format: ["esm", "cjs", "iife"],
    globalName: "AdPluga",
    dts: true,
    sourcemap: true,
    clean: false,
    target: "es2020",
    treeshake: true,
    minify: true,
    splitting: false,
    outExtension({ format }) {
      if (format === "iife") return { js: ".global.js" };
      if (format === "cjs") return { js: ".cjs" };
      return { js: ".js" };
    },
  },
]);
