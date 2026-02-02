/**
 * RelatedDocumentsPanel Component
 *
 * Displays documents that are semantically related to the currently open file.
 * Shows similar documents based on content meaning, not just keyword matches.
 */

import { useEffect, useCallback, useRef } from "react";
import { useSemanticSearchStore } from "@/stores/semanticSearchStore";
import { getRelatedDocuments } from "@/lib/tauri/semantic";
import type { RelatedDocument } from "@/lib/semantic/types";
import { Link2, File } from "lucide-react";

interface RelatedDocumentsPanelProps {
  filePath: string | null;
  onDocumentClick: (path: string) => void;
}

export function RelatedDocumentsPanel({
  filePath,
  onDocumentClick,
}: RelatedDocumentsPanelProps) {
  // Store state
  const enabled = useSemanticSearchStore((s) => s.enabled);
  const modelLoaded = useSemanticSearchStore((s) => s.modelLoaded);
  const indexedFolders = useSemanticSearchStore((s) => s.indexedFolders);
  const relatedDocuments = useSemanticSearchStore((s) => s.relatedDocuments);
  const setRelatedDocuments = useSemanticSearchStore((s) => s.setRelatedDocuments);

  // Track the file path we last fetched related docs for
  const lastFetchedPathRef = useRef<string | null>(null);

  // Fetch related documents when file changes
  useEffect(() => {
    const fetchRelated = async () => {
      if (!filePath || !enabled || !modelLoaded) {
        setRelatedDocuments([]);
        return;
      }

      // Check if file is in an indexed folder
      const isInIndexedFolder = indexedFolders.some((folder) =>
        filePath.startsWith(folder.path)
      );

      if (!isInIndexedFolder) {
        setRelatedDocuments([]);
        return;
      }

      // Skip if we already fetched for this path
      if (lastFetchedPathRef.current === filePath) {
        return;
      }

      lastFetchedPathRef.current = filePath;

      try {
        const related = await getRelatedDocuments(filePath, 10);
        setRelatedDocuments(related);
      } catch (err) {
        console.error("Failed to fetch related documents:", err);
        setRelatedDocuments([]);
      }
    };

    fetchRelated();
  }, [filePath, enabled, modelLoaded, indexedFolders, setRelatedDocuments]);

  // Handle document click
  const handleClick = useCallback(
    (path: string) => {
      onDocumentClick(path);
    },
    [onDocumentClick]
  );

  // Get display name from file path
  const getDisplayName = useCallback((path: string) => {
    const parts = path.split("/");
    return parts[parts.length - 1].replace(/\.md$/, "");
  }, []);

  // Get relative path for display
  const getRelativePath = useCallback(
    (path: string) => {
      for (const folder of indexedFolders) {
        if (path.startsWith(folder.path)) {
          const relativePath = path.slice(folder.path.length + 1);
          // Remove the filename, just show the directory
          const parts = relativePath.split("/");
          if (parts.length > 1) {
            return parts.slice(0, -1).join("/");
          }
          return "";
        }
      }
      return "";
    },
    [indexedFolders]
  );

  // Format similarity score
  const formatScore = useCallback((score: number) => {
    return `${Math.round(score * 100)}%`;
  }, []);

  // Not enabled state
  if (!enabled) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-6 text-center text-[var(--color-ink-faint)]">
        <div className="mb-4 opacity-50">
          <Link2 className="h-8 w-8" />
        </div>
        <p className="m-0 mb-2 font-sans text-sm font-medium text-[var(--color-ink-muted)]">Semantic search disabled</p>
        <p className="m-0 font-sans text-xs text-[var(--color-ink-faint)]">
          Enable it in Settings to see related documents
        </p>
      </div>
    );
  }

  // No file open
  if (!filePath) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-6 text-center text-[var(--color-ink-faint)]">
        <div className="mb-4 opacity-50">
          <Link2 className="h-8 w-8" />
        </div>
        <p className="m-0 mb-2 font-sans text-sm font-medium text-[var(--color-ink-muted)]">No file open</p>
        <p className="m-0 font-sans text-xs text-[var(--color-ink-faint)]">
          Open a document to see related files
        </p>
      </div>
    );
  }

  // Model loading
  if (!modelLoaded) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-6 text-center text-[var(--color-ink-faint)]">
        <div className="mb-4">
          <LoadingSpinner />
        </div>
        <p className="m-0 mb-2 font-sans text-sm font-medium text-[var(--color-ink-muted)]">Loading model...</p>
        <p className="m-0 font-sans text-xs text-[var(--color-ink-faint)]">
          This may take a moment on first use
        </p>
      </div>
    );
  }

  // File not in indexed folder
  const isInIndexedFolder = indexedFolders.some((folder) =>
    filePath.startsWith(folder.path)
  );

  if (!isInIndexedFolder) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-6 text-center text-[var(--color-ink-faint)]">
        <div className="mb-4 opacity-50">
          <Link2 className="h-8 w-8" />
        </div>
        <p className="m-0 mb-2 font-sans text-sm font-medium text-[var(--color-ink-muted)]">Not indexed</p>
        <p className="m-0 font-sans text-xs text-[var(--color-ink-faint)]">
          This file is not in an indexed folder
        </p>
      </div>
    );
  }

  // No related documents
  if (relatedDocuments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-6 text-center text-[var(--color-ink-faint)]">
        <div className="mb-4 opacity-50">
          <Link2 className="h-8 w-8" />
        </div>
        <p className="m-0 mb-2 font-sans text-sm font-medium text-[var(--color-ink-muted)]">No related documents</p>
        <p className="m-0 font-sans text-xs text-[var(--color-ink-faint)]">
          Similar documents will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" data-testid="related-docs-panel">
      {/* Related documents list */}
      <div className="flex-1 overflow-y-auto py-2">
        {relatedDocuments.map((doc, index) => (
          <RelatedDocumentItem
            key={`${doc.filePath}-${index}`}
            document={doc}
            displayName={getDisplayName(doc.filePath)}
            relativePath={getRelativePath(doc.filePath)}
            formattedScore={formatScore(doc.score)}
            onClick={handleClick}
          />
        ))}
      </div>

      {/* Stats footer */}
      <div className="px-4 py-3 border-t border-[var(--color-border)]">
        <span className="font-sans text-xs text-[var(--color-ink-muted)]">
          {relatedDocuments.length} related document
          {relatedDocuments.length === 1 ? "" : "s"}
        </span>
      </div>
    </div>
  );
}

