import { useCallback, useRef, useEffect } from "react";

interface SourceEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autofocus?: boolean;
}

/**
 * Raw markdown source editor
 *
 * A styled textarea for editing markdown source directly.
 * Design: Monospace font with subtle line highlighting,
 * matching Jot's editorial aesthetic.
 */
export function SourceEditor({
  value,
  onChange,
  placeholder = "Write markdown...",
  autofocus = false,
}: SourceEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus when mounted
  useEffect(() => {
    if (autofocus && textareaRef.current) {
      textareaRef.current.focus();
      // Move cursor to end
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [autofocus]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value);
    },
    [onChange]
  );

  // Handle tab key for indentation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Tab") {
        e.preventDefault();
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newValue =
          value.substring(0, start) + "  " + value.substring(end);

        onChange(newValue);

        // Restore cursor position
        requestAnimationFrame(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 2;
        });
      }
    },
    [value, onChange]
  );

  return (
    <div className="source-editor-container" data-testid="source-editor">
      <textarea
        ref={textareaRef}
        className="source-editor"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        data-gramm="false"
        aria-label="Markdown source editor"
      />
    </div>
  );
}

export default SourceEditor;
