/**
 * Semantic Search Module
 *
 * Provides on-device semantic search using fastembed-rs embeddings.
 * Uses SQLite for embedding storage and cosine similarity for search.
 */

use chrono::Utc;
use fastembed::{TextEmbedding, TokenizerFiles, UserDefinedEmbeddingModel};
use once_cell::sync::OnceCell;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::sync::Mutex;
use tauri::Manager;

// ==========================================
// Types
// ==========================================

/// A chunk of text with position information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DocumentChunk {
    pub file_path: String,
    pub chunk_index: i32,
    pub text: String,
    pub start_offset: i32,
    pub end_offset: i32,
}

/// Semantic search result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SemanticSearchResult {
    pub file_path: String,
    pub file_name: String,
    pub score: f32,
    pub chunk_text: String,
    pub chunk_index: i32,
}

/// Related document result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RelatedDocument {
    pub file_path: String,
    pub file_name: String,
    pub score: f32,
}

/// Indexed folder entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexedFolder {
    pub path: String,
    pub name: String,
    pub added_at: i64,
    pub last_indexed: Option<i64>,
}

/// Indexing progress update
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexingProgress {
    pub current: i32,
    pub total: i32,
    pub current_file: String,
}

/// Semantic search status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SemanticStatus {
    pub model_loaded: bool,
    pub indexed_folders_count: i32,
    pub total_chunks: i32,
    pub total_files: i32,
}

// ==========================================
// Embedding Model
// ==========================================

/// Global embedding model instance (lazy-initialized)
static EMBEDDING_MODEL: OnceCell<Mutex<TextEmbedding>> = OnceCell::new();

/// Get bundled model files embedded at compile time
fn get_bundled_model() -> UserDefinedEmbeddingModel {
    let tokenizer_files = TokenizerFiles {
        tokenizer_file: include_bytes!("../models/all-MiniLM-L6-v2/tokenizer.json").to_vec(),
        config_file: include_bytes!("../models/all-MiniLM-L6-v2/config.json").to_vec(),
        special_tokens_map_file: include_bytes!("../models/all-MiniLM-L6-v2/special_tokens_map.json").to_vec(),
        tokenizer_config_file: include_bytes!("../models/all-MiniLM-L6-v2/tokenizer_config.json").to_vec(),
    };

    UserDefinedEmbeddingModel::new(
        include_bytes!("../models/all-MiniLM-L6-v2/model.onnx").to_vec(),
        tokenizer_files,
    )
}

/// Initialize or get the embedding model
fn get_model() -> Result<&'static Mutex<TextEmbedding>, String> {
    EMBEDDING_MODEL.get_or_try_init(|| {
        let model = TextEmbedding::try_new_from_user_defined(
            get_bundled_model(),
            Default::default(),
        )
        .map_err(|e| format!("Failed to initialize embedding model: {}", e))?;

        Ok(Mutex::new(model))
    })
}

/// Check if the embedding model is loaded
fn is_model_loaded() -> bool {
    EMBEDDING_MODEL.get().is_some()
}

/// Generate embeddings for texts
fn generate_embeddings(texts: Vec<String>) -> Result<Vec<Vec<f32>>, String> {
    if texts.is_empty() {
        return Ok(vec![]);
    }

    let model = get_model()?;
    let model_guard = model.lock()
        .map_err(|e| format!("Failed to lock embedding model: {}", e))?;

    let embeddings = model_guard.embed(texts, None)
        .map_err(|e| format!("Failed to generate embeddings: {}", e))?;

    Ok(embeddings)
}

// ==========================================
// Database
// ==========================================

/// Get the semantic search database path
fn get_db_path(app_data_dir: &str) -> std::path::PathBuf {
    Path::new(app_data_dir).join("semantic.db")
}

