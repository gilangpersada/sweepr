//! `#[tauri::command]` handlers. Keep these thin: validate input, call a module, return data.

use serde::Serialize;

/// Response of the `ping` command. Serialized as camelCase to match the TypeScript types.
#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PingResponse {
    pub message: String,
    pub app_version: String,
}

/// Health check used to prove the frontend -> backend invoke flow works.
#[tauri::command]
pub fn ping() -> PingResponse {
    PingResponse {
        message: "pong".to_string(),
        app_version: env!("CARGO_PKG_VERSION").to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ping_returns_pong_and_version() {
        let res = ping();
        assert_eq!(res.message, "pong");
        assert_eq!(res.app_version, env!("CARGO_PKG_VERSION"));
    }

    #[test]
    fn ping_serializes_as_camel_case() {
        let json = serde_json::to_value(ping()).unwrap();
        assert_eq!(json["message"], "pong");
        assert!(json.get("appVersion").is_some());
        assert!(json.get("app_version").is_none());
    }
}
