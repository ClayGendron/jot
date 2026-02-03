/**
 * Block-level Commands for CodeMirror 6
 *
 * Phase 8: Commands for headings, lists, blockquotes, code blocks,
 * horizontal rules, links, and images.
 *
 * Key design decisions:
 * - Commands operate on the current line (or selection for code blocks)
 * - Toggle behavior: if format is already applied, remove it
 * - Converting between formats (e.g., bullet to ordered) replaces the marker
 */

import { EditorView } from "@codemirror/view";
import { EditorSelection } from "@codemirror/state";

/**
 * Regex patterns for detecting block-level elements
 */
const PATTERNS = {
  // Headings: # to ######
  heading: /^(#{1,6})\s*/,
  // Bullet lists: -, *, +
  bullet: /^[-*+]\s+/,
  // Ordered lists: 1. 2. etc
  ordered: /^\d+\.\s+/,
  // Task lists: - [ ] or - [x] or - [X]
  task: /^[-*+]\s+\[[xX ]\]\s+/,
  // Blockquotes: > or >> etc
  blockquote: /^(>+)\s*/,
  // Code fence start
  codeFenceStart: /^```(\w*)?$/,
  // Code fence end
  codeFenceEnd: /^```$/,
};

/**
 * Get the line content and range at the cursor position
 */
function getLineAtCursor(view: EditorView): {
  text: string;
  from: number;
  to: number;
} {
  const pos = view.state.selection.main.head;
  const line = view.state.doc.lineAt(pos);
  return {
    text: line.text,
    from: line.from,
    to: line.to,
  };
}

/**
 * Remove any block-level prefix from a line
 * Returns the content without the prefix
 */
function stripBlockPrefix(text: string): string {
  // Order matters: check task before bullet (task includes bullet marker)
  if (PATTERNS.task.test(text)) {
    return text.replace(PATTERNS.task, "");
  }
  if (PATTERNS.ordered.test(text)) {
    return text.replace(PATTERNS.ordered, "");
  }
  if (PATTERNS.bullet.test(text)) {
    return text.replace(PATTERNS.bullet, "");
  }
  if (PATTERNS.heading.test(text)) {
    return text.replace(PATTERNS.heading, "");
  }
  if (PATTERNS.blockquote.test(text)) {
    return text.replace(PATTERNS.blockquote, "");
  }
  return text;
}

/**
 * Get the current heading level (1-6) or 0 if not a heading
 */
function getHeadingLevel(text: string): number {
  const match = text.match(PATTERNS.heading);
  return match ? match[1].length : 0;
}

/**
 * Toggle a heading level on the current line
 *
 * - If line is already that heading level, remove it (toggle off)
 * - If line is a different heading level, change to new level
 * - If line is plain text or other block type, convert to heading
 */
export function toggleHeading(
  view: EditorView,
  level: 1 | 2 | 3 | 4 | 5 | 6
): boolean {
  const { text, from, to } = getLineAtCursor(view);
  const currentLevel = getHeadingLevel(text);
  const prefix = "#".repeat(level) + " ";

  let newText: string;

  if (currentLevel === level) {
    // Toggle off: remove heading prefix
    newText = text.replace(PATTERNS.heading, "");
  } else if (currentLevel > 0) {
    // Change heading level
    newText = text.replace(PATTERNS.heading, prefix);
  } else {
    // Convert from other format or plain text
    const content = stripBlockPrefix(text);
    newText = prefix + content;
  }

  view.dispatch({
    changes: { from, to, insert: newText },
  });

  return true;
}

/**
 * Remove any block-level formatting, converting to plain paragraph
 */
export function setParagraph(view: EditorView): boolean {
  const { text, from, to } = getLineAtCursor(view);
  const content = stripBlockPrefix(text);

  if (content !== text) {
    view.dispatch({
      changes: { from, to, insert: content },
    });
  }

  return true;
}

/**
 * Check if line is a bullet list item
 */
function isBulletList(text: string): boolean {
  // Must be bullet but NOT a task list
  return PATTERNS.bullet.test(text) && !PATTERNS.task.test(text);
}

/**
 * Toggle bullet list on the current line
 */
export function toggleBulletList(view: EditorView): boolean {
  const { text, from, to } = getLineAtCursor(view);

  let newText: string;

  if (isBulletList(text)) {
    // Toggle off: remove bullet prefix
    newText = text.replace(PATTERNS.bullet, "");
  } else {
    // Convert from other format or plain text
    const content = stripBlockPrefix(text);
    newText = "- " + content;
  }

  view.dispatch({
    changes: { from, to, insert: newText },
  });

  return true;
}

/**
 * Check if line is an ordered list item
 */
function isOrderedList(text: string): boolean {
  return PATTERNS.ordered.test(text);
}

/**
 * Toggle ordered list on the current line
 */
export function toggleOrderedList(view: EditorView): boolean {
  const { text, from, to } = getLineAtCursor(view);

  let newText: string;

  if (isOrderedList(text)) {
    // Toggle off: remove ordered prefix
    newText = text.replace(PATTERNS.ordered, "");
  } else {
    // Convert from other format or plain text
    const content = stripBlockPrefix(text);
    newText = "1. " + content;
  }

  view.dispatch({
    changes: { from, to, insert: newText },
  });

  return true;
}

/**
 * Check if line is a task list item
 */
function isTaskList(text: string): boolean {
  return PATTERNS.task.test(text);
}

/**
 * Toggle task list on the current line
 */
export function toggleTaskList(view: EditorView): boolean {
  const { text, from, to } = getLineAtCursor(view);

  let newText: string;

  if (isTaskList(text)) {
    // Toggle off: remove task prefix
    newText = text.replace(PATTERNS.task, "");
  } else {
    // Convert from other format or plain text
    const content = stripBlockPrefix(text);
    newText = "- [ ] " + content;
  }

  view.dispatch({
    changes: { from, to, insert: newText },
  });

  return true;
}

/**
 * Check if line is a blockquote
 */
function isBlockquote(text: string): boolean {
  return PATTERNS.blockquote.test(text);
}

/**
 * Toggle blockquote on the current line
 * For nested blockquotes, removes one level of nesting
 */
export function toggleBlockquote(view: EditorView): boolean {
  const { text, from, to } = getLineAtCursor(view);

  let newText: string;

  if (isBlockquote(text)) {
    // Remove one level of blockquote
    const match = text.match(PATTERNS.blockquote);
    if (match && match[1].length > 1) {
      // Nested: remove one >
      newText = text.replace(/^>\s*/, "");
    } else {
      // Single level: remove blockquote completely
      newText = text.replace(PATTERNS.blockquote, "");
    }
  } else {
    // Convert from other format or plain text
    const content = stripBlockPrefix(text);
    newText = "> " + content;
  }

  view.dispatch({
    changes: { from, to, insert: newText },
  });

  return true;
}

/**
 * Check if cursor is inside a code block
 * Returns the code block range if found, null otherwise
 */
function findCodeBlockRange(
  view: EditorView
): { from: number; to: number; content: string } | null {
  const pos = view.state.selection.main.head;
  const doc = view.state.doc;

  // Find the start of the code block by searching backwards
  let startLine = doc.lineAt(pos).number;
  let fenceStartLine = -1;

  for (let i = startLine; i >= 1; i--) {
    const line = doc.line(i);
    if (PATTERNS.codeFenceStart.test(line.text)) {
      fenceStartLine = i;
      break;
    }
    if (PATTERNS.codeFenceEnd.test(line.text) && i !== startLine) {
      // Found an end fence before a start fence - we're not in a code block
      return null;
    }
  }

  if (fenceStartLine === -1) return null;

  // Find the end fence
  let fenceEndLine = -1;
  for (let i = fenceStartLine + 1; i <= doc.lines; i++) {
    const line = doc.line(i);
    if (PATTERNS.codeFenceEnd.test(line.text)) {
      fenceEndLine = i;
      break;
    }
  }

  if (fenceEndLine === -1) return null;

  // Verify cursor is within the code block
  if (startLine < fenceStartLine || startLine > fenceEndLine) return null;

  const fenceStart = doc.line(fenceStartLine);
  const fenceEnd = doc.line(fenceEndLine);

  // Extract content between fences
  const contentLines: string[] = [];
  for (let i = fenceStartLine + 1; i < fenceEndLine; i++) {
    contentLines.push(doc.line(i).text);
  }

  return {
    from: fenceStart.from,
    to: fenceEnd.to,
    content: contentLines.join("\n"),
  };
}

/**
 * Toggle code block
 *
 * - If selection exists, wrap it in code fences
 * - If cursor is inside a code block, remove the fences
 * - Otherwise, insert empty code fences
 */
export function toggleCodeBlock(view: EditorView): boolean {
  const selection = view.state.selection.main;
  const hasSelection = selection.from !== selection.to;

  // Check if we're inside a code block
  const codeBlock = findCodeBlockRange(view);

  if (codeBlock) {
    // Remove code fences, keep content
    view.dispatch({
      changes: { from: codeBlock.from, to: codeBlock.to, insert: codeBlock.content },
    });
    return true;
  }

  if (hasSelection) {
    // Wrap selection in code fences
    const selectedText = view.state.doc.sliceString(selection.from, selection.to);
    const wrapped = "```\n" + selectedText + "\n```";

    view.dispatch({
      changes: { from: selection.from, to: selection.to, insert: wrapped },
    });
    return true;
  }

  // Insert empty code fences at cursor
  const pos = selection.head;
  const line = view.state.doc.lineAt(pos);
  const doc = view.state.doc;

  // Insert after current line if not at start of line
  const insertPos = pos === line.from ? pos : line.to;
  const prefix = pos === line.from ? "" : "\n";

  // Check if there's already a newline after insertPos
  const hasNewlineAfter = insertPos < doc.length && doc.sliceString(insertPos, insertPos + 1) === "\n";
  const suffix = insertPos === doc.length ? "" : (hasNewlineAfter ? "" : "\n");

  view.dispatch({
    changes: {
      from: insertPos,
      to: insertPos,
      insert: prefix + "```\n\n```" + suffix,
    },
    selection: EditorSelection.cursor(insertPos + prefix.length + 4),
  });

  return true;
}

/**
 * Insert a horizontal rule (---)
 */
export function insertHorizontalRule(view: EditorView): boolean {
  const pos = view.state.selection.main.head;
  const line = view.state.doc.lineAt(pos);
  const doc = view.state.doc;

  // Insert after current line with blank lines
  const insertPos = line.to;
  const prefix = line.text.length > 0 ? "\n\n" : "\n";

  // Check if there's already a newline after insertPos
  const hasNewlineAfter = insertPos < doc.length && doc.sliceString(insertPos, insertPos + 1) === "\n";
  const suffix = insertPos === doc.length ? "\n" : (hasNewlineAfter ? "\n" : "\n\n");

  view.dispatch({
    changes: {
      from: insertPos,
      to: insertPos,
      insert: prefix + "---" + suffix,
    },
    selection: EditorSelection.cursor(insertPos + prefix.length + 3 + suffix.length),
  });

  return true;
}

/**
 * Insert a markdown link
 *
 * @param view - The EditorView
 * @param url - The URL (defaults to "url" placeholder)
 * @param text - The link text (uses selection if available, otherwise empty)
 */
export function insertLink(
  view: EditorView,
  url: string = "url",
  text?: string
): boolean {
  const selection = view.state.selection.main;
  const hasSelection = selection.from !== selection.to;

  let linkText = text ?? "";
  if (!text && hasSelection) {
    linkText = view.state.doc.sliceString(selection.from, selection.to);
  }

  const link = `[${linkText}](${url})`;

  view.dispatch({
    changes: { from: selection.from, to: selection.to, insert: link },
  });

  return true;
}

/**
 * Insert a markdown image
 *
 * @param view - The EditorView
 * @param url - The image URL (defaults to "url" placeholder)
 * @param alt - The alt text (defaults to "alt" placeholder if no url provided)
 */
export function insertImage(
  view: EditorView,
  url?: string,
  alt?: string
): boolean {
  const pos = view.state.selection.main.head;

  const imageUrl = url ?? "url";
  const imageAlt = alt ?? (url ? "" : "alt");
  const image = `![${imageAlt}](${imageUrl})`;

  view.dispatch({
    changes: { from: pos, to: pos, insert: image },
  });

  return true;
}
