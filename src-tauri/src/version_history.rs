/**
 * Version History Module
 *
 * Manages document version snapshots using SQLite storage.
 * Stores full content for each version (simpler than diff-based approach).
 * Versions are automatically created on save and can be restored/compared.
 */

use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension, Result as SqliteResult};
use serde::{Deserialize, Serialize};
use similar::{ChangeTag, TextDiff};
use std::fs;
use std::path::Path;

/// Represents a single version snapshot
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Version {
    pub id: i64,
    pub file_path: String,
    pub content: String,
    pub created_at: i64, // Unix timestamp in milliseconds
    pub byte_size: i64,
    pub word_count: i64,
}

/// Lightweight version metadata (without content)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionMeta {
    pub id: i64,
    pub file_path: String,
    pub created_at: i64,
    pub byte_size: i64,
    pub word_count: i64,
    pub preview: String, // First ~100 chars of content
}

/// Diff line for side-by-side comparison
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffLine {
    pub line_num_old: Option<i32>,
    pub line_num_new: Option<i32>,
    pub content: String,
    pub change_type: String, // "equal", "insert", "delete"
}

/// Diff result between two versions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionDiff {
    pub old_version_id: i64,
    pub new_version_id: i64,
    pub lines: Vec<DiffLine>,
    pub additions: i32,
    pub deletions: i32,
}

/// Initialize the version history database
/// Creates .jot directory and history.db if they don't exist
fn init_database(workspace_path: &str) -> SqliteResult<Connection> {
    let jot_dir = Path::new(workspace_path).join(".jot");

    // Create .jot directory if it doesn't exist
    if !jot_dir.exists() {
        fs::create_dir_all(&jot_dir).map_err(|_| {
            rusqlite::Error::InvalidPath(jot_dir.to_path_buf())
        })?;
    }

    let db_path = jot_dir.join("history.db");
    let conn = Connection::open(&db_path)?;

    // Create versions table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS versions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_path TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            byte_size INTEGER NOT NULL,
            word_count INTEGER NOT NULL,
            UNIQUE(file_path, created_at)
        )",
        [],
    )?;

    // Create index for fast file lookups
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_versions_file_path ON versions(file_path)",
        [],
    )?;

    // Create index for timestamp ordering
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_versions_created_at ON versions(file_path, created_at DESC)",
        [],
    )?;

    // Create settings table for retention config
    conn.execute(
        "CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )",
        [],
    )?;

    // Set default retention (30 days)
    conn.execute(
        "INSERT OR IGNORE INTO settings (key, value) VALUES ('retention_days', '30')",
        [],
    )?;

    Ok(conn)
}

/// Get or create a database connection for the workspace
fn get_connection(workspace_path: &str) -> SqliteResult<Connection> {
    init_database(workspace_path)
}

/// Count words in text (simple whitespace split)
fn count_words(text: &str) -> i64 {
    text.split_whitespace().count() as i64
}

/// Create a content preview (first ~100 chars, trimmed to word boundary)
fn create_preview(content: &str, max_len: usize) -> String {
    if content.len() <= max_len {
        return content.to_string();
    }

    let truncated = &content[..max_len];
    // Find last space to avoid cutting words
    if let Some(pos) = truncated.rfind(' ') {
        format!("{}...", &truncated[..pos])
    } else {
        format!("{}...", truncated)
    }
}

/// Save a new version snapshot
/// Includes retry logic with timestamp increment to handle rapid saves that could
/// collide on the UNIQUE(file_path, created_at) constraint
pub fn save_version(
    workspace_path: &str,
    file_path: &str,
    content: &str,
) -> SqliteResult<i64> {
    let conn = get_connection(workspace_path)?;
    let byte_size = content.len() as i64;
    let word_count = count_words(content);

    // Retry up to 3 times with incrementing timestamp on collision
    let max_retries = 3;
    let base_time = Utc::now().timestamp_millis();

    for retry in 0..max_retries {
        let timestamp = base_time + retry as i64;

        match conn.execute(
            "INSERT INTO versions (file_path, content, created_at, byte_size, word_count)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![file_path, content, timestamp, byte_size, word_count],
        ) {
            Ok(_) => return Ok(conn.last_insert_rowid()),
            Err(rusqlite::Error::SqliteFailure(err, _))
                if err.extended_code == 2067 => // SQLITE_CONSTRAINT_UNIQUE
            {
                // Unique constraint violation - retry with incremented timestamp
                continue;
            }
            Err(e) => return Err(e),
        }
    }

    // Fallback: use timestamp + max_retries (extremely rare edge case)
    let final_timestamp = base_time + max_retries as i64;
    conn.execute(
        "INSERT INTO versions (file_path, content, created_at, byte_size, word_count)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![file_path, content, final_timestamp, byte_size, word_count],
    )?;
    Ok(conn.last_insert_rowid())
}

