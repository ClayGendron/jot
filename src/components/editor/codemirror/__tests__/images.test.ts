/**
 * Tests for Image Decorations
 *
 * Phase 4: Verify image syntax is replaced with rendered images,
 * and fallback text is shown on error.
 */

import { describe, it, expect } from "vitest";
import { EditorState } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";
import { GFM } from "@lezer/markdown";
import { imageField, extractImageData } from "../decorations/images";

/**
 * Helper to create an editor state with image extension
 */
function createTestState(doc: string) {
  return EditorState.create({
    doc,
    extensions: [markdown({ extensions: [GFM] }), imageField],
  });
}

describe("Image Decorations", () => {
  describe("imageField", () => {
    it("creates decorations for a basic image", () => {
      const state = createTestState("![Alt text](image.png)");
      const decorations = state.field(imageField);

      expect(decorations.size).toBeGreaterThan(0);
    });

    it("creates decorations for multiple images", () => {
      const state = createTestState("![First](a.png) and ![Second](b.png)");
      const decorations = state.field(imageField);

      expect(decorations.size).toBeGreaterThan(0);
    });

    it("handles empty document", () => {
      const state = createTestState("");
      const decorations = state.field(imageField);

      expect(decorations.size).toBe(0);
    });

    it("handles document with no images", () => {
      const state = createTestState("Just plain text without any images.");
      const decorations = state.field(imageField);

      expect(decorations.size).toBe(0);
    });

    it("creates decoration for image with title", () => {
      const state = createTestState('![Alt](image.png "Title Text")');
      const decorations = state.field(imageField);

      expect(decorations.size).toBeGreaterThan(0);
    });

    it("updates decorations when document changes", () => {
      const state1 = createTestState("Plain text");
      const decorations1 = state1.field(imageField);
      expect(decorations1.size).toBe(0);

      const state2 = createTestState("![New Image](new.png)");
      const decorations2 = state2.field(imageField);
      expect(decorations2.size).toBeGreaterThan(0);
    });
  });

  describe("extractImageData", () => {
    it("extracts basic image data", () => {
      const state = createTestState("![Alt text](image.png)");
      const images = extractImageData(state);

      expect(images).toHaveLength(1);
      expect(images[0].alt).toBe("Alt text");
      expect(images[0].src).toBe("image.png");
    });

    it("extracts multiple images", () => {
      const state = createTestState("![First](a.png) text ![Second](b.jpg)");
      const images = extractImageData(state);

      expect(images).toHaveLength(2);
      expect(images[0].alt).toBe("First");
      expect(images[1].alt).toBe("Second");
    });

    it("extracts image with title", () => {
      const state = createTestState('![Alt](image.png "Title Text")');
      const images = extractImageData(state);

      expect(images).toHaveLength(1);
      expect(images[0].alt).toBe("Alt");
      expect(images[0].src).toBe("image.png");
      expect(images[0].title).toBe("Title Text");
    });

    it("extracts position information", () => {
      const state = createTestState("![Alt](image.png)");
      const images = extractImageData(state);

      expect(images[0].from).toBe(0);
      expect(images[0].to).toBe(17);
    });

    it("handles empty alt text", () => {
      const state = createTestState("![](image.png)");
      const images = extractImageData(state);

      expect(images[0].alt).toBe("");
      expect(images[0].src).toBe("image.png");
    });

    it("handles relative path", () => {
      const state = createTestState("![Screenshot](../images/screenshot.png)");
      const images = extractImageData(state);

      expect(images[0].src).toBe("../images/screenshot.png");
    });

    it("handles remote URL", () => {
      const state = createTestState("![Remote](https://example.com/image.jpg)");
      const images = extractImageData(state);

      expect(images[0].src).toBe("https://example.com/image.jpg");
    });

    it("returns empty array for document with no images", () => {
      const state = createTestState("Just plain text.");
      const images = extractImageData(state);

      expect(images).toHaveLength(0);
    });

    it("does not extract link syntax as images", () => {
      const state = createTestState("[Link](url.md)");
      const images = extractImageData(state);

      // Links without ! should not be treated as images
      expect(images).toHaveLength(0);
    });
  });

  describe("Image URL handling", () => {
    it("handles png extension", () => {
      const state = createTestState("![](image.png)");
      const images = extractImageData(state);

      expect(images[0].src).toBe("image.png");
    });

    it("handles jpg extension", () => {
      const state = createTestState("![](photo.jpg)");
      const images = extractImageData(state);

      expect(images[0].src).toBe("photo.jpg");
    });

    it("handles gif extension", () => {
      const state = createTestState("![](animation.gif)");
      const images = extractImageData(state);

      expect(images[0].src).toBe("animation.gif");
    });

    it("handles svg extension", () => {
      const state = createTestState("![](diagram.svg)");
      const images = extractImageData(state);

      expect(images[0].src).toBe("diagram.svg");
    });

    it("handles webp extension", () => {
      const state = createTestState("![](modern.webp)");
      const images = extractImageData(state);

      expect(images[0].src).toBe("modern.webp");
    });

    it("handles URL with query parameters", () => {
      const state = createTestState("![](image.png?width=100)");
      const images = extractImageData(state);

      expect(images[0].src).toBe("image.png?width=100");
    });
  });

  describe("Code block handling", () => {
    it("does not create decorations for images in inline code", () => {
      const state = createTestState("Use `![alt](img.png)` syntax");
      const images = extractImageData(state);

      // Images inside inline code should be skipped
      expect(images).toHaveLength(0);
    });

    it("does not create decorations for images in fenced code blocks", () => {
      const state = createTestState("```\n![alt](img.png)\n```");
      const images = extractImageData(state);

      // Images inside code blocks should be skipped
      expect(images).toHaveLength(0);
    });
  });

  describe("Edge cases", () => {
    it("handles image at start of document", () => {
      const state = createTestState("![Start](a.png) of text");
      const images = extractImageData(state);

      expect(images).toHaveLength(1);
      expect(images[0].from).toBe(0);
    });

    it("handles image at end of document", () => {
      const state = createTestState("End with ![image](z.png)");
      const images = extractImageData(state);

      expect(images).toHaveLength(1);
    });

    it("handles adjacent images", () => {
      const state = createTestState("![A](a.png)![B](b.png)");
      const images = extractImageData(state);

      expect(images).toHaveLength(2);
    });

    it("handles image in list item", () => {
      const state = createTestState("- ![Item](item.png)");
      const images = extractImageData(state);

      expect(images).toHaveLength(1);
    });

    it("handles image with spaces in alt text", () => {
      const state = createTestState("![Alt with spaces](img.png)");
      const images = extractImageData(state);

      expect(images[0].alt).toBe("Alt with spaces");
    });

    it("handles image without title (undefined)", () => {
      const state = createTestState("![Alt](img.png)");
      const images = extractImageData(state);

      expect(images[0].title).toBeUndefined();
    });
  });
});
