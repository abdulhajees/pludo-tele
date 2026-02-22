import type { ApiMessage } from '../api/types';
import { MAIN_IDB_STORE } from './browser/idb';

const buildStorageKey = (userId?: string) => `driveFavorites:${userId || 'anonymous'}`;

export type DriveFavoriteStoredItem = {
  key: string;
  sourceChatId: string;
  sourceTitle?: string;
  messageId: number;
  savedMsgId?: number;
  fileName?: string;
  file: ApiMessage;
  addedAt: number;
};

export async function getDriveFavoriteItems(userId?: string) {
  const stored = await MAIN_IDB_STORE.get<Record<string, DriveFavoriteStoredItem>>(buildStorageKey(userId));

  if (!stored || typeof stored !== 'object') {
    return {};
  }

  return stored;
}

export async function upsertDriveFavoriteItem(
  item: Omit<DriveFavoriteStoredItem, 'key' | 'addedAt'>,
  userId?: string,
) {
  const key = `${item.sourceChatId}:${item.messageId}`;

  await MAIN_IDB_STORE.update<Record<string, DriveFavoriteStoredItem>>(
    buildStorageKey(userId),
    (previous) => {
      const byKey = previous || {};
      const existing = byKey[key];

      return {
        ...byKey,
        [key]: {
          key,
          sourceChatId: item.sourceChatId,
          sourceTitle: item.sourceTitle,
          messageId: item.messageId,
          savedMsgId: item.savedMsgId ?? existing?.savedMsgId,
          fileName: item.fileName,
          file: item.file,
          addedAt: existing?.addedAt || Date.now(),
        },
      };
    },
  );
}

export async function removeDriveFavoriteItem(key: string, userId?: string) {
  await MAIN_IDB_STORE.update<Record<string, DriveFavoriteStoredItem>>(
    buildStorageKey(userId),
    (previous) => {
      if (!previous) return {};
      const next = { ...previous };
      delete next[key];
      return next;
    },
  );
}