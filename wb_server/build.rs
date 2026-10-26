use std::time::{SystemTime, UNIX_EPOCH};

fn main() {
    // sqlx::migrate! embeds these files; rebuild when one is added or edited.
    println!("cargo:rerun-if-changed=../migrations");
    // Stamp each build of the server, shown by /api/status.
    println!("cargo:rerun-if-changed=src");
    let built = SystemTime::now().duration_since(UNIX_EPOCH).map_or(0, |d| d.as_secs());
    println!("cargo:rustc-env=WB_BUILD_UNIX_TIME={built}");
}
