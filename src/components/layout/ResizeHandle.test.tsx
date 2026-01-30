import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { ResizeHandle } from "./ResizeHandle";

describe("ResizeHandle", () => {
  beforeEach(() => {
    cleanup();
  });

  afterEach(() => {
    // Clean up any body classes
    document.body.classList.remove("resize-dragging");
  });

  it("renders with correct default classes", () => {
    const onResize = vi.fn();
    const { container } = render(
      <ResizeHandle width={260} onResize={onResize} />
    );

    const handle = container.querySelector(".resize-handle");
    expect(handle).toBeTruthy();
    expect(handle?.classList.contains("resize-handle-right")).toBe(true);
    expect(handle?.classList.contains("disabled")).toBe(false);
  });

  it("renders with left position class", () => {
    const onResize = vi.fn();
    const { container } = render(
      <ResizeHandle width={260} onResize={onResize} position="left" />
    );

    const handle = container.querySelector(".resize-handle");
    expect(handle?.classList.contains("resize-handle-left")).toBe(true);
  });

  it("renders with disabled class when disabled", () => {
    const onResize = vi.fn();
    const { container } = render(
      <ResizeHandle width={260} onResize={onResize} disabled />
    );

    const handle = container.querySelector(".resize-handle");
    expect(handle?.classList.contains("disabled")).toBe(true);
  });

  it("has correct aria attributes", () => {
    const onResize = vi.fn();
    const { container } = render(
      <ResizeHandle
        width={260}
        minWidth={180}
        maxWidth={500}
        onResize={onResize}
      />
    );

    const handle = container.querySelector(".resize-handle");
    expect(handle?.getAttribute("role")).toBe("separator");
    expect(handle?.getAttribute("aria-orientation")).toBe("vertical");
    expect(handle?.getAttribute("aria-valuenow")).toBe("260");
    expect(handle?.getAttribute("aria-valuemin")).toBe("180");
    expect(handle?.getAttribute("aria-valuemax")).toBe("500");
  });

  it("does not respond to mouse down when disabled", () => {
    const onResize = vi.fn();
    const { container } = render(
      <ResizeHandle width={260} onResize={onResize} disabled />
    );

    const handle = container.querySelector(".resize-handle")!;
    fireEvent.mouseDown(handle, { clientX: 100 });

    // Should not have dragging class
    expect(handle.classList.contains("dragging")).toBe(false);
  });

  it("adds dragging class and body class on mouse down", () => {
    const onResize = vi.fn();
    const { container } = render(
      <ResizeHandle width={260} onResize={onResize} />
    );

    const handle = container.querySelector(".resize-handle")!;
    fireEvent.mouseDown(handle, { clientX: 100 });

    expect(handle.classList.contains("dragging")).toBe(true);
    expect(document.body.classList.contains("resize-dragging")).toBe(true);
  });

  it("calls onResize with updated width during drag", () => {
    const onResize = vi.fn();
    const { container } = render(
      <ResizeHandle
        width={260}
        minWidth={180}
        maxWidth={500}
        onResize={onResize}
      />
    );

    const handle = container.querySelector(".resize-handle")!;

    // Start drag at x=100
    fireEvent.mouseDown(handle, { clientX: 100 });

    // Move mouse to x=150 (delta of 50)
    fireEvent.mouseMove(document, { clientX: 150 });

    // Should call onResize with 260 + 50 = 310
    expect(onResize).toHaveBeenCalledWith(310);
  });

  it("clamps resize to minimum width", () => {
    const onResize = vi.fn();
    const { container } = render(
      <ResizeHandle
        width={260}
        minWidth={180}
        maxWidth={500}
        onResize={onResize}
      />
    );

    const handle = container.querySelector(".resize-handle")!;

    // Start drag at x=100
    fireEvent.mouseDown(handle, { clientX: 100 });

    // Move mouse left by 200 (delta of -200)
    fireEvent.mouseMove(document, { clientX: -100 });

    // Should call onResize with minWidth (180) since 260 - 200 = 60 < 180
    expect(onResize).toHaveBeenCalledWith(180);
  });

  it("clamps resize to maximum width", () => {
    const onResize = vi.fn();
    const { container } = render(
      <ResizeHandle
        width={260}
        minWidth={180}
        maxWidth={500}
        onResize={onResize}
      />
    );

    const handle = container.querySelector(".resize-handle")!;

    // Start drag at x=100
    fireEvent.mouseDown(handle, { clientX: 100 });

    // Move mouse right by 300 (delta of 300)
    fireEvent.mouseMove(document, { clientX: 400 });

    // Should call onResize with maxWidth (500) since 260 + 300 = 560 > 500
    expect(onResize).toHaveBeenCalledWith(500);
  });

  it("removes dragging class on mouse up", () => {
    const onResize = vi.fn();
    const { container } = render(
      <ResizeHandle width={260} onResize={onResize} />
    );

    const handle = container.querySelector(".resize-handle")!;

    fireEvent.mouseDown(handle, { clientX: 100 });
    expect(handle.classList.contains("dragging")).toBe(true);

    fireEvent.mouseUp(document);
    expect(handle.classList.contains("dragging")).toBe(false);
    expect(document.body.classList.contains("resize-dragging")).toBe(false);
  });

  it("calculates delta in reverse for left position", () => {
    const onResize = vi.fn();
    const { container } = render(
      <ResizeHandle
        width={260}
        minWidth={180}
        maxWidth={500}
        onResize={onResize}
        position="left"
      />
    );

    const handle = container.querySelector(".resize-handle")!;

    // Start drag at x=100
    fireEvent.mouseDown(handle, { clientX: 100 });

    // Move mouse left by 50 (delta of -50)
    // For left position, leftward movement should INCREASE width
    fireEvent.mouseMove(document, { clientX: 50 });

    // Should call onResize with 260 + 50 = 310 (reversed)
    expect(onResize).toHaveBeenCalledWith(310);
  });
});
