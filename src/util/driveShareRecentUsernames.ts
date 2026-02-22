import { MAIN_IDB_STORE } from './browser/idb';

const MAX_RECENT_USERNAMES = 8;

const buildStorageKey = (userId?: string) => `driveShareRecentUsernames:${userId || 'anonymous'}`;

export async function getDriveShareRecentUsernames(userId?: string) {
  const stored = await MAIN_IDB_STORE.get<string[]>(buildStorageKey(userId));

  if (!Array.isArray(stored)) {
    return [];
  }

  return stored.filter(Boolean).slice(0, MAX_RECENT_USERNAMES);
}

export async function rememberDriveShareUsername(username: string, userId?: string) {
  const normalizedUsername = username.trim().replace(/^@/, '').toLowerCase();

  if (!normalizedUsername) {
    return;
  }

  const current = await getDriveShareRecentUsernames(userId);
  const next = [normalizedUsername, ...current.filter((item) => item !== normalizedUsername)]
    .slice(0, MAX_RECENT_USERNAMES);

  await MAIN_IDB_STORE.set(buildStorageKey(userId), next);
}