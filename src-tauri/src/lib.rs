// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, comfyui_post, comfyui_get])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