/// Initialize the semantic search database
fn init_database(app_data_dir: &str) -> Result<Connection, String> {
    let dir = Path::new(app_data_dir);

    // Create directory if it doesn't exist
    if !dir.exists() {
        fs::create_dir_all(dir)
            .map_err(|e| format!("Failed to create app data directory: {}", e))?;
    }

    let db_path = get_db_path(app_data_dir);
    let conn = Connection::open(&db_path)
        .map_err(|e| format!("Failed to open semantic database: {}", e))?;

    // Create tables
    conn.execute(
        "CREATE TABLE IF NOT EXISTS indexed_folders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            path TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            added_at INTEGER NOT NULL,
            last_indexed INTEGER
        )",
        [],
    ).map_err(|e| format!("Failed to create indexed_folders table: {}", e))?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS embeddings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_path TEXT NOT NULL,
            chunk_index INTEGER NOT NULL,
            chunk_text TEXT NOT NULL,
            start_offset INTEGER NOT NULL,
            end_offset INTEGER NOT NULL,
            embedding BLOB NOT NULL,
            content_hash TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            UNIQUE(file_path, chunk_index)
        )",
        [],
    ).map_err(|e| format!("Failed to create embeddings table: {}", e))?;

    // Create indexes for fast lookups
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_embeddings_file_path ON embeddings(file_path)",
        [],
    ).map_err(|e| format!("Failed to create file_path index: {}", e))?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_embeddings_content_hash ON embeddings(content_hash)",
        [],
    ).map_err(|e| format!("Failed to create content_hash index: {}", e))?;

    // Create settings table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )",
        [],
    ).map_err(|e| format!("Failed to create settings table: {}", e))?;

    Ok(conn)
}

/// Get a database connection
fn get_connection(app_data_dir: &str) -> Result<Connection, String> {
    init_database(app_data_dir)
}

/// Compute content hash for deduplication
fn compute_content_hash(content: &str) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    let mut hasher = DefaultHasher::new();
    content.hash(&mut hasher);
    format!("{:x}", hasher.finish())
}

/// Serialize embedding to bytes
fn embedding_to_bytes(embedding: &[f32]) -> Vec<u8> {
    embedding.iter()
        .flat_map(|f| f.to_le_bytes())
        .collect()
}

/// Deserialize embedding from bytes
fn bytes_to_embedding(bytes: &[u8]) -> Vec<f32> {
    bytes.chunks(4)
        .map(|chunk| {
            let arr: [u8; 4] = chunk.try_into().unwrap_or([0, 0, 0, 0]);
            f32::from_le_bytes(arr)
        })
        .collect()
}

/// Compute cosine similarity between two embeddings
/// Note: fastembed embeddings are L2-normalized, so dot product = cosine similarity
fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    a.iter().zip(b.iter()).map(|(x, y)| x * y).sum()
}

// ==========================================
// Tauri Commands
// ==========================================

/// Initialize the semantic search model
#[tauri::command]
pub async fn jot_semantic_init() -> Result<bool, String> {
    tauri::async_runtime::spawn_blocking(move || {
        get_model()?;
        Ok(true)
    }).await.map_err(|e| e.to_string())?
}

/// Get semantic search status
#[tauri::command]
pub fn jot_semantic_get_status(app: tauri::AppHandle) -> Result<SemanticStatus, String> {
    let app_data_dir = app.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    let app_data_str = app_data_dir.to_string_lossy().to_string();

    let conn = get_connection(&app_data_str)?;

    let indexed_folders_count: i32 = conn.query_row(
        "SELECT COUNT(*) FROM indexed_folders",
        [],
        |row| row.get(0),
    ).unwrap_or(0);

    let total_chunks: i32 = conn.query_row(
        "SELECT COUNT(*) FROM embeddings",
        [],
        |row| row.get(0),
    ).unwrap_or(0);

    let total_files: i32 = conn.query_row(
        "SELECT COUNT(DISTINCT file_path) FROM embeddings",
        [],
        |row| row.get(0),
    ).unwrap_or(0);

    Ok(SemanticStatus {
        model_loaded: is_model_loaded(),
        indexed_folders_count,
        total_chunks,
        total_files,
    })
}

/// Add a folder to the indexed folders list
#[tauri::command]
pub fn jot_semantic_add_folder(
    app: tauri::AppHandle,
    path: String,
    name: String,
) -> Result<(), String> {
    let app_data_dir = app.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    let app_data_str = app_data_dir.to_string_lossy().to_string();

    let conn = get_connection(&app_data_str)?;
    let now = Utc::now().timestamp_millis();

    conn.execute(
        "INSERT OR REPLACE INTO indexed_folders (path, name, added_at, last_indexed) VALUES (?1, ?2, ?3, NULL)",
        params![path, name, now],
    ).map_err(|e| format!("Failed to add indexed folder: {}", e))?;

    Ok(())
}

