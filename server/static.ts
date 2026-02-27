import express, { type Express } from "express";
import fs from "fs";
import path from "path";

// Works in both ESM (import.meta.url) and CJS (global __dirname)
const _dirname: string =
  typeof __dirname !== "undefined"
    ? __dirname
    : path.dirname(new URL((import.meta as any).url).pathname);

export function serveStatic(app: Express) {
  const distPath = path.resolve(_dirname, "..", "dist", "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath, { dotfiles: "allow" }));

  // fall through to index.html if the file doesn't exist
  app.use("/{*path}", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
