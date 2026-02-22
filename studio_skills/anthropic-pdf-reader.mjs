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

export default async function installPdfSkill({ registerSkill, helpers }) {
  const clamp = typeof helpers?.clamp === "function"
    ? helpers.clamp
    : (value, max = 60000) => String(value || "").slice(0, max);

  registerSkill({
    id: "ingest.pdf.anthropic-skill",
    kind: "ingest",
    label: "PDF Reader (anthropics/skills)",
    description: "Use anthropics pdf skill guidance with pdftotext and pypdf/pdfplumber fallback",
    source: "anthropics/skills:skills/pdf",
    supports: ({ mimeType, lowerName }) => (
      String(mimeType || "") === "application/pdf" || String(lowerName || "").endsWith(".pdf")
    ),
    run: async ({ name, buffer }) => {
      const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "reado-pdf-skill-"));
      const filePath = path.join(workDir, toText(name, "source.pdf"));
      try {
        await fs.writeFile(filePath, buffer);

        let text = "";

        try {
          const row = await execFileAsync("pdftotext", ["-layout", filePath, "-"], { maxBuffer: 16 * 1024 * 1024 });
          text = toText(row.stdout);
        } catch {
          text = "";
        }

        if (!text) {
          const extractor = path.join(process.cwd(), "scripts", "studio-tools", "extract_pdf_text.py");
          const row = await execFileAsync("python3", [extractor, filePath], { maxBuffer: 16 * 1024 * 1024 });
          const payload = JSON.parse(toText(row.stdout, "{}"));
          if (payload?.ok && payload?.text) {
            text = String(payload.text);
          }
        }

        const normalized = clamp(text.replace(/\s+/g, " ").trim(), 60000);
        if (!normalized) {
          throw new Error(
            "PDF skill extracted empty text. Install poppler(pdftotext) or python deps from ~/.codex/skills/pdf/SKILL.md"
          );
        }

        return { text: normalized };
      } finally {
        await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
      }
    }
  });
}
