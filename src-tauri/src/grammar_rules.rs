use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

use crate::fs_utils::atomic_write;

/// An ignored grammar rule entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IgnoredRuleEntry {
    pub rule_id: String,
    pub added_at: i64,
}

/// Ignored grammar rules stored on disk
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IgnoredGrammarRules {
    pub version: i32,
    pub rules: Vec<IgnoredRuleEntry>,
}

impl Default for IgnoredGrammarRules {
    fn default() -> Self {
        Self {
            version: 1,
            rules: Vec::new(),
        }
    }
}

/// Get the ignored grammar rules file path
fn get_ignored_rules_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    Ok(app_data_dir.join("ignored-grammar-rules.json"))
}

/// Read ignored grammar rules from disk
#[tauri::command]
pub(crate) fn jot_read_ignored_grammar_rules(app: tauri::AppHandle) -> Result<Option<IgnoredGrammarRules>, String> {
    let rules_path = get_ignored_rules_path(&app)?;

    if !rules_path.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(&rules_path)
        .map_err(|e| format!("Failed to read ignored grammar rules: {}", e))?;

    let rules: IgnoredGrammarRules = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse ignored grammar rules: {}", e))?;

    Ok(Some(rules))
}

/// Add a rule to the ignored grammar rules
#[tauri::command]
pub(crate) fn jot_add_ignored_grammar_rule(app: tauri::AppHandle, rule_id: String) -> Result<(), String> {
    let rules_path = get_ignored_rules_path(&app)?;
    let app_data_dir = app.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    // Create directory if needed
    if !app_data_dir.exists() {
        fs::create_dir_all(&app_data_dir)
            .map_err(|e| format!("Failed to create app data dir: {}", e))?;
    }

    // Load existing or create new
    let mut rules = if rules_path.exists() {
        let content = fs::read_to_string(&rules_path)
            .map_err(|e| format!("Failed to read ignored grammar rules: {}", e))?;
        serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse ignored grammar rules: {}", e))?
    } else {
        IgnoredGrammarRules::default()
    };

    // Check if already exists
    if !rules.rules.iter().any(|e| e.rule_id == rule_id) {
        rules.rules.push(IgnoredRuleEntry {
            rule_id,
            added_at: chrono::Utc::now().timestamp_millis(),
        });
    }

    // Save
    let content = serde_json::to_string_pretty(&rules)
        .map_err(|e| format!("Failed to serialize ignored grammar rules: {}", e))?;

    atomic_write(
        rules_path.to_str().ok_or("Invalid rules path")?,
        &content
    )
}

/// Remove a rule from the ignored grammar rules
#[tauri::command]
pub(crate) fn jot_remove_ignored_grammar_rule(app: tauri::AppHandle, rule_id: String) -> Result<(), String> {
    let rules_path = get_ignored_rules_path(&app)?;

    if !rules_path.exists() {
        return Ok(()); // Nothing to remove
    }

    let content = fs::read_to_string(&rules_path)
        .map_err(|e| format!("Failed to read ignored grammar rules: {}", e))?;

    let mut rules: IgnoredGrammarRules = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse ignored grammar rules: {}", e))?;

    // Remove rule
    rules.rules.retain(|e| e.rule_id != rule_id);

    // Save
    let content = serde_json::to_string_pretty(&rules)
        .map_err(|e| format!("Failed to serialize ignored grammar rules: {}", e))?;

    atomic_write(
        rules_path.to_str().ok_or("Invalid rules path")?,
        &content
    )
}