/// Get version metadata list for a file (most recent first)
pub fn get_versions(
    workspace_path: &str,
    file_path: &str,
    limit: i32,
) -> SqliteResult<Vec<VersionMeta>> {
    let conn = get_connection(workspace_path)?;

    let mut stmt = conn.prepare(
        "SELECT id, file_path, content, created_at, byte_size, word_count
         FROM versions
         WHERE file_path = ?1
         ORDER BY created_at DESC
         LIMIT ?2"
    )?;

    let versions = stmt.query_map(params![file_path, limit], |row| {
        let content: String = row.get(2)?;
        Ok(VersionMeta {
            id: row.get(0)?,
            file_path: row.get(1)?,
            created_at: row.get(3)?,
            byte_size: row.get(4)?,
            word_count: row.get(5)?,
            preview: create_preview(&content, 100),
        })
    })?;

    versions.collect()
}

/// Get a specific version by ID
pub fn get_version(workspace_path: &str, version_id: i64) -> SqliteResult<Option<Version>> {
    let conn = get_connection(workspace_path)?;

    let mut stmt = conn.prepare(
        "SELECT id, file_path, content, created_at, byte_size, word_count
         FROM versions
         WHERE id = ?1"
    )?;

    let mut rows = stmt.query(params![version_id])?;

    if let Some(row) = rows.next()? {
        Ok(Some(Version {
            id: row.get(0)?,
            file_path: row.get(1)?,
            content: row.get(2)?,
            created_at: row.get(3)?,
            byte_size: row.get(4)?,
            word_count: row.get(5)?,
        }))
    } else {
        Ok(None)
    }
}

/// Delete a specific version
pub fn delete_version(workspace_path: &str, version_id: i64) -> SqliteResult<bool> {
    let conn = get_connection(workspace_path)?;
    let rows_affected = conn.execute("DELETE FROM versions WHERE id = ?1", params![version_id])?;
    Ok(rows_affected > 0)
}

/// Delete all versions for a file
pub fn delete_file_versions(workspace_path: &str, file_path: &str) -> SqliteResult<i32> {
    let conn = get_connection(workspace_path)?;
    let rows_affected = conn.execute(
        "DELETE FROM versions WHERE file_path = ?1",
        params![file_path],
    )?;
    Ok(rows_affected as i32)
}

/// Clean up old versions based on retention policy
pub fn cleanup_old_versions(workspace_path: &str) -> SqliteResult<i32> {
    let conn = get_connection(workspace_path)?;

    // Get retention days from settings
    let retention_days: i32 = conn.query_row(
        "SELECT value FROM settings WHERE key = 'retention_days'",
        [],
        |row| row.get::<_, String>(0).map(|v| v.parse().unwrap_or(30)),
    ).unwrap_or(30);

    let cutoff = Utc::now().timestamp_millis() - (retention_days as i64 * 24 * 60 * 60 * 1000);

    let rows_affected = conn.execute(
        "DELETE FROM versions WHERE created_at < ?1",
        params![cutoff],
    )?;

    Ok(rows_affected as i32)
}

/// Get the retention setting in days
pub fn get_retention_days(workspace_path: &str) -> SqliteResult<i32> {
    let conn = get_connection(workspace_path)?;

    conn.query_row(
        "SELECT value FROM settings WHERE key = 'retention_days'",
        [],
        |row| row.get::<_, String>(0).map(|v| v.parse().unwrap_or(30)),
    )
}

/// Set the retention setting in days
pub fn set_retention_days(workspace_path: &str, days: i32) -> SqliteResult<()> {
    let conn = get_connection(workspace_path)?;

    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('retention_days', ?1)",
        params![days.to_string()],
    )?;

    Ok(())
}

/// Compare two versions and return a diff
pub fn diff_versions(
    workspace_path: &str,
    old_version_id: i64,
    new_version_id: i64,
) -> SqliteResult<Option<VersionDiff>> {
    let old_version = get_version(workspace_path, old_version_id)?;
    let new_version = get_version(workspace_path, new_version_id)?;

    match (old_version, new_version) {
        (Some(old), Some(new)) => {
            let diff = TextDiff::from_lines(&old.content, &new.content);
            let mut lines = Vec::new();
            let mut additions = 0;
            let mut deletions = 0;
            let mut old_line = 1;
            let mut new_line = 1;

            for change in diff.iter_all_changes() {
                let (line_num_old, line_num_new, change_type) = match change.tag() {
                    ChangeTag::Equal => {
                        let result = (Some(old_line), Some(new_line), "equal");
                        old_line += 1;
                        new_line += 1;
                        result
                    }
                    ChangeTag::Delete => {
                        deletions += 1;
                        let result = (Some(old_line), None, "delete");
                        old_line += 1;
                        result
                    }
                    ChangeTag::Insert => {
                        additions += 1;
                        let result = (None, Some(new_line), "insert");
                        new_line += 1;
                        result
                    }
                };

                lines.push(DiffLine {
                    line_num_old,
                    line_num_new,
                    content: change.value().trim_end_matches('\n').to_string(),
                    change_type: change_type.to_string(),
                });
            }

            Ok(Some(VersionDiff {
                old_version_id,
                new_version_id,
                lines,
                additions,
                deletions,
            }))
        }
        _ => Ok(None),
    }
}