/// Remove a folder from indexed folders and delete its embeddings
#[tauri::command]
pub fn jot_semantic_remove_folder(
    app: tauri::AppHandle,
    path: String,
) -> Result<i32, String> {
    let app_data_dir = app.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    let app_data_str = app_data_dir.to_string_lossy().to_string();

    let conn = get_connection(&app_data_str)?;

    // Remove folder entry
    conn.execute(
        "DELETE FROM indexed_folders WHERE path = ?1",
        params![path],
    ).map_err(|e| format!("Failed to remove indexed folder: {}", e))?;

    // Remove all embeddings for files in this folder
    // Use LIKE with folder path prefix
    let folder_prefix = if path.ends_with('/') || path.ends_with('\\') {
        path.clone()
    } else {
        format!("{}/", path)
    };

    let deleted = conn.execute(
        "DELETE FROM embeddings WHERE file_path LIKE ?1",
        params![format!("{}%", folder_prefix)],
    ).map_err(|e| format!("Failed to remove embeddings: {}", e))?;

    Ok(deleted as i32)
}

/// Get list of indexed folders
#[tauri::command]
pub fn jot_semantic_get_folders(app: tauri::AppHandle) -> Result<Vec<IndexedFolder>, String> {
    let app_data_dir = app.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    let app_data_str = app_data_dir.to_string_lossy().to_string();

    let conn = get_connection(&app_data_str)?;

    let mut stmt = conn.prepare(
        "SELECT path, name, added_at, last_indexed FROM indexed_folders ORDER BY added_at DESC"
    ).map_err(|e| format!("Failed to prepare query: {}", e))?;

    let folders = stmt.query_map([], |row| {
        Ok(IndexedFolder {
            path: row.get(0)?,
            name: row.get(1)?,
            added_at: row.get(2)?,
            last_indexed: row.get(3)?,
        })
    }).map_err(|e| format!("Failed to query folders: {}", e))?;

    let mut result = Vec::new();
    for folder in folders {
        result.push(folder.map_err(|e| format!("Failed to read folder: {}", e))?);
    }

    Ok(result)
}

/// Store embeddings for document chunks
#[tauri::command]
pub async fn jot_semantic_embed_and_store(
    app: tauri::AppHandle,
    chunks: Vec<DocumentChunk>,
) -> Result<i32, String> {
    if chunks.is_empty() {
        return Ok(0);
    }

    let app_data_dir = app.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    let app_data_str = app_data_dir.to_string_lossy().to_string();

    tauri::async_runtime::spawn_blocking(move || {
        // Generate embeddings for all chunks
        let texts: Vec<String> = chunks.iter().map(|c| c.text.clone()).collect();
        let embeddings = generate_embeddings(texts)?;

        if embeddings.len() != chunks.len() {
            return Err("Embedding count mismatch".to_string());
        }

        let conn = get_connection(&app_data_str)?;
        let now = Utc::now().timestamp_millis();

        // Store each chunk with its embedding
        let mut stored = 0;
        for (chunk, embedding) in chunks.iter().zip(embeddings.iter()) {
            let content_hash = compute_content_hash(&chunk.text);
            let embedding_bytes = embedding_to_bytes(embedding);

            // Delete existing entry for this file+chunk_index
            conn.execute(
                "DELETE FROM embeddings WHERE file_path = ?1 AND chunk_index = ?2",
                params![chunk.file_path, chunk.chunk_index],
            ).ok();

            // Insert new entry
            conn.execute(
                "INSERT INTO embeddings (file_path, chunk_index, chunk_text, start_offset, end_offset, embedding, content_hash, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![
                    chunk.file_path,
                    chunk.chunk_index,
                    chunk.text,
                    chunk.start_offset,
                    chunk.end_offset,
                    embedding_bytes,
                    content_hash,
                    now
                ],
            ).map_err(|e| format!("Failed to store embedding: {}", e))?;

            stored += 1;
        }

        Ok(stored)
    }).await.map_err(|e| e.to_string())?
}

/// Delete embeddings for a file
#[tauri::command]
pub fn jot_semantic_delete_file(
    app: tauri::AppHandle,
    file_path: String,
) -> Result<i32, String> {
    let app_data_dir = app.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    let app_data_str = app_data_dir.to_string_lossy().to_string();

    let conn = get_connection(&app_data_str)?;

    let deleted = conn.execute(
        "DELETE FROM embeddings WHERE file_path = ?1",
        params![file_path],
    ).map_err(|e| format!("Failed to delete file embeddings: {}", e))?;

    Ok(deleted as i32)
}

