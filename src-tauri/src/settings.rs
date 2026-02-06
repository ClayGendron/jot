use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::Manager;

use crate::fs_utils::atomic_write;

/// A recent workspace entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecentWorkspace {
    pub path: String,
    pub name: String,
    pub last_opened: i64, // Unix timestamp in milliseconds
}

/// Layout preferences for panels
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LayoutPreferences {
    pub sidebar_width: i32,
    pub sidebar_open: bool,
}

impl Default for LayoutPreferences {
    fn default() -> Self {
        Self {
            sidebar_width: 260,
            sidebar_open: true,
        }
    }
}

/// A persisted tab entry for session restore
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersistedTab {
    pub file_path: String,
    pub is_pinned: bool,
}

/// State for restoring open tabs
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PersistedTabState {
    pub tabs: Vec<PersistedTab>,
    pub active_tab_path: Option<String>,
}

/// Appearance preferences for theme and typography
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppearancePreferences {
    pub theme: String,
    pub theme_name: String,
    #[serde(default)]
    pub accent_color_id: Option<String>,
    pub font_family: String,
    pub font_size: i32,
    pub line_height: f64,
    pub max_line_width: i32,
    pub typewriter_mode: bool,
    #[serde(default = "default_copy_format")]
    pub default_copy_format: String,
    #[serde(default = "default_spell_check_enabled")]
    pub spell_check_enabled: bool,
    #[serde(default = "default_spell_check_language")]
    pub spell_check_language: String,
    #[serde(default = "default_grammar_check_enabled")]
    pub grammar_check_enabled: bool,
    #[serde(default = "default_grammar_dialect")]
    pub grammar_dialect: String,
}

fn default_copy_format() -> String {
    "formatted".to_string()
}

fn default_spell_check_enabled() -> bool {
    true
}

fn default_spell_check_language() -> String {
    "en_US".to_string()
}

fn default_grammar_check_enabled() -> bool {
    true
}

fn default_grammar_dialect() -> String {
    "american".to_string()
}

impl Default for AppearancePreferences {
    fn default() -> Self {
        Self {
            theme: "system".to_string(),
            theme_name: "paper".to_string(),
            accent_color_id: None,
            font_family: "serif".to_string(),
            font_size: 18,
            line_height: 1.8,
            max_line_width: 72,
            typewriter_mode: false,
            default_copy_format: default_copy_format(),
            spell_check_enabled: default_spell_check_enabled(),
            spell_check_language: default_spell_check_language(),
            grammar_check_enabled: default_grammar_check_enabled(),
            grammar_dialect: default_grammar_dialect(),
        }
    }
}

/// Global application settings (stored in app data directory)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GlobalAppSettings {
    pub recent_workspaces: Vec<RecentWorkspace>,
    pub default_workspace_path: Option<String>,
    #[serde(default)]
    pub layout: Option<LayoutPreferences>,
    #[serde(default)]
    pub appearance: Option<AppearancePreferences>,
    #[serde(default)]
    pub open_tabs: Option<PersistedTabState>,
    pub version: i32,
}

impl Default for GlobalAppSettings {
    fn default() -> Self {
        Self {
            recent_workspaces: Vec::new(),
            default_workspace_path: None,
            layout: Some(LayoutPreferences::default()),
            appearance: Some(AppearancePreferences::default()),
            open_tabs: None,
            version: 1,
        }
    }
}

/// Per-workspace settings (stored in .jot/config.json)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceSettings {
    pub version: i32,
}

impl Default for WorkspaceSettings {
    fn default() -> Self {
        Self {
            version: 1,
        }
    }
}

/// Get the app data directory path
#[tauri::command]
pub(crate) fn jot_get_app_data_dir(app: tauri::AppHandle) -> Result<String, String> {
    let path = app.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    Ok(path.to_string_lossy().to_string())
}

/// Read global application settings
#[tauri::command]
pub(crate) fn jot_read_global_settings(app: tauri::AppHandle) -> Result<Option<GlobalAppSettings>, String> {
    let app_data_dir = app.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    let settings_path = app_data_dir.join("settings.json");

    if !settings_path.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(&settings_path)
        .map_err(|e| format!("Failed to read settings: {}", e))?;

    let settings: GlobalAppSettings = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse settings: {}", e))?;

    Ok(Some(settings))
}

/// Write global application settings
#[tauri::command]
pub(crate) fn jot_write_global_settings(app: tauri::AppHandle, settings: GlobalAppSettings) -> Result<(), String> {
    let app_data_dir = app.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    // Create directory if it doesn't exist
    fs::create_dir_all(&app_data_dir)
        .map_err(|e| format!("Failed to create app data dir: {}", e))?;

    let settings_path = app_data_dir.join("settings.json");

    let content = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;

    // Use atomic_write helper for Windows compatibility
    atomic_write(
        settings_path.to_str().ok_or("Invalid settings path")?,
        &content
    )
}

/// Read per-workspace settings from .jot/config.json
#[tauri::command]
pub(crate) fn jot_read_workspace_settings(workspace_path: &str) -> Result<Option<WorkspaceSettings>, String> {
    let jot_dir = Path::new(workspace_path).join(".jot");
    let config_path = jot_dir.join("config.json");

    if !config_path.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(&config_path)
        .map_err(|e| format!("Failed to read workspace settings: {}", e))?;

    let settings: WorkspaceSettings = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse workspace settings: {}", e))?;

    Ok(Some(settings))
}

/// Write per-workspace settings to .jot/config.json
#[tauri::command]
pub(crate) fn jot_write_workspace_settings(workspace_path: &str, settings: WorkspaceSettings) -> Result<(), String> {
    let jot_dir = Path::new(workspace_path).join(".jot");

    // Create .jot directory if it doesn't exist
    fs::create_dir_all(&jot_dir)
        .map_err(|e| format!("Failed to create .jot directory: {}", e))?;

    let config_path = jot_dir.join("config.json");

    let content = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("Failed to serialize workspace settings: {}", e))?;

    // Use atomic_write helper for Windows compatibility
    atomic_write(
        config_path.to_str().ok_or("Invalid config path")?,
        &content
    )
}

/// Check if a directory exists and is valid
#[tauri::command]
pub(crate) fn jot_directory_exists(path: &str) -> bool {
    let p = Path::new(path);
    p.exists() && p.is_dir()
}

/// Get the personal dictionary file path
pub(crate) fn get_personal_dictionary_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    Ok(app_data_dir.join("personal-dictionary.json"))
}
