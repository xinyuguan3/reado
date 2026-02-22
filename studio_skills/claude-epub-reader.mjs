import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

function toText(value, fallback = "") {
  const text = typeof value === "string" ? value.trim() : "";
  return text || fallback;
}

export default async function installEpubSkill({ registerSkill, helpers }) {
  const clamp = typeof helpers?.clamp === "function"
    ? helpers.clamp
    : (value, max = 60000) => String(value || "").slice(0, max);

  registerSkill({
    id: "ingest.epub.claude-epub-skill",
    kind: "ingest",
    label: "EPUB Reader (claude-epub-skill)",
    description: "Use claude-epub-skill dependency stack (ebooklib) to read epub content",
    source: "smerchek/claude-epub-skill:markdown-to-epub",
    supports: ({ mimeType, lowerName }) => (
      String(mimeType || "") === "application/epub+zip" || String(lowerName || "").endsWith(".epub")
    ),
    run: async ({ name, buffer }) => {
      const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "reado-epub-skill-"));
      const filePath = path.join(workDir, toText(name, "source.epub"));
      try {
        await fs.writeFile(filePath, buffer);
        const extractor = path.join(process.cwd(), "scripts", "studio-tools", "extract_epub_text.py");
        const row = await execFileAsync("python3", [extractor, filePath], { maxBuffer: 16 * 1024 * 1024 });
        const payload = JSON.parse(toText(row.stdout, "{}"));
        const text = toText(payload?.text);
        if (!payload?.ok || !text) {
          throw new Error("ebooklib extraction failed");
        }
        return { text: clamp(text.replace(/\s+/g, " ").trim(), 60000) };
      } catch (error) {
        throw new Error(
          toText(error?.message, "epub extraction failed")
          + "; install deps: pip3 install -r ~/.codex/skills/markdown-to-epub/requirements.txt"
        );
      } finally {
        await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
      }
    }
  });
}
