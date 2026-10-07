// A copy of what the signed-in user last saw (profile, feed, notifications,
// prayers...), saved after every successful load. On the next launch the
// app paints Home from it immediately, then swaps in fresh data -- and if
// there's no connection at all, the snapshot is what stays on screen
// instead of a blank feed or the sign-in screen.
//
// Keyed to one user id, so a different account signing in on the same
// device never sees it; cleared outright on sign-out.
import { supabase } from './supabase';

const KEY = 'crescamus-offline-snapshot-v1';
const MAX_POSTS = 40;
const MAX_NOTIFICATIONS = 50;

export function saveSnapshot(userId, profile, data) {
  const trimmed = {
    ...data,
    feed: (data.feed || []).slice(0, MAX_POSTS),
    notifications: (data.notifications || []).slice(0, MAX_NOTIFICATIONS),
  };
  try {
    localStorage.setItem(KEY, JSON.stringify({ userId, savedAt: Date.now(), profile, data: trimmed }));
  } catch {
    // Storage full or disabled -- offline launches just won't have a
    // snapshot to show. Not worth surfacing.
  }
}

export function loadSnapshot(userId) {
  try {
    const snapshot = JSON.parse(localStorage.getItem(KEY));
    return snapshot && snapshot.userId === userId ? snapshot : null;
  } catch {
    return null;
  }
}

export function clearSnapshot() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // nothing to clear
  }
}

// The session supabase-js still has saved on this device, even when its
// access token has expired. getSession() returns null for that case if it
// can't reach the server to refresh the token -- which is every offline
// launch more than an hour after the last one -- but the session itself
// is still valid and gets refreshed automatically once back online.
export function readStoredSession() {
  if (!supabase) return null;
  try {
    const stored = JSON.parse(localStorage.getItem(supabase.auth.storageKey));
    return stored?.user?.id && stored.refresh_token ? stored : null;
  } catch {
    return null;
  }
}

// Network failure (offline, DNS, timeout) as opposed to the server
// actually answering with an error.
export function isNetworkError(error) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  if (!error) return false;
  if (error.name === 'AuthRetryableFetchError') return true;
  const message = String(error.message || error);
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed/i.test(message);
}
