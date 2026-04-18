// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::{Path, PathBuf};

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn comfyui_post(url: String, body: String) -> Result<String, String> {
    let client = reqwest::Client::new();
    
    let response = client
        .post(&url)
        .header("Content-Type", "application/json")
        .body(body)
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;
    
    let status = response.status();
    let resp_body = response.text().await.map_err(|e| format!("读取响应失败: {}", e))?;
    
    if status.is_success() {
        Ok(resp_body)
    } else {
        Err(format!("请求失败 ({}): {}", status, resp_body))
    }
}

#[tauri::command]
async fn comfyui_get(url: String) -> Result<String, String> {
    let client = reqwest::Client::new();
    
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;
    
    let status = response.status();
    let body = response.text().await.map_err(|e| format!("读取响应失败: {}", e))?;
    
    if status.is_success() {
        Ok(body)
    } else {
        Err(format!("请求失败 ({}): {}", status, body))
    }
}

#[tauri::command]
async fn copy_file_to_path(dest_path: String, file_name: String, content_base64: String) -> Result<String, String> {
    // Decode base64 content
    let content = base64_decode(&content_base64).map_err(|e| format!("Base64解码失败: {}", e))?;
    
    // Normalize path: convert forward slashes to backslashes for Windows
    let normalized_path = dest_path.replace("/", "\\");
    
    // Build full path
    let mut full_path = PathBuf::from(&normalized_path);
    full_path = full_path.join(&file_name);
    
    // Create parent directory if not exists
    if let Some(parent) = full_path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("创建目录失败: {}", e))?;
    }
    
    // Write file
    fs::write(&full_path, content).map_err(|e| format!("写入文件失败: {}", e))?;
    
    Ok(format!("文件已保存到: {:?}", full_path))
}

fn base64_decode(input: &str) -> Result<Vec<u8>, String> {
    // 使用标准 base64 crate 解码（替代有 bug 的自定义实现）
    use base64::Engine;
    base64::engine::general_purpose::STANDARD
        .decode(input.trim())
        .map_err(|e| format!("Base64 解码失败: {}", e))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, comfyui_post, comfyui_get, copy_file_to_path])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
