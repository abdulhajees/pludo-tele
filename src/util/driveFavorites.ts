const DRIVE_FAVORITE_META_PREFIX = 'pludo-drive-favorite-meta:';

export type DriveFavoriteEntry = {
  version: 1;
  sourceChatId: string;
  messageId: number;
  fileName?: string;
  addedAt: number;
};

export function buildDriveFavoriteMessage(entry: DriveFavoriteEntry) {
  const title = entry.fileName
    ? `❤️ Drive favorite: ${entry.fileName}`
    : '❤️ Drive favorite';

  return `${title}\n${DRIVE_FAVORITE_META_PREFIX}${JSON.stringify(entry)}`;
}

export function parseDriveFavoriteMessage(text?: string) {
  if (!text) return undefined;

  const markerLine = text.split('\n').find((line) => line.startsWith(DRIVE_FAVORITE_META_PREFIX));
  if (!markerLine) return undefined;

  const encoded = markerLine.slice(DRIVE_FAVORITE_META_PREFIX.length).trim();
  if (!encoded) return undefined;

  try {
    const parsed = JSON.parse(encoded) as Partial<DriveFavoriteEntry>;
    if (
      parsed.version !== 1
      || !parsed.sourceChatId
      || !parsed.messageId
    ) {
      return undefined;
    }

    return {
      version: 1 as const,
      sourceChatId: parsed.sourceChatId,
      messageId: parsed.messageId,
      fileName: parsed.fileName,
      addedAt: parsed.addedAt || 0,
    };
  } catch {
    return undefined;
  }
}