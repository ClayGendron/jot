import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { DocumentOutline } from "./DocumentOutline";
import type { Heading } from "@/lib/markdown/parser";

describe("DocumentOutline", () => {
  const mockHeadings: Heading[] = [
    { level: 1, text: "Introduction", id: "introduction" },
    { level: 2, text: "Background", id: "background" },
    { level: 3, text: "History", id: "history" },
    { level: 2, text: "Methods", id: "methods" },
    { level: 2, text: "Results", id: "results" },
  ];

  it("renders empty state when no headings", () => {
    render(
      <DocumentOutline
        headings={[]}
        activeHeadingId={null}
        onHeadingClick={vi.fn()}
      />
    );

    expect(screen.getByText("No headings")).toBeInTheDocument();
    expect(
      screen.getByText("Add headings to your document to see an outline here")
    ).toBeInTheDocument();
  });

  it("renders all headings", () => {
    render(
      <DocumentOutline
        headings={mockHeadings}
        activeHeadingId={null}
        onHeadingClick={vi.fn()}
      />
    );

    expect(screen.getByText("Introduction")).toBeInTheDocument();
    expect(screen.getByText("Background")).toBeInTheDocument();
    expect(screen.getByText("History")).toBeInTheDocument();
    expect(screen.getByText("Methods")).toBeInTheDocument();
    expect(screen.getByText("Results")).toBeInTheDocument();
  });

  it("shows heading count in footer", () => {
    render(
      <DocumentOutline
        headings={mockHeadings}
        activeHeadingId={null}
        onHeadingClick={vi.fn()}
      />
    );

    expect(screen.getByText("5 headings")).toBeInTheDocument();
  });

  it("shows singular 'heading' for single heading", () => {
    render(
      <DocumentOutline
        headings={[{ level: 1, text: "Only One", id: "only-one" }]}
        activeHeadingId={null}
        onHeadingClick={vi.fn()}
      />
    );

    expect(screen.getByText("1 heading")).toBeInTheDocument();
  });

  it("calls onHeadingClick when a heading is clicked", () => {
    const onHeadingClick = vi.fn();

    render(
      <DocumentOutline
        headings={mockHeadings}
        activeHeadingId={null}
        onHeadingClick={onHeadingClick}
      />
    );

    fireEvent.click(screen.getByText("Background"));

    expect(onHeadingClick).toHaveBeenCalledWith("background");
  });

  it("highlights active heading", () => {
    render(
      <DocumentOutline
        headings={mockHeadings}
        activeHeadingId="methods"
        onHeadingClick={vi.fn()}
      />
    );

    const methodsItem = screen.getByTestId("outline-item-methods");
    expect(methodsItem.getAttribute("data-active")).toBe("true");
  });

  it("filters headings based on search input", () => {
    render(
      <DocumentOutline
        headings={mockHeadings}
        activeHeadingId={null}
        onHeadingClick={vi.fn()}
      />
    );

    const filterInput = screen.getByTestId("outline-filter");
    fireEvent.change(filterInput, { target: { value: "method" } });

    // Methods should be visible
    expect(screen.getByText("Methods")).toBeInTheDocument();

    // Others should be filtered out
    expect(screen.queryByText("Introduction")).not.toBeInTheDocument();
    expect(screen.queryByText("Background")).not.toBeInTheDocument();
    expect(screen.queryByText("Results")).not.toBeInTheDocument();
  });

  it("shows filtered count in footer", () => {
    render(
      <DocumentOutline
        headings={mockHeadings}
        activeHeadingId={null}
        onHeadingClick={vi.fn()}
      />
    );

    const filterInput = screen.getByTestId("outline-filter");
    fireEvent.change(filterInput, { target: { value: "method" } });

    expect(screen.getByText("1 of 5")).toBeInTheDocument();
  });

  it("shows no results message when filter matches nothing", () => {
    render(
      <DocumentOutline
        headings={mockHeadings}
        activeHeadingId={null}
        onHeadingClick={vi.fn()}
      />
    );

    const filterInput = screen.getByTestId("outline-filter");
    fireEvent.change(filterInput, { target: { value: "xyz123" } });

    expect(screen.getByText("No matching headings")).toBeInTheDocument();
    expect(screen.getByText("0 of 5")).toBeInTheDocument();
  });

  it("clears filter when clear button is clicked", () => {
    render(
      <DocumentOutline
        headings={mockHeadings}
        activeHeadingId={null}
        onHeadingClick={vi.fn()}
      />
    );

    const filterInput = screen.getByTestId("outline-filter");
    fireEvent.change(filterInput, { target: { value: "method" } });

    // Only Methods visible
    expect(screen.queryByText("Introduction")).not.toBeInTheDocument();

    // Click clear button
    const clearButton = screen.getByLabelText("Clear filter");
    fireEvent.click(clearButton);

    // All headings visible again
    expect(screen.getByText("Introduction")).toBeInTheDocument();
    expect(screen.getByText("Methods")).toBeInTheDocument();
  });

  it("displays heading levels as H1, H2, H3 labels", () => {
    render(
      <DocumentOutline
        headings={mockHeadings}
        activeHeadingId={null}
        onHeadingClick={vi.fn()}
      />
    );

    // Check for level indicators
    expect(screen.getByText("H1")).toBeInTheDocument();
    expect(screen.getAllByText("H2")).toHaveLength(3); // Background, Methods, Results
    expect(screen.getByText("H3")).toBeInTheDocument();
  });

  it("filter is case-insensitive", () => {
    render(
      <DocumentOutline
        headings={mockHeadings}
        activeHeadingId={null}
        onHeadingClick={vi.fn()}
      />
    );

    const filterInput = screen.getByTestId("outline-filter");
    fireEvent.change(filterInput, { target: { value: "METHODS" } });

    expect(screen.getByText("Methods")).toBeInTheDocument();
    expect(screen.getByText("1 of 5")).toBeInTheDocument();
  });
});
