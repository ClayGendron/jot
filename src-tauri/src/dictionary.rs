use serde::{Deserialize, Serialize};
use std::fs;
use tauri::Manager;

use crate::fs_utils::atomic_write;
use crate::settings::get_personal_dictionary_path;

/// A personal dictionary entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersonalDictionaryEntry {
    pub word: String,
    pub added_at: i64,
}

/// Personal dictionary stored on disk
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersonalDictionary {
    pub version: i32,
    pub words: Vec<PersonalDictionaryEntry>,
}

impl Default for PersonalDictionary {
    fn default() -> Self {
        Self {
            version: 1,
            words: Vec::new(),
        }
    }
}

/// Read personal dictionary from disk
#[tauri::command]
pub(crate) fn jot_read_personal_dictionary(app: tauri::AppHandle) -> Result<Option<PersonalDictionary>, String> {
    let dict_path = get_personal_dictionary_path(&app)?;

    if !dict_path.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(&dict_path)
        .map_err(|e| format!("Failed to read personal dictionary: {}", e))?;

    let dict: PersonalDictionary = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse personal dictionary: {}", e))?;

    Ok(Some(dict))
}

/// Add a word to the personal dictionary
#[tauri::command]
pub(crate) fn jot_add_to_personal_dictionary(app: tauri::AppHandle, word: String) -> Result<(), String> {
    let dict_path = get_personal_dictionary_path(&app)?;
    let app_data_dir = app.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    // Create directory if needed
    fs::create_dir_all(&app_data_dir)
        .map_err(|e| format!("Failed to create app data dir: {}", e))?;

    // Load existing dictionary or create new
    let mut dict = if dict_path.exists() {
        let content = fs::read_to_string(&dict_path)
            .map_err(|e| format!("Failed to read personal dictionary: {}", e))?;
        serde_json::from_str(&content)
            .unwrap_or_else(|_| PersonalDictionary::default())
    } else {
        PersonalDictionary::default()
    };

    // Check if word already exists (case-insensitive)
    let word_lower = word.to_lowercase();
    if dict.words.iter().any(|e| e.word.to_lowercase() == word_lower) {
        return Ok(()); // Already exists
    }

    // Add word
    dict.words.push(PersonalDictionaryEntry {
        word,
        added_at: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis() as i64)
            .unwrap_or(0),
    });

    // Save
    let content = serde_json::to_string_pretty(&dict)
        .map_err(|e| format!("Failed to serialize personal dictionary: {}", e))?;

    atomic_write(
        dict_path.to_str().ok_or("Invalid dictionary path")?,
        &content
    )
}

/// Remove a word from the personal dictionary
#[tauri::command]
pub(crate) fn jot_remove_from_personal_dictionary(app: tauri::AppHandle, word: String) -> Result<(), String> {
    let dict_path = get_personal_dictionary_path(&app)?;

    if !dict_path.exists() {
        return Ok(()); // Nothing to remove
    }

    let content = fs::read_to_string(&dict_path)
        .map_err(|e| format!("Failed to read personal dictionary: {}", e))?;

    let mut dict: PersonalDictionary = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse personal dictionary: {}", e))?;

    // Remove word (case-insensitive)
    let word_lower = word.to_lowercase();
    dict.words.retain(|e| e.word.to_lowercase() != word_lower);

    // Save
    let content = serde_json::to_string_pretty(&dict)
        .map_err(|e| format!("Failed to serialize personal dictionary: {}", e))?;

    atomic_write(
        dict_path.to_str().ok_or("Invalid dictionary path")?,
        &content
    )
}
