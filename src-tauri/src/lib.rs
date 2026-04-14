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
    // Simple base64 decoder
    const BASE64_TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    
    let input = input.trim();
    let mut output = Vec::new();
    let mut buffer: u32 = 0;
    let mut bits_collected = 0;
    
    for c in input.chars() {
        if c == '=' || c.is_whitespace() {
            continue;
        }
        
        let value = match BASE64_TABLE.iter().position(|&x| x as char == c) {
            Some(v) => v as u32,
            None => return Err(format!("Invalid base64 character: {}", c)),
        };
        
        buffer = (buffer << 6) | value;
        bits_collected += 6;
        
        if bits_collected >= 8 {
            bits_collected -= 8;
            output.push((buffer >> bits_collected) as u8);
        }
    }
    
    Ok(output)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, comfyui_post, comfyui_get, copy_file_to_path])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