interface RelatedDocumentItemProps {
  document: RelatedDocument;
  displayName: string;
  relativePath: string;
  formattedScore: string;
  onClick: (path: string) => void;
}

function RelatedDocumentItem({
  document,
  displayName,
  relativePath,
  formattedScore,
  onClick,
}: RelatedDocumentItemProps) {
  const handleClick = useCallback(() => {
    onClick(document.filePath);
  }, [document.filePath, onClick]);

  return (
    <button
      type="button"
      className="flex items-start gap-3 w-full px-4 py-3 border-none bg-transparent text-left cursor-pointer transition-colors duration-150 hover:bg-[var(--color-paper-warm)]"
      onClick={handleClick}
      data-testid={`related-doc-${displayName}`}
    >
      {/* File icon */}
      <span className="flex-shrink-0 text-[var(--color-ink-faint)] mt-0.5">
        <File className="h-3.5 w-3.5" />
      </span>

      <div className="flex-1 min-w-0 flex flex-col gap-1">
        {/* File name */}
        <span className="font-sans text-sm font-medium text-[var(--color-ink)] whitespace-nowrap overflow-hidden text-ellipsis">
          {displayName}
        </span>

        {/* Path and score */}
        <div className="flex items-center gap-2 font-mono text-[0.6875rem]">
          {relativePath && (
            <span className="flex-1 text-[var(--color-ink-faint)] whitespace-nowrap overflow-hidden text-ellipsis">
              {relativePath}
            </span>
          )}
          <span className="flex-shrink-0 text-[var(--color-accent)] opacity-90">{formattedScore}</span>
        </div>

        {/* Preview snippet */}
        {document.preview && (
          <span className="font-sans text-xs text-[var(--color-ink-muted)] leading-tight line-clamp-2">
            {document.preview.slice(0, 100)}
            {document.preview.length > 100 && "..."}
          </span>
        )}
      </div>
    </button>
  );
}

function LoadingSpinner() {
  return (
    <div className="w-6 h-6 border-2 border-[var(--color-border)] border-t-[var(--color-accent)] rounded-full animate-spin" />
  );
}

export default RelatedDocumentsPanel;