/// Get total version count for a file
pub fn get_version_count(workspace_path: &str, file_path: &str) -> SqliteResult<i32> {
    let conn = get_connection(workspace_path)?;

    conn.query_row(
        "SELECT COUNT(*) FROM versions WHERE file_path = ?1",
        params![file_path],
        |row| row.get(0),
    )
}

/// Check if content is different from the latest version (to avoid duplicate saves)
pub fn is_content_changed(
    workspace_path: &str,
    file_path: &str,
    new_content: &str,
) -> SqliteResult<bool> {
    let conn = get_connection(workspace_path)?;

    let latest_content: Option<String> = conn.query_row(
        "SELECT content FROM versions WHERE file_path = ?1 ORDER BY created_at DESC LIMIT 1",
        params![file_path],
        |row| row.get(0),
    ).optional()?;

    match latest_content {
        Some(existing) => Ok(existing != new_content),
        None => Ok(true), // No previous version, so it's "changed"
    }
}

/// Update file path for all versions when a file is renamed
pub fn update_file_path(
    workspace_path: &str,
    old_path: &str,
    new_path: &str,
) -> SqliteResult<i32> {
    let conn = get_connection(workspace_path)?;

    let rows_affected = conn.execute(
        "UPDATE versions SET file_path = ?1 WHERE file_path = ?2",
        params![new_path, old_path],
    )?;

    Ok(rows_affected as i32)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;
    use std::fs;

    fn setup_test_workspace() -> String {
        let temp_dir = env::temp_dir().join(format!("jot_test_{}", Utc::now().timestamp_millis()));
        fs::create_dir_all(&temp_dir).unwrap();
        temp_dir.to_string_lossy().to_string()
    }

    fn cleanup_test_workspace(path: &str) {
        let _ = fs::remove_dir_all(path);
    }

    #[test]
    fn test_save_and_get_version() {
        let workspace = setup_test_workspace();
        let file_path = "/test/document.md";
        let content = "# Hello World\n\nThis is a test.";

        let version_id = save_version(&workspace, file_path, content).unwrap();
        assert!(version_id > 0);

        let version = get_version(&workspace, version_id).unwrap().unwrap();
        assert_eq!(version.file_path, file_path);
        assert_eq!(version.content, content);
        assert_eq!(version.word_count, 6);

        cleanup_test_workspace(&workspace);
    }

    #[test]
    fn test_get_versions_list() {
        let workspace = setup_test_workspace();
        let file_path = "/test/document.md";

        // Save multiple versions - no artificial delays needed
        // save_version now handles timestamp collisions with retry logic
        save_version(&workspace, file_path, "Version 1").unwrap();
        save_version(&workspace, file_path, "Version 2").unwrap();
        save_version(&workspace, file_path, "Version 3").unwrap();

        let versions = get_versions(&workspace, file_path, 10).unwrap();
        assert_eq!(versions.len(), 3);

        // Most recent first
        assert!(versions[0].preview.contains("Version 3"));
        assert!(versions[1].preview.contains("Version 2"));
        assert!(versions[2].preview.contains("Version 1"));

        cleanup_test_workspace(&workspace);
    }

    #[test]
    fn test_diff_versions() {
        let workspace = setup_test_workspace();
        let file_path = "/test/document.md";

        let v1_id = save_version(&workspace, file_path, "Line 1\nLine 2\nLine 3").unwrap();
        let v2_id = save_version(&workspace, file_path, "Line 1\nLine 2 modified\nLine 3\nLine 4").unwrap();

        let diff = diff_versions(&workspace, v1_id, v2_id).unwrap().unwrap();

        assert!(diff.additions > 0);
        assert!(diff.deletions > 0);
        assert!(!diff.lines.is_empty());

        cleanup_test_workspace(&workspace);
    }

    #[test]
    fn test_is_content_changed() {
        let workspace = setup_test_workspace();
        let file_path = "/test/document.md";
        let content = "Same content";

        // First save - should be considered "changed"
        assert!(is_content_changed(&workspace, file_path, content).unwrap());

        save_version(&workspace, file_path, content).unwrap();

        // Same content - should not be changed
        assert!(!is_content_changed(&workspace, file_path, content).unwrap());

        // Different content - should be changed
        assert!(is_content_changed(&workspace, file_path, "Different content").unwrap());

        cleanup_test_workspace(&workspace);
    }
}
