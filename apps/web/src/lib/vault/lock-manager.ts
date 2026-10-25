/*
  vault/lock-manager.ts — Inactivity lock manager for the Vinca encrypted vault.

  Policy (PRD §6)
  ───────────────
  • Workspace locks automatically after 10 minutes of user inactivity.
  • Activity signals: mousemove, keydown, pointerdown, scroll, touchstart.
  • On lock:
      1. Calls the registered `onLock` callback (which clears the vault key
         from memory, cancels in-flight jobs, and clears private UI state).
      2. Resets the inactivity timer so a fresh unlock restarts it cleanly.

  Usage
  ─────
    const manager = createInactivityLockManager(() => vault.lock());
    manager.start();
    // … later …
    manager.stop();

  The lock manager does not hold any private data itself. The `onLock` callback
  is responsible for clearing key material and worker handles.
*/

/** Duration of inactivity (ms) before the vault is automatically locked. */
export const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1_000; // 10 minutes

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  "mousemove",
  "keydown",
  "pointerdown",
  "scroll",
  "touchstart",
];

export interface InactivityLockManager {
  /** Registers activity listeners and starts the inactivity timer. */
  start(): void;
  /** Removes activity listeners and clears the timer (e.g. on explicit lock or page unload). */
  stop(): void;
  /** Resets the inactivity timer without stopping (call after any explicit activity). */
  resetTimer(): void;
}

/**
 * Creates an inactivity lock manager.
 *
 * @param onLock — Called when the inactivity timer fires. Must clear all
 *                 private state (key material, WASM handles, private UI state).
 * @param timeoutMs — Override for testing; defaults to 10 minutes.
 */
export function createInactivityLockManager(
  onLock: () => void,
  timeoutMs: number = INACTIVITY_TIMEOUT_MS,
): InactivityLockManager {
  let timerId: ReturnType<typeof setTimeout> | null = null;

  function fire() {
    timerId = null;
    onLock();
  }

  function schedule() {
    if (timerId !== null) clearTimeout(timerId);
    timerId = setTimeout(fire, timeoutMs);
  }

  function handleActivity() {
    schedule();
  }

  return {
    start() {
      for (const evt of ACTIVITY_EVENTS) {
        window.addEventListener(evt, handleActivity, { passive: true });
      }
      schedule();
    },

    stop() {
      if (timerId !== null) {
        clearTimeout(timerId);
        timerId = null;
      }
      for (const evt of ACTIVITY_EVENTS) {
        window.removeEventListener(evt, handleActivity);
      }
    },

    resetTimer() {
      schedule();
    },
  };
}
