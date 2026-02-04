/**
 * Test script to debug the ~~ auto-close behavior
 * Run: bun experiments/codemirror/test-strikethrough.ts
 */

import { EditorState, EditorSelection } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { markdown } from "@codemirror/lang-markdown";
import { GFM } from "@lezer/markdown";

// Simulate the input handler logic
function simulateStrikethroughAutoClose() {
  console.log("=== Simulating ~~ auto-close ===\n");

  // Step 1: Create initial state with single ~
  const initialDoc = "~";
  const initialState = EditorState.create({
    doc: initialDoc,
    extensions: [markdown({ extensions: [GFM] })],
    selection: EditorSelection.cursor(1), // Cursor after the ~
  });

  console.log("Initial state:");
  console.log(`  Document: "${initialState.doc.toString()}"`);
  console.log(`  Cursor position: ${initialState.selection.main.head}`);
  console.log(`  Document length: ${initialState.doc.length}`);

  // Step 2: Simulate typing second ~
  const from = initialState.selection.main.head; // 1
  const prevChar = initialState.doc.sliceString(from - 1, from); // "~"
  const text = "~"; // What user is typing

  console.log("\nInput handler params:");
  console.log(`  from: ${from}`);
  console.log(`  prevChar: "${prevChar}"`);
  console.log(`  text: "${text}"`);

  // Check condition
  const shouldAutoClose = text === "~" && prevChar === "~";
  console.log(`\nCondition (text === "~" && prevChar === "~"): ${shouldAutoClose}`);

  if (shouldAutoClose) {
    const tildeStart = from - 1; // 0
    const cursorAfterChange = tildeStart + 2; // 2

    console.log("\nCalculated positions:");
    console.log(`  tildeStart: ${tildeStart}`);
    console.log(`  cursorAfterChange: ${cursorAfterChange}`);

    // Simulate the change
    const changes = { from: tildeStart, to: from, insert: "~~~~" };
    console.log(`\nChange spec:`);
    console.log(`  from: ${changes.from}, to: ${changes.to}, insert: "${changes.insert}"`);

    // Apply the change
    const newState = initialState.update({
      changes,
      selection: EditorSelection.cursor(cursorAfterChange),
    }).state;

    console.log("\nAfter change:");
    console.log(`  Document: "${newState.doc.toString()}"`);
    console.log(`  Document length: ${newState.doc.length}`);
    console.log(`  Cursor position: ${newState.selection.main.head}`);

    // Verify cursor position
    const cursorPos = newState.selection.main.head;
    const beforeCursor = newState.doc.sliceString(0, cursorPos);
    const afterCursor = newState.doc.sliceString(cursorPos);

    console.log(`\nCursor breakdown:`);
    console.log(`  Before cursor: "${beforeCursor}"`);
    console.log(`  After cursor: "${afterCursor}"`);
    console.log(`  Expected: "~~" before, "~~" after`);
    console.log(`  Correct: ${beforeCursor === "~~" && afterCursor === "~~"}`);
  }

  console.log("\n=== End simulation ===");
}

// Also check what happens with pending formatting decorations
function checkPendingFormattingDetection() {
  console.log("\n\n=== Checking pending formatting detection ===\n");

  const doc = "~~~~";
  const pos = 2; // Cursor in the middle

  const before2 = pos >= 2 ? doc.slice(pos - 2, pos) : "";
  const after2 = doc.slice(pos, pos + 2);

  console.log(`Document: "${doc}"`);
  console.log(`Cursor position: ${pos}`);
  console.log(`before2 (pos-2 to pos): "${before2}"`);
  console.log(`after2 (pos to pos+2): "${after2}"`);

  const isStrikethroughPending = before2 === "~~" && after2 === "~~";
  console.log(`\nIs ~~|~~ pattern detected: ${isStrikethroughPending}`);

  console.log("\n=== End check ===");
}

// Run tests
simulateStrikethroughAutoClose();
checkPendingFormattingDetection();
