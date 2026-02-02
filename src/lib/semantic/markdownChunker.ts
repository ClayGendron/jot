/**
 * Markdown-Aware Recursive Text Chunker
 *
 * Splits markdown documents into semantically meaningful chunks
 * suitable for embedding. Uses a recursive character text splitting
 * approach inspired by LangChain, respecting markdown structure.
 */

import type { DocumentChunk } from "./types";

/**
 * Markdown separators in order of preference.
 * We try each separator in order until one successfully splits the text.
 */
const MARKDOWN_SEPARATORS = [
  // Headings (# to ######)
  /\n(?=#{1,6} )/,
  // End of fenced code blocks
  /```\n/,
  // Horizontal rules
  /\n\*\*\*+\n/,
  /\n---+\n/,
  /\n___+\n/,
  // Paragraphs (double newline)
  /\n\n/,
  // Single newlines
  /\n/,
  // Words (spaces)
  / /,
];

/**
 * Configuration for chunking
 */
interface ChunkConfig {
  /** Target chunk size in characters (roughly 4 chars per token) */
  chunkSize: number;
  /** Overlap between consecutive chunks in characters */
  chunkOverlap: number;
}

/**
 * Default chunking configuration
 * ~256 tokens = ~1024 chars, ~50 token overlap = ~200 chars
 */
const DEFAULT_CONFIG: ChunkConfig = {
  chunkSize: 1024,
  chunkOverlap: 200,
};

/**
 * Internal chunk representation during processing
 */
interface TextSegment {
  text: string;
  startOffset: number;
}

/**
 * Estimates the number of tokens in a text string.
 * Uses a rough approximation of ~4 characters per token.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Split text by a separator regex, preserving the separator at the start
 * of each segment (except the first).
 */
function splitBySeparator(
  text: string,
  separator: RegExp
): { parts: string[]; success: boolean } {
  const parts = text.split(separator);

  // If we didn't split at all (only 1 part), this separator failed
  if (parts.length <= 1) {
    return { parts: [text], success: false };
  }

  return { parts, success: true };
}

/**
 * Recursively split text into chunks using markdown-aware separators.
 */
function recursiveSplit(
  text: string,
  offset: number,
  separatorIndex: number,
  config: ChunkConfig
): TextSegment[] {
  // If text fits in one chunk, return it
  if (text.length <= config.chunkSize) {
    return [{ text, startOffset: offset }];
  }

  // If we've exhausted all separators, do hard split by size
  if (separatorIndex >= MARKDOWN_SEPARATORS.length) {
    return splitBySize(text, offset, config);
  }

  const separator = MARKDOWN_SEPARATORS[separatorIndex];
  const { parts, success } = splitBySeparator(text, separator);

  // If this separator didn't work, try the next one
  if (!success) {
    return recursiveSplit(text, offset, separatorIndex + 1, config);
  }

  // Successfully split - now merge small parts and recursively handle large ones
  const segments: TextSegment[] = [];
  let currentOffset = offset;
  let accumulated = "";
  let accumulatedOffset = offset;

  for (const part of parts) {
    // Skip empty parts
    if (!part) {
      continue;
    }

    // If adding this part would exceed chunk size
    if (accumulated.length + part.length > config.chunkSize) {
      // Save accumulated if non-empty
      if (accumulated) {
        // If accumulated is still too large, recursively split it
        if (accumulated.length > config.chunkSize) {
          segments.push(
            ...recursiveSplit(
              accumulated,
              accumulatedOffset,
              separatorIndex + 1,
              config
            )
          );
        } else {
          segments.push({ text: accumulated, startOffset: accumulatedOffset });
        }
      }

      // Start new accumulation with this part
      accumulated = part;
      accumulatedOffset = currentOffset;
    } else {
      // Add to accumulated
      if (!accumulated) {
        accumulatedOffset = currentOffset;
      }
      accumulated += part;
    }

    currentOffset += part.length;
  }

  // Handle remaining accumulated text
  if (accumulated) {
    if (accumulated.length > config.chunkSize) {
      segments.push(
        ...recursiveSplit(
          accumulated,
          accumulatedOffset,
          separatorIndex + 1,
          config
        )
      );
    } else {
      segments.push({ text: accumulated, startOffset: accumulatedOffset });
    }
  }

  return segments;
}

/**
 * Hard split by size when no separators work.
 * This is a fallback for very long continuous text.
 */
function splitBySize(
  text: string,
  offset: number,
  config: ChunkConfig
): TextSegment[] {
  const segments: TextSegment[] = [];
  let pos = 0;

  while (pos < text.length) {
    const endPos = Math.min(pos + config.chunkSize, text.length);
    segments.push({
      text: text.slice(pos, endPos),
      startOffset: offset + pos,
    });
    pos = endPos;
  }

  return segments;
}

/**
 * Add overlap between consecutive chunks.
 * Takes content from the end of each chunk and prepends it to the next.
 */
function addOverlap(
  segments: TextSegment[],
  config: ChunkConfig
): TextSegment[] {
  if (segments.length <= 1 || config.chunkOverlap <= 0) {
    return segments;
  }

  const result: TextSegment[] = [];

  for (let i = 0; i < segments.length; i++) {
    if (i === 0) {
      // First chunk has no overlap from previous
      result.push(segments[i]);
    } else {
      // Get overlap from previous chunk
      const prevChunk = segments[i - 1].text;
      const overlapStart = Math.max(0, prevChunk.length - config.chunkOverlap);
      const overlap = prevChunk.slice(overlapStart);

      // Find a good break point (word boundary)
      const breakMatch = overlap.match(/\s/);
      const breakPos = breakMatch?.index ?? 0;
      const cleanOverlap = overlap.slice(breakPos).trimStart();

      if (cleanOverlap) {
        result.push({
          text: cleanOverlap + segments[i].text,
          // Adjust offset to account for overlap
          startOffset:
            segments[i].startOffset - (overlap.length - breakPos),
        });
      } else {
        result.push(segments[i]);
      }
    }
  }

  return result;
}

/**
 * Clean up chunk text (trim whitespace, normalize line endings)
 */
function cleanChunkText(text: string): string {
  return text
    .replace(/\r\n/g, "\n") // Normalize line endings
    .trim();
}

/**
 * Chunk a markdown document into semantically meaningful pieces.
 *
 * @param markdown - The markdown content to chunk
 * @param filePath - The path of the source file
 * @param config - Optional chunking configuration
 * @returns Array of document chunks with position information
 */
export function chunkMarkdown(
  markdown: string,
  filePath: string,
  config: ChunkConfig = DEFAULT_CONFIG
): DocumentChunk[] {
  // Normalize line endings
  const normalizedMarkdown = markdown.replace(/\r\n/g, "\n");

  // Handle empty or very short documents
  if (!normalizedMarkdown.trim()) {
    return [];
  }

  if (normalizedMarkdown.length <= config.chunkSize) {
    return [
      {
        filePath,
        chunkIndex: 0,
        text: cleanChunkText(normalizedMarkdown),
        startOffset: 0,
        endOffset: normalizedMarkdown.length,
      },
    ];
  }

  // Recursively split the document
  const segments = recursiveSplit(normalizedMarkdown, 0, 0, config);

  // Add overlap between chunks
  const overlappedSegments = addOverlap(segments, config);

  // Convert to DocumentChunk format
  return overlappedSegments
    .map((segment, index) => ({
      filePath,
      chunkIndex: index,
      text: cleanChunkText(segment.text),
      startOffset: segment.startOffset,
      endOffset: segment.startOffset + segment.text.length,
    }))
    .filter((chunk) => chunk.text.length > 0); // Remove empty chunks
}

/**
 * Compute a content hash for change detection.
 * Uses a simple string hash for efficiency.
 */
export function computeContentHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}
