//! Opaque session key store inside WebAssembly worker memory.
//!
//! Non-negotiable boundary:
//! "Keys never leave the browser and never enter route paths, query params,
//! document titles, telemetry or general React state. Use opaque handles."

use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use vinca_core::{Network, RetainedOrchardKey, VincaError};

static NEXT_HANDLE_ID: AtomicU64 = AtomicU64::new(1);

struct StoredKey {
    key: RetainedOrchardKey,
    network: Network,
}

static KEY_STORE: Mutex<Option<HashMap<String, StoredKey>>> = Mutex::new(None);

/// Stores a retained Orchard key and returns an unguessable opaque handle string.
pub fn store_key(key: RetainedOrchardKey, network: Network) -> String {
    let id = NEXT_HANDLE_ID.fetch_add(1, Ordering::SeqCst);
    let handle = format!("vinca-handle-{:016x}", id);

    let mut lock = KEY_STORE.lock().unwrap_or_else(|p| p.into_inner());
    let map = lock.get_or_insert_with(HashMap::new);
    map.insert(handle.clone(), StoredKey { key, network });

    handle
}

/// Executes a closure with a reference to the retained key held behind an opaque handle.
pub fn with_key<F, R>(handle: &str, f: F) -> Result<R, VincaError>
where
    F: FnOnce(&RetainedOrchardKey, Network) -> Result<R, VincaError>,
{
    let mut lock = KEY_STORE.lock().unwrap_or_else(|p| p.into_inner());
    let map = lock.get_or_insert_with(HashMap::new);
    let key = map
        .get(handle)
        .ok_or_else(|| VincaError::HandleNotFound(handle.to_string()))?;

    f(&key.key, key.network)
}

/// Revokes and drops the key associated with an opaque handle.
pub fn revoke_key(handle: &str) -> bool {
    let mut lock = KEY_STORE.lock().unwrap_or_else(|p| p.into_inner());
    let map = lock.get_or_insert_with(HashMap::new);
    map.remove(handle).is_some()
}

/// Clears all keys stored in the WASM worker memory (e.g. on workspace lock).
pub fn clear_all_keys() {
    let mut lock = KEY_STORE.lock().unwrap_or_else(|p| p.into_inner());
    if let Some(map) = lock.as_mut() {
        map.clear();
    }
}
