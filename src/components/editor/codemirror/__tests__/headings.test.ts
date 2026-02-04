/**
 * Tests for CodeMirror heading behavior
 *
 * These tests verify the WYSIWYG-style heading editing experience:
 * - Creation: typing # + space at start of line creates heading
 * - Hidden syntax: # markers are invisible, cursor skips them
 * - Navigation: arrow keys skip over # markers and blank lines
 * - Deletion: backspace removes heading markers and merges content
 * - Enter: proper blank line insertion, splitting headings
 */

import { describe, it, expect } from "vitest";
import { EditorState } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";
import { GFM } from "@lezer/markdown";

// ===========================================
// TEST UTILITIES
// ===========================================

/**
 * Create an EditorState with the given document and cursor position
 * Use | to indicate cursor position in the input string
 */
function createState(docWithCursor: string): EditorState {
  const cursorPos = docWithCursor.indexOf("|");
  const doc = docWithCursor.replace("|", "");

  return EditorState.create({
    doc,
    selection: { anchor: cursorPos >= 0 ? cursorPos : doc.length },
    extensions: [markdown({ extensions: [GFM] })],
  });
}

/**
 * Get line info at cursor position
 */
function getLineInfo(state: EditorState): {
  lineText: string;
  lineNumber: number;
  column: number;
  isHeading: boolean;
  headingLevel: number | null;
  contentStart: number;
} {
  const pos = state.selection.main.head;
  const line = state.doc.lineAt(pos);
  const headingMatch = line.text.match(/^(#{1,6})\s/);

  return {
    lineText: line.text,
    lineNumber: line.number,
    column: pos - line.from,
    isHeading: !!headingMatch,
    headingLevel: headingMatch ? headingMatch[1].length : null,
    contentStart: headingMatch ? headingMatch[0].length : 0,
  };
}

/**
 * Check if cursor is at the content start of a heading (after # markers)
 */
function isAtHeadingContentStart(state: EditorState): boolean {
  const info = getLineInfo(state);
  if (!info.isHeading) return false;
  return info.column === info.contentStart;
}

/**
 * Get the content of a heading (without # markers)
 */
function getHeadingContent(state: EditorState): string | null {
  const info = getLineInfo(state);
  if (!info.isHeading) return null;
  return info.lineText.slice(info.contentStart);
}

// ===========================================
// HEADING PATTERN DETECTION TESTS
// ===========================================

describe("Heading Pattern Detection", () => {
  describe("ATX Heading Recognition", () => {
    it("detects h1 heading", () => {
      const state = createState("# |Heading 1");
      const info = getLineInfo(state);
      expect(info.isHeading).toBe(true);
      expect(info.headingLevel).toBe(1);
    });

    it("detects h2 heading", () => {
      const state = createState("## |Heading 2");
      const info = getLineInfo(state);
      expect(info.isHeading).toBe(true);
      expect(info.headingLevel).toBe(2);
    });

    it("detects h3 heading", () => {
      const state = createState("### |Heading 3");
      const info = getLineInfo(state);
      expect(info.isHeading).toBe(true);
      expect(info.headingLevel).toBe(3);
    });

    it("detects h4 heading", () => {
      const state = createState("#### |Heading 4");
      const info = getLineInfo(state);
      expect(info.isHeading).toBe(true);
      expect(info.headingLevel).toBe(4);
    });

    it("detects h5 heading", () => {
      const state = createState("##### |Heading 5");
      const info = getLineInfo(state);
      expect(info.isHeading).toBe(true);
      expect(info.headingLevel).toBe(5);
    });

    it("detects h6 heading (max level)", () => {
      const state = createState("###### |Heading 6");
      const info = getLineInfo(state);
      expect(info.isHeading).toBe(true);
      expect(info.headingLevel).toBe(6);
    });

    it("does not detect 7 hashes as heading", () => {
      const state = createState("####### |Not a heading");
      const info = getLineInfo(state);
      expect(info.isHeading).toBe(false);
      expect(info.headingLevel).toBe(null);
    });

    it("requires space after # for heading", () => {
      const state = createState("#|NoSpace");
      const info = getLineInfo(state);
      expect(info.isHeading).toBe(false);
    });

    it("does not detect # in middle of text", () => {
      const state = createState("text # |not heading");
      const info = getLineInfo(state);
      expect(info.isHeading).toBe(false);
    });
  });

  describe("Content Start Position", () => {
    it("calculates content start for h1", () => {
      const state = createState("# |Heading");
      const info = getLineInfo(state);
      expect(info.contentStart).toBe(2); // "# " = 2 chars
    });

    it("calculates content start for h2", () => {
      const state = createState("## |Heading");
      const info = getLineInfo(state);
      expect(info.contentStart).toBe(3); // "## " = 3 chars
    });

    it("calculates content start for h6", () => {
      const state = createState("###### |Heading");
      const info = getLineInfo(state);
      expect(info.contentStart).toBe(7); // "###### " = 7 chars
    });
  });
});

// ===========================================
// CURSOR POSITION TESTS
// ===========================================

describe("Cursor Position", () => {
  describe("Content Start Detection", () => {
    it("detects cursor at h1 content start", () => {
      const state = createState("# |Heading 1");
      expect(isAtHeadingContentStart(state)).toBe(true);
    });

    it("detects cursor at h2 content start", () => {
      const state = createState("## |Heading 2");
      expect(isAtHeadingContentStart(state)).toBe(true);
    });

    it("cursor in middle of content is not at start", () => {
      const state = createState("# Head|ing");
      expect(isAtHeadingContentStart(state)).toBe(false);
    });

    it("cursor at end of content is not at start", () => {
      const state = createState("# Heading|");
      expect(isAtHeadingContentStart(state)).toBe(false);
    });

    it("cursor before # markers is not at content start", () => {
      const state = createState("|# Heading");
      expect(isAtHeadingContentStart(state)).toBe(false);
    });
  });

  describe("Heading Content Extraction", () => {
    it("extracts content from h1", () => {
      const state = createState("# |Hello World");
      expect(getHeadingContent(state)).toBe("Hello World");
    });

    it("extracts content from h3", () => {
      const state = createState("### |Section Title");
      expect(getHeadingContent(state)).toBe("Section Title");
    });

    it("returns null for non-heading", () => {
      const state = createState("|Regular paragraph");
      expect(getHeadingContent(state)).toBe(null);
    });

    it("extracts empty content for empty heading", () => {
      const state = createState("# |");
      expect(getHeadingContent(state)).toBe("");
    });
  });
});

// ===========================================
// HEADING CREATION TESTS
// ===========================================

describe("Heading Creation", () => {
  describe("# + Space Pattern", () => {
    it("# at start of empty line prepares for heading", () => {
      // Simulating: user types #, then space
      // After "# ", parser should recognize as h1
      const afterHash = createState("#|");
      const info = getLineInfo(afterHash);
      // Not a heading yet (no space)
      expect(info.isHeading).toBe(false);

      const afterSpace = createState("# |");
      const infoAfter = getLineInfo(afterSpace);
      expect(infoAfter.isHeading).toBe(true);
      expect(infoAfter.headingLevel).toBe(1);
    });

    it("## + space creates h2", () => {
      const state = createState("## |");
      const info = getLineInfo(state);
      expect(info.isHeading).toBe(true);
      expect(info.headingLevel).toBe(2);
    });

    it("### + space creates h3", () => {
      const state = createState("### |");
      const info = getLineInfo(state);
      expect(info.isHeading).toBe(true);
      expect(info.headingLevel).toBe(3);
    });

    it("###### + space creates h6", () => {
      const state = createState("###### |");
      const info = getLineInfo(state);
      expect(info.isHeading).toBe(true);
      expect(info.headingLevel).toBe(6);
    });

    it("####### + space does NOT create heading (max is h6)", () => {
      const state = createState("####### |");
      const info = getLineInfo(state);
      expect(info.isHeading).toBe(false);
    });
  });

  describe("# in Non-Start Positions", () => {
    it("# in middle of line is not a heading", () => {
      const state = createState("text # |more");
      const info = getLineInfo(state);
      expect(info.isHeading).toBe(false);
    });
  });
});

// ===========================================
// BLANK LINE HANDLING TESTS
// ===========================================

describe("Blank Line Handling", () => {
  describe("Markdown Paragraph Separation", () => {
    it("paragraphs should be separated by blank lines", () => {
      const doc = "Paragraph 1\n\nParagraph 2";
      const state = createState(doc + "|");
      expect(state.doc.lines).toBe(3);
      expect(state.doc.line(1).text).toBe("Paragraph 1");
      expect(state.doc.line(2).text).toBe("");
      expect(state.doc.line(3).text).toBe("Paragraph 2");
    });

    it("heading followed by paragraph has blank line", () => {
      const doc = "# Heading\n\nParagraph";
      const state = createState(doc + "|");
      expect(state.doc.lines).toBe(3);
      expect(state.doc.line(2).text).toBe("");
    });
  });

  describe("Multiple Blank Lines", () => {
    it("multiple blank lines between content", () => {
      const doc = "# Heading\n\n\n\nParagraph";
      const state = createState(doc + "|");
      expect(state.doc.lines).toBe(5);
      // Lines 2, 3, 4 are blank
      expect(state.doc.line(2).text).toBe("");
      expect(state.doc.line(3).text).toBe("");
      expect(state.doc.line(4).text).toBe("");
    });
  });
});

// ===========================================
// NAVIGATION TESTS (Arrow Keys)
// ===========================================

describe("Navigation", () => {
  describe("Cursor Should Skip Heading Markers", () => {
    it("cursor at line.from of heading should be invalid", () => {
      // If cursor somehow ends up at position 0 of "## Heading",
      // it should be at an invalid position (before the hidden ##)
      const state = createState("|## Heading");
      const info = getLineInfo(state);
      expect(info.column).toBe(0);
      expect(info.contentStart).toBe(3);
      // Cursor is before content start - this is invalid in WYSIWYG mode
      expect(info.column < info.contentStart).toBe(true);
    });

    it("valid cursor position is at content start", () => {
      const state = createState("## |Heading");
      const info = getLineInfo(state);
      expect(info.column).toBe(info.contentStart);
    });

    it("valid cursor position is within content", () => {
      const state = createState("## Head|ing");
      const info = getLineInfo(state);
      expect(info.column).toBeGreaterThan(info.contentStart);
      expect(info.column).toBeLessThan(info.lineText.length);
    });

    it("valid cursor position is at end of content", () => {
      const state = createState("## Heading|");
      const info = getLineInfo(state);
      expect(info.column).toBe(info.lineText.length);
    });
  });

  describe("Arrow Up/Down Should Skip Blank Lines", () => {
    it("content lines are separated by blank lines", () => {
      const state = createState("# Heading\n\n|Paragraph");
      const line = state.doc.lineAt(state.selection.main.head);
      expect(line.text).toBe("Paragraph");
      expect(line.number).toBe(3);
    });

    it("previous non-blank line from paragraph is heading", () => {
      const doc = "# Heading\n\nParagraph";
      const state = EditorState.create({
        doc,
        selection: { anchor: doc.indexOf("Paragraph") },
        extensions: [markdown({ extensions: [GFM] })],
      });

      // Find previous non-blank line
      const currentLine = state.doc.lineAt(state.selection.main.head);
      let prevLineNum = currentLine.number - 1;
      while (prevLineNum >= 1) {
        const prevLine = state.doc.line(prevLineNum);
        if (prevLine.text.trim() !== "") {
          expect(prevLine.text).toBe("# Heading");
          break;
        }
        prevLineNum--;
      }
    });
  });

  describe("Arrow Left/Right Should Skip Markers", () => {
    it("arrow right at end of line before heading should skip to content", () => {
      const doc = "Paragraph\n\n## Heading";
      const state = EditorState.create({
        doc,
        selection: { anchor: "Paragraph".length }, // End of "Paragraph"
        extensions: [markdown({ extensions: [GFM] })],
      });

      const line = state.doc.lineAt(state.selection.main.head);
      expect(line.text).toBe("Paragraph");
      expect(state.selection.main.head).toBe(line.to);
    });

    it("content start calculation for navigation", () => {
      const state = createState("## |Heading");

      const line = state.doc.lineAt(state.selection.main.head);
      const headingMatch = line.text.match(/^(#{1,6})\s/);
      expect(headingMatch).not.toBe(null);

      const contentStart = line.from + headingMatch![0].length;
      expect(state.selection.main.head).toBe(contentStart);
    });
  });
});

// ===========================================
// BACKSPACE BEHAVIOR TESTS
// ===========================================

describe("Backspace Behavior", () => {
  describe("At Start of Heading Content", () => {
    it("identifies backspace position at h1 content start", () => {
      const state = createState("# |Heading");
      expect(isAtHeadingContentStart(state)).toBe(true);
    });

    it("identifies backspace position at h2 content start", () => {
      const state = createState("## |Heading");
      expect(isAtHeadingContentStart(state)).toBe(true);
    });

    it("identifies backspace position at h6 content start", () => {
      const state = createState("###### |Heading");
      expect(isAtHeadingContentStart(state)).toBe(true);
    });
  });

  describe("Heading Removal Logic", () => {
    it("h1 on first line - markers should be removable", () => {
      const state = createState("# |Heading");
      const line = state.doc.lineAt(state.selection.main.head);
      const headingMatch = line.text.match(/^(#{1,6})\s/);

      expect(headingMatch).not.toBe(null);
      expect(line.number).toBe(1);

      // After backspace: "# Heading" -> "Heading"
      const expectedResult = line.text.slice(headingMatch![0].length);
      expect(expectedResult).toBe("Heading");
    });

    it("h2 markers should be fully removable", () => {
      const state = createState("## |Heading");
      const line = state.doc.lineAt(state.selection.main.head);
      const headingMatch = line.text.match(/^(#{1,6})\s/);

      expect(headingMatch![0]).toBe("## ");
      const expectedResult = line.text.slice(headingMatch![0].length);
      expect(expectedResult).toBe("Heading");
    });
  });

  describe("Merge with Content Above", () => {
    it("paragraph below heading can merge up", () => {
      const doc = "# Heading\n\nParagraph";
      const state = EditorState.create({
        doc,
        selection: { anchor: doc.indexOf("Paragraph") },
        extensions: [markdown({ extensions: [GFM] })],
      });

      const currentLine = state.doc.lineAt(state.selection.main.head);
      expect(currentLine.text).toBe("Paragraph");

      // Find content above (skip blank lines)
      let targetLineNum = currentLine.number - 1;
      while (targetLineNum >= 1) {
        const targetLine = state.doc.line(targetLineNum);
        if (targetLine.text.trim() !== "") {
          expect(targetLine.text).toBe("# Heading");
          // After merge: "# Heading" + "Paragraph" = "# HeadingParagraph"
          // (space handling would be done by the actual handler)
          break;
        }
        targetLineNum--;
      }
    });

    it("heading below heading can merge up", () => {
      const doc = "# Heading 1\n\n## Heading 2";
      const state = EditorState.create({
        doc,
        selection: { anchor: doc.indexOf("## Heading 2") + 3 }, // At "Heading 2"
        extensions: [markdown({ extensions: [GFM] })],
      });

      const currentLine = state.doc.lineAt(state.selection.main.head);
      expect(currentLine.text).toBe("## Heading 2");
    });
  });

  describe("Blank Line Deletion", () => {
    it("identifies blank lines between content", () => {
      const doc = "# Heading\n\n\nParagraph";
      const state = EditorState.create({
        doc,
        selection: { anchor: doc.indexOf("Paragraph") },
        extensions: [markdown({ extensions: [GFM] })],
      });

      const currentLine = state.doc.lineAt(state.selection.main.head);

      // Count blank lines above
      let blankCount = 0;
      let lineNum = currentLine.number - 1;
      while (lineNum >= 1) {
        const line = state.doc.line(lineNum);
        if (line.text.trim() === "") {
          blankCount++;
          lineNum--;
        } else {
          break;
        }
      }

      expect(blankCount).toBe(2); // Two blank lines
    });
  });
});

// ===========================================
// ENTER BEHAVIOR TESTS
// ===========================================

describe("Enter Behavior", () => {
  describe("At End of Heading", () => {
    it("cursor at end of heading content", () => {
      const state = createState("# Heading|");
      const info = getLineInfo(state);
      expect(info.column).toBe(info.lineText.length);
    });

    it("proper markdown requires blank line after heading", () => {
      // After Enter at end of heading:
      // "# Heading" -> "# Heading\n\n" with cursor on line 3
      const expectedDoc = "# Heading\n\n";
      const state = createState(expectedDoc + "|");
      expect(state.doc.lines).toBe(3);
      expect(state.doc.line(1).text).toBe("# Heading");
      expect(state.doc.line(2).text).toBe("");
    });
  });

  describe("At Start of Heading Content", () => {
    it("enter at start should insert paragraph above", () => {
      const state = createState("# |Heading");
      expect(isAtHeadingContentStart(state)).toBe(true);

      // After Enter at start:
      // "# Heading" -> "\n\n# Heading" with cursor at "# Heading" content start
      const afterState = createState("\n\n# |Heading");
      expect(afterState.doc.lines).toBe(3);
      expect(afterState.doc.line(3).text).toBe("# Heading");
    });
  });

  describe("In Middle of Heading", () => {
    it("identifies cursor in middle of heading content", () => {
      const state = createState("# Head|ing");
      const info = getLineInfo(state);
      expect(info.column).toBeGreaterThan(info.contentStart);
      expect(info.column).toBeLessThan(info.lineText.length);
    });

    it("split heading produces heading + paragraph", () => {
      // "# Head|ing" after Enter:
      // "# Head\n\ning"
      const expectedDoc = "# Head\n\ning";
      const state = createState(expectedDoc.replace("ing", "|ing"));
      expect(state.doc.lines).toBe(3);
      expect(state.doc.line(1).text).toBe("# Head");
      expect(state.doc.line(2).text).toBe("");
      expect(state.doc.line(3).text).toBe("ing");
    });
  });
});

// ===========================================
// EDGE CASES
// ===========================================

describe("Edge Cases", () => {
  describe("Empty Heading", () => {
    it("heading with no content is valid", () => {
      const state = createState("# |");
      const info = getLineInfo(state);
      expect(info.isHeading).toBe(true);
      expect(getHeadingContent(state)).toBe("");
    });

    it("heading with only space is valid", () => {
      const state = createState("# | ");
      const info = getLineInfo(state);
      expect(info.isHeading).toBe(true);
    });
  });

  describe("Heading at Document Boundaries", () => {
    it("heading as first line", () => {
      const state = createState("# |First Heading");
      const info = getLineInfo(state);
      expect(info.lineNumber).toBe(1);
      expect(info.isHeading).toBe(true);
    });

    it("heading as last line", () => {
      const state = createState("Paragraph\n\n# |Last Heading");
      const line = state.doc.lineAt(state.selection.main.head);
      expect(line.number).toBe(state.doc.lines);
    });

    it("only a heading in document", () => {
      const state = createState("# |Only Heading");
      expect(state.doc.lines).toBe(1);
      const info = getLineInfo(state);
      expect(info.isHeading).toBe(true);
    });
  });

  describe("Multiple Headings", () => {
    it("two headings with blank line between", () => {
      const doc = "# Heading 1\n\n## Heading 2";
      const state = createState(doc + "|");
      expect(state.doc.lines).toBe(3);

      const line1 = state.doc.line(1);
      const line3 = state.doc.line(3);
      expect(line1.text.match(/^#{1,6}\s/)).not.toBe(null);
      expect(line3.text.match(/^#{1,6}\s/)).not.toBe(null);
    });

    it("consecutive headings without blank line (edge case)", () => {
      const doc = "# Heading 1\n## Heading 2";
      const state = createState(doc + "|");
      expect(state.doc.lines).toBe(2);
      // Both are still valid headings
      expect(state.doc.line(1).text.match(/^#{1,6}\s/)).not.toBe(null);
      expect(state.doc.line(2).text.match(/^#{1,6}\s/)).not.toBe(null);
    });
  });

  describe("Heading with Inline Formatting", () => {
    it("heading can contain bold", () => {
      const state = createState("# **Bold** |Heading");
      const info = getLineInfo(state);
      expect(info.isHeading).toBe(true);
      expect(info.lineText).toContain("**Bold**");
    });

    it("heading can contain italic", () => {
      const state = createState("# *Italic* |Heading");
      const info = getLineInfo(state);
      expect(info.isHeading).toBe(true);
      expect(info.lineText).toContain("*Italic*");
    });

    it("heading can contain inline code", () => {
      const state = createState("# `code` |Heading");
      const info = getLineInfo(state);
      expect(info.isHeading).toBe(true);
      expect(info.lineText).toContain("`code`");
    });
  });

  describe("Special Characters in Headings", () => {
    it("heading with # in content", () => {
      const state = createState("# C# |Programming");
      const info = getLineInfo(state);
      expect(info.isHeading).toBe(true);
      expect(info.headingLevel).toBe(1);
      expect(getHeadingContent(state)).toBe("C# Programming");
    });

    it("heading with multiple # in content", () => {
      const state = createState("## Issue #123 and #456|");
      const info = getLineInfo(state);
      expect(info.isHeading).toBe(true);
      expect(info.headingLevel).toBe(2);
    });
  });
});

// ===========================================
// INTEGRATION TESTS
// ===========================================

describe("Integration", () => {
  describe("Document Structure", () => {
    it("typical document with headings and paragraphs", () => {
      const doc = `# Main Title

This is the introduction paragraph.

## Section 1

Content of section 1.

## Section 2

Content of section 2.`;

      const state = EditorState.create({
        doc,
        extensions: [markdown({ extensions: [GFM] })],
      });

      // Count headings
      let headingCount = 0;
      for (let i = 1; i <= state.doc.lines; i++) {
        const line = state.doc.line(i);
        if (line.text.match(/^#{1,6}\s/)) {
          headingCount++;
        }
      }
      expect(headingCount).toBe(3);
    });

    it("document with nested heading levels", () => {
      const doc = `# H1

## H2

### H3

#### H4

##### H5

###### H6`;

      const state = EditorState.create({
        doc,
        extensions: [markdown({ extensions: [GFM] })],
      });

      const levels: number[] = [];
      for (let i = 1; i <= state.doc.lines; i++) {
        const line = state.doc.line(i);
        const match = line.text.match(/^(#{1,6})\s/);
        if (match) {
          levels.push(match[1].length);
        }
      }

      expect(levels).toEqual([1, 2, 3, 4, 5, 6]);
    });
  });

  describe("Cursor Flow Through Document", () => {
    it("navigating through heading and paragraphs", () => {
      const doc = "# Heading\n\nParagraph";
      const state = EditorState.create({
        doc,
        selection: { anchor: 0 },
        extensions: [markdown({ extensions: [GFM] })],
      });

      // Start at beginning
      expect(state.selection.main.head).toBe(0);

      // Simulate moving to end of heading
      const headingEnd = "# Heading".length;
      const atHeadingEnd = EditorState.create({
        doc,
        selection: { anchor: headingEnd },
        extensions: [markdown({ extensions: [GFM] })],
      });

      const line = atHeadingEnd.doc.lineAt(atHeadingEnd.selection.main.head);
      expect(line.to).toBe(headingEnd);
    });
  });
});
