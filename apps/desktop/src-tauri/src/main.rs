// Previene l'apertura della console su Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("errore nell'avvio di BNS Studio OS");
}