/// Check if a file needs re-indexing (content hash changed)
#[tauri::command]
pub fn jot_semantic_file_needs_update(
    app: tauri::AppHandle,
    file_path: String,
    content_hash: String,
) -> Result<bool, String> {
    let app_data_dir = app.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    let app_data_str = app_data_dir.to_string_lossy().to_string();

    let conn = get_connection(&app_data_str)?;

    // Get the content hash of the first chunk for this file
    let existing_hash: Option<String> = conn.query_row(
        "SELECT content_hash FROM embeddings WHERE file_path = ?1 AND chunk_index = 0",
        params![file_path],
        |row| row.get(0),
    ).optional().map_err(|e| format!("Failed to query content hash: {}", e))?;

    match existing_hash {
        Some(hash) => Ok(hash != content_hash),
        None => Ok(true), // File not indexed yet
    }
}

/// Semantic search across all indexed documents
#[tauri::command]
pub async fn jot_semantic_search(
    app: tauri::AppHandle,
    query: String,
    limit: i32,
) -> Result<Vec<SemanticSearchResult>, String> {
    if query.trim().is_empty() {
        return Ok(vec![]);
    }

    let app_data_dir = app.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    let app_data_str = app_data_dir.to_string_lossy().to_string();

    tauri::async_runtime::spawn_blocking(move || {
        // Generate query embedding
        let embeddings = generate_embeddings(vec![query])?;
        let query_embedding = embeddings.first()
            .ok_or("Failed to generate query embedding")?;

        let conn = get_connection(&app_data_str)?;

        // Load all embeddings (brute force search - fast enough for <10K documents)
        let mut stmt = conn.prepare(
            "SELECT file_path, chunk_index, chunk_text, embedding FROM embeddings"
        ).map_err(|e| format!("Failed to prepare query: {}", e))?;

        let mut results: Vec<(String, i32, String, f32)> = stmt.query_map([], |row| {
            let file_path: String = row.get(0)?;
            let chunk_index: i32 = row.get(1)?;
            let chunk_text: String = row.get(2)?;
            let embedding_bytes: Vec<u8> = row.get(3)?;
            Ok((file_path, chunk_index, chunk_text, embedding_bytes))
        })
        .map_err(|e| format!("Failed to query embeddings: {}", e))?
        .filter_map(|r| r.ok())
        .map(|(file_path, chunk_index, chunk_text, embedding_bytes)| {
            let embedding = bytes_to_embedding(&embedding_bytes);
            let score = cosine_similarity(query_embedding, &embedding);
            (file_path, chunk_index, chunk_text, score)
        })
        .collect();

        // Sort by score descending
        results.sort_by(|a, b| b.3.partial_cmp(&a.3).unwrap_or(std::cmp::Ordering::Equal));

        // Take top results
        let top_results: Vec<SemanticSearchResult> = results
            .into_iter()
            .take(limit as usize)
            .map(|(file_path, chunk_index, chunk_text, score)| {
                let file_name = Path::new(&file_path)
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_default();

                SemanticSearchResult {
                    file_path,
                    file_name,
                    score,
                    chunk_text,
                    chunk_index,
                }
            })
            .collect();

        Ok(top_results)
    }).await.map_err(|e| e.to_string())?
}

