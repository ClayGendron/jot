/**
 * Generate markdown test fixtures for CodeMirror experiments
 *
 * Run: bun experiments/codemirror/generate-fixtures.ts
 *
 * This regenerates all fixtures from scratch to ensure stable testing.
 */

import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "fixtures");

// Ensure fixtures directory exists
mkdirSync(FIXTURES_DIR, { recursive: true });

interface Fixture {
  name: string;
  description: string;
  content: string;
}

const fixtures: Fixture[] = [
  // ===========================================
  // BOLD PATTERNS
  // ===========================================
  {
    name: "bold-asterisks.md",
    description: "Bold text using ** markers",
    content: `# Bold with Asterisks

This is **bold text** in a sentence.

**Bold at start** of line.

End of line is **bold**

**Entire line is bold**

Multiple **bold** words **in one** line.

**Multi
line bold** spanning lines.
`,
  },
  {
    name: "bold-underscores.md",
    description: "Bold text using __ markers",
    content: `# Bold with Underscores

This is __bold text__ in a sentence.

__Bold at start__ of line.

End of line is __bold__

__Entire line is bold__

Multiple __bold__ words __in one__ line.
`,
  },

  // ===========================================
  // ITALIC PATTERNS
  // ===========================================
  {
    name: "italic-asterisks.md",
    description: "Italic text using * markers",
    content: `# Italic with Asterisks

This is *italic text* in a sentence.

*Italic at start* of line.

End of line is *italic*

*Entire line is italic*

Multiple *italic* words *in one* line.
`,
  },
  {
    name: "italic-underscores.md",
    description: "Italic text using _ markers",
    content: `# Italic with Underscores

This is _italic text_ in a sentence.

_Italic at start_ of line.

End of line is _italic_

_Entire line is italic_

Multiple _italic_ words _in one_ line.
`,
  },

  // ===========================================
  // NESTED / COMBINED FORMATTING
  // ===========================================
  {
    name: "nested-formatting.md",
    description: "Nested bold and italic combinations",
    content: `# Nested Formatting

Bold with italic inside: **bold with *italic* inside**

Italic with bold inside: *italic with **bold** inside*

Bold-italic combined: ***bold and italic***

Alternative bold-italic: **_bold and italic_**

Another alternative: __*bold and italic*__

Complex nesting: **bold *italic* back to bold**
`,
  },

  // ===========================================
  // EDGE CASES
  // ===========================================
  {
    name: "edge-cases.md",
    description: "Edge cases and tricky patterns",
    content: `# Edge Cases

## Asterisks that should NOT be formatting

Equation: 5 * 3 * 2 = 30

File path: /path/to/file*

Glob pattern: *.txt

Mid-word asterisks: foo*bar*baz

## Underscores that should NOT be formatting

Variable name: my_variable_name

snake_case_identifier

file_name_with_underscores.txt

## Empty markers (invalid)

Empty bold: ****

Empty italic: **

## Adjacent formatting

**bold1****bold2**

*italic1**italic2*

## Punctuation adjacent

**bold**, followed by comma.

"**quoted bold**"

(**bold in parens**)

## Unicode content

**日本語** in bold

*émphasis* with accents
`,
  },

  // ===========================================
  // STRIKETHROUGH
  // ===========================================
  {
    name: "strikethrough.md",
    description: "Strikethrough text using ~~ markers",
    content: `# Strikethrough

This is ~~strikethrough text~~ in a sentence.

~~Strikethrough at start~~ of line.

End of line is ~~strikethrough~~

~~Entire line is strikethrough~~

Combined: **bold and ~~strikethrough~~**

Combined: ~~strikethrough and **bold**~~
`,
  },

  // ===========================================
  // INLINE CODE
  // ===========================================
  {
    name: "inline-code.md",
    description: "Inline code using backticks",
    content: `# Inline Code

This is \`inline code\` in a sentence.

\`Code at start\` of line.

End of line is \`code\`

Use \`const x = 5\` to declare.

Code with backtick: \`\`code with \` inside\`\`

Formatting inside code should be literal: \`**not bold**\`
`,
  },

  // ===========================================
  // HIGHLIGHT (custom ==...==)
  // ===========================================
  {
    name: "highlight.md",
    description: "Highlight text using == markers (non-standard)",
    content: `# Highlight

This is ==highlighted text== in a sentence.

==Highlight at start== of line.

End of line is ==highlighted==

==Entire line is highlighted==

Combined: **bold and ==highlight==**

Combined: ==highlight and **bold**==
`,
  },

  // ===========================================
  // MIXED DOCUMENT
  // ===========================================
  {
    name: "mixed-formatting.md",
    description: "Real-world document with mixed formatting",
    content: `# Project README

This is a **sample project** demonstrating *various* markdown features.

## Features

- **Bold** text for emphasis
- *Italic* text for subtle emphasis
- ~~Strikethrough~~ for deprecated items
- \`inline code\` for technical terms
- ==Highlighted== text for important notes

## Installation

Run \`npm install\` to install dependencies.

**Important:** Make sure you have *Node.js 18+* installed.

## API Reference

The \`fetchData()\` function accepts these parameters:

- **url** (*string*) - The endpoint URL
- **options** (*object*) - Optional configuration
  - \`timeout\` - Request timeout in ms
  - \`retries\` - Number of retry attempts

## Changelog

### v2.0.0

- ~~Removed legacy API~~
- **New:** Added async support
- *Fixed:* Memory leak in parser

### v1.0.0

- Initial release with **core features**
`,
  },

  // ===========================================
  // CURSOR POSITION TESTS
  // ===========================================
  {
    name: "cursor-positions.md",
    description: "Document for testing cursor movement through formatted text",
    content: `# Cursor Position Tests

Type here:

Before **bold** after

Before *italic* after

Before \`code\` after

Before ==highlight== after

Word**bold**word (no spaces)

a]**b**[c (symbols adjacent)

---

## Multi-format line

The **quick** *brown* \`fox\` ~~jumps~~ ==over==

---

## Editing scenarios

Edit the bold: **REPLACE_ME**

Edit the italic: *REPLACE_ME*

Edit the code: \`REPLACE_ME\`

Delete and retype: **delete this**
`,
  },
];

// Generate all fixtures
console.log("Generating CodeMirror test fixtures...\n");

for (const fixture of fixtures) {
  const filePath = join(FIXTURES_DIR, fixture.name);
  writeFileSync(filePath, fixture.content);
  console.log(`✓ ${fixture.name}`);
  console.log(`  ${fixture.description}\n`);
}

// Generate index file listing all fixtures
const indexContent = `# CodeMirror Test Fixtures

Generated by \`generate-fixtures.ts\`. Do not edit manually.

## Files

${fixtures.map((f) => `- **${f.name}** - ${f.description}`).join("\n")}

## Usage

\`\`\`bash
# Regenerate all fixtures
bun experiments/codemirror/generate-fixtures.ts

# Run the test harness
bun experiments/codemirror/harness.tsx
\`\`\`
`;

writeFileSync(join(FIXTURES_DIR, "README.md"), indexContent);
console.log("✓ README.md (index)\n");

console.log(`Done! Generated ${fixtures.length + 1} files in ${FIXTURES_DIR}`);
