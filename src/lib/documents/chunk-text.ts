// Deterministic chunking with provenance preserved on every chunk (page
// where the source format has pages, section where it has headings). Pure
// TypeScript, no I/O — see CLAUDE.md "prefer a testable deterministic
// utility before adding another agent/model call."
import type { ExtractedPage } from "./extract-text";

export interface TextChunk {
  chunkIndex: number;
  pageNumber: number | null;
  section: string | null;
  content: string;
}

const TARGET_CHUNK_CHARS = 1000;
const HEADING_PATTERN = /^(#{1,6})\s+(.+)$/;

export interface ChunkOptions {
  /** Track Markdown headings (`#`..`######`) as the running "section" for
   * every chunk that follows them, until the next heading. */
  markdown?: boolean;
}

export function chunkDocumentPages(
  pages: readonly ExtractedPage[],
  options: ChunkOptions = {},
): TextChunk[] {
  const chunks: TextChunk[] = [];
  let currentSection: string | null = null;

  for (const page of pages) {
    let buffer = "";
    const flush = () => {
      if (buffer.trim()) {
        chunks.push({
          chunkIndex: chunks.length,
          pageNumber: page.pageNumber,
          section: currentSection,
          content: buffer.trim(),
        });
      }
      buffer = "";
    };

    for (const paragraph of splitIntoParagraphs(page.text)) {
      let remainder = paragraph;

      if (options.markdown) {
        const lines = paragraph.split("\n");
        const headingMatch = HEADING_PATTERN.exec(lines[0].trim());
        if (headingMatch) {
          flush();
          currentSection = headingMatch[2].trim();
          remainder = lines.slice(1).join("\n").trim();
          if (!remainder) continue;
        }
      }

      const candidate = buffer ? `${buffer}\n\n${remainder}` : remainder;
      if (candidate.length > TARGET_CHUNK_CHARS && buffer) {
        flush();
        buffer = remainder;
      } else {
        buffer = candidate;
      }
    }

    flush();
  }

  return chunks;
}

function splitIntoParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}