/// Get related documents for a file
#[tauri::command]
pub async fn jot_semantic_get_related(
    app: tauri::AppHandle,
    file_path: String,
    limit: i32,
) -> Result<Vec<RelatedDocument>, String> {
    let app_data_dir = app.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    let app_data_str = app_data_dir.to_string_lossy().to_string();

    tauri::async_runtime::spawn_blocking(move || {
        let conn = get_connection(&app_data_str)?;

        // Get embeddings for the current file
        let mut stmt = conn.prepare(
            "SELECT embedding FROM embeddings WHERE file_path = ?1"
        ).map_err(|e| format!("Failed to prepare query: {}", e))?;

        let file_embeddings: Vec<Vec<f32>> = stmt.query_map(params![file_path], |row| {
            let bytes: Vec<u8> = row.get(0)?;
            Ok(bytes_to_embedding(&bytes))
        })
        .map_err(|e| format!("Failed to query file embeddings: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

        if file_embeddings.is_empty() {
            return Ok(vec![]);
        }

        // Average the file's embeddings
        let dim = file_embeddings[0].len();
        let mut avg_embedding = vec![0.0f32; dim];
        for emb in &file_embeddings {
            for (i, val) in emb.iter().enumerate() {
                avg_embedding[i] += val;
            }
        }
        let count = file_embeddings.len() as f32;
        for val in &mut avg_embedding {
            *val /= count;
        }

        // Normalize
        let norm: f32 = avg_embedding.iter().map(|x| x * x).sum::<f32>().sqrt();
        if norm > 0.0 {
            for val in &mut avg_embedding {
                *val /= norm;
            }
        }

        // Query all other embeddings
        let mut stmt = conn.prepare(
            "SELECT DISTINCT file_path FROM embeddings WHERE file_path != ?1"
        ).map_err(|e| format!("Failed to prepare query: {}", e))?;

        let other_files: Vec<String> = stmt.query_map(params![file_path], |row| {
            row.get(0)
        })
        .map_err(|e| format!("Failed to query other files: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

        let mut results: Vec<(String, f32)> = Vec::new();

        for other_path in other_files {
            // Get embeddings for this file
            let mut stmt = conn.prepare(
                "SELECT embedding FROM embeddings WHERE file_path = ?1"
            ).map_err(|e| format!("Failed to prepare query: {}", e))?;

            let other_embeddings: Vec<Vec<f32>> = stmt.query_map(params![other_path], |row| {
                let bytes: Vec<u8> = row.get(0)?;
                Ok(bytes_to_embedding(&bytes))
            })
            .map_err(|e| format!("Failed to query other embeddings: {}", e))?
            .filter_map(|r| r.ok())
            .collect();

            if other_embeddings.is_empty() {
                continue;
            }

            // Average and normalize
            let mut other_avg = vec![0.0f32; dim];
            for emb in &other_embeddings {
                for (i, val) in emb.iter().enumerate() {
                    other_avg[i] += val;
                }
            }
            let other_count = other_embeddings.len() as f32;
            for val in &mut other_avg {
                *val /= other_count;
            }
            let other_norm: f32 = other_avg.iter().map(|x| x * x).sum::<f32>().sqrt();
            if other_norm > 0.0 {
                for val in &mut other_avg {
                    *val /= other_norm;
                }
            }

            let score = cosine_similarity(&avg_embedding, &other_avg);
            results.push((other_path, score));
        }

        // Sort by score descending
        results.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

        // Take top results
        let top_results: Vec<RelatedDocument> = results
            .into_iter()
            .take(limit as usize)
            .map(|(path, score)| {
                let file_name = Path::new(&path)
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_default();

                RelatedDocument {
                    file_path: path,
                    file_name,
                    score,
                }
            })
            .collect();

        Ok(top_results)
    }).await.map_err(|e| e.to_string())?
}

/// Update folder's last_indexed timestamp
#[tauri::command]
pub fn jot_semantic_update_folder_indexed(
    app: tauri::AppHandle,
    path: String,
) -> Result<(), String> {
    let app_data_dir = app.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    let app_data_str = app_data_dir.to_string_lossy().to_string();

    let conn = get_connection(&app_data_str)?;
    let now = Utc::now().timestamp_millis();

    conn.execute(
        "UPDATE indexed_folders SET last_indexed = ?1 WHERE path = ?2",
        params![now, path],
    ).map_err(|e| format!("Failed to update folder indexed time: {}", e))?;

    Ok(())
}

/// Clear all semantic search data
#[tauri::command]
pub fn jot_semantic_clear_all(app: tauri::AppHandle) -> Result<(), String> {
    let app_data_dir = app.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    let app_data_str = app_data_dir.to_string_lossy().to_string();

    let conn = get_connection(&app_data_str)?;

    conn.execute("DELETE FROM embeddings", [])
        .map_err(|e| format!("Failed to clear embeddings: {}", e))?;
    conn.execute("DELETE FROM indexed_folders", [])
        .map_err(|e| format!("Failed to clear indexed folders: {}", e))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_embedding_serialization() {
        let original: Vec<f32> = vec![0.1, 0.2, 0.3, 0.4, 0.5];
        let bytes = embedding_to_bytes(&original);
        let restored = bytes_to_embedding(&bytes);

        assert_eq!(original.len(), restored.len());
        for (a, b) in original.iter().zip(restored.iter()) {
            assert!((a - b).abs() < 1e-6);
        }
    }

    #[test]
    fn test_cosine_similarity() {
        // Same vector should have similarity 1.0
        let a = vec![0.5, 0.5, 0.5, 0.5];
        let norm: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
        let normalized: Vec<f32> = a.iter().map(|x| x / norm).collect();

        let sim = cosine_similarity(&normalized, &normalized);
        assert!((sim - 1.0).abs() < 1e-6);
    }

    #[test]
    fn test_content_hash() {
        let hash1 = compute_content_hash("Hello, World!");
        let hash2 = compute_content_hash("Hello, World!");
        let hash3 = compute_content_hash("Different content");

        assert_eq!(hash1, hash2);
        assert_ne!(hash1, hash3);
    }
}
