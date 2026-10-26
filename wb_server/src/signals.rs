//! "Board N changed": a nudge from whoever wrote to a board to every WebSocket
//! watching it. The nudge carries nothing; each watcher re-reads the database
//! from its own `since`, so the database stays the only record of the lines.
//!
//! Each watched board has a `watch` channel. A watch channel keeps only "changed
//! since you last looked", so a burst of writes costs a slow watcher one query,
//! and it can never fall behind. Senders and receivers may be on any of tokio's
//! worker threads; a send wakes every waiting task wherever it next runs.

use std::collections::HashMap;
use std::sync::{Arc, Mutex, MutexGuard, PoisonError};

use tokio::sync::watch;

#[derive(Clone, Default)]
pub struct BoardSignals(Arc<Mutex<HashMap<i32, watch::Sender<()>>>>);

impl BoardSignals {
    /// Tell the board's watchers to look. Call only after the write committed,
    /// or a watcher could look too early and miss it until the next change.
    pub fn notify(&self, board: i32) {
        if let Some(sender) = self.map().get(&board) {
            sender.send_replace(());
        }
    }

    pub fn subscribe(&self, board: i32) -> Changes {
        let rx = self.map().entry(board).or_insert_with(|| watch::channel(()).0).subscribe();
        Changes { rx, board, signals: self.clone() }
    }

    /// Boards with watchers right now.
    #[cfg(test)]
    pub fn watched(&self) -> usize {
        self.map().len()
    }

    fn map(&self) -> MutexGuard<'_, HashMap<i32, watch::Sender<()>>> {
        self.0.lock().unwrap_or_else(PoisonError::into_inner)
    }
}

/// One watcher's view of a board. Dropping the last one forgets the board.
pub struct Changes {
    rx: watch::Receiver<()>,
    board: i32,
    signals: BoardSignals,
}

impl Changes {
    /// Count everything so far as seen. Do this before reading the database,
    /// so a write that lands during the read still wakes `changed`.
    pub fn mark_seen(&mut self) {
        self.rx.mark_unchanged();
    }

    /// Wait for a change since the last `mark_seen` or `changed`.
    pub async fn changed(&mut self) {
        if self.rx.changed().await.is_err() {
            // The sender lives until the last receiver goes, so this can't
            // happen; if it ever does, just never wake.
            std::future::pending::<()>().await;
        }
    }
}

impl Drop for Changes {
    fn drop(&mut self) {
        let mut map = self.signals.map();
        // `self.rx` still counts here: it's dropped after this runs.
        if map.get(&self.board).is_some_and(|sender| sender.receiver_count() <= 1) {
            map.remove(&self.board);
        }
    }
}

#[cfg(test)]
mod tests {
    use std::time::Duration;

    use super::*;

    async fn woken(changes: &mut Changes) -> bool {
        tokio::time::timeout(Duration::from_millis(50), changes.changed()).await.is_ok()
    }

    #[tokio::test]
    async fn notifying_a_board_wakes_its_watchers_only() {
        let signals = BoardSignals::default();
        let mut a1 = signals.subscribe(1);
        let mut a2 = signals.subscribe(1);
        let mut b = signals.subscribe(2);
        signals.notify(1);
        assert!(woken(&mut a1).await);
        assert!(woken(&mut a2).await);
        assert!(!woken(&mut b).await);
        assert!(!woken(&mut a1).await, "one notify, one wake");
    }

    #[tokio::test]
    async fn a_burst_of_notifies_is_one_wake() {
        let signals = BoardSignals::default();
        let mut changes = signals.subscribe(1);
        for _ in 0..10 {
            signals.notify(1);
        }
        assert!(woken(&mut changes).await);
        assert!(!woken(&mut changes).await);
    }

    #[tokio::test]
    async fn mark_seen_forgets_earlier_notifies() {
        let signals = BoardSignals::default();
        let mut changes = signals.subscribe(1);
        signals.notify(1);
        changes.mark_seen();
        assert!(!woken(&mut changes).await);
    }

    #[test]
    fn boards_are_forgotten_when_their_last_watcher_goes() {
        let signals = BoardSignals::default();
        signals.notify(9); // nobody watching: a no-op, and no entry made
        assert_eq!(signals.watched(), 0);
        let first = signals.subscribe(1);
        let second = signals.subscribe(1);
        assert_eq!(signals.watched(), 1);
        drop(first);
        assert_eq!(signals.watched(), 1);
        drop(second);
        assert_eq!(signals.watched(), 0);
    }
}
