import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { SourceEditor } from "./SourceEditor";

describe("SourceEditor", () => {
  it("renders textarea with value", () => {
    render(<SourceEditor value="# Hello" onChange={vi.fn()} />);

    const textarea = screen.getByRole("textbox");
    expect(textarea).toHaveValue("# Hello");
  });

  it("calls onChange when text changes", () => {
    const onChange = vi.fn();
    render(<SourceEditor value="" onChange={onChange} />);

    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "New content" } });

    expect(onChange).toHaveBeenCalledWith("New content");
  });

  it("displays placeholder when empty", () => {
    render(
      <SourceEditor
        value=""
        onChange={vi.fn()}
        placeholder="Write markdown..."
      />
    );

    const textarea = screen.getByRole("textbox");
    expect(textarea).toHaveAttribute("placeholder", "Write markdown...");
  });

  it("has spellcheck disabled", () => {
    render(<SourceEditor value="" onChange={vi.fn()} />);

    const textarea = screen.getByRole("textbox");
    expect(textarea).toHaveAttribute("spellcheck", "false");
  });

  it("has proper aria label", () => {
    render(<SourceEditor value="" onChange={vi.fn()} />);

    const textarea = screen.getByLabelText("Markdown source editor");
    expect(textarea).toBeInTheDocument();
  });

  it("handles tab key for indentation", () => {
    const onChange = vi.fn();
    render(<SourceEditor value="Hello" onChange={onChange} />);

    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;

    // Set cursor position
    textarea.setSelectionRange(0, 0);

    // Press Tab
    fireEvent.keyDown(textarea, { key: "Tab" });

    expect(onChange).toHaveBeenCalledWith("  Hello");
  });

  it("renders with data-testid", () => {
    render(<SourceEditor value="" onChange={vi.fn()} />);

    expect(screen.getByTestId("source-editor")).toBeInTheDocument();
  });
});
