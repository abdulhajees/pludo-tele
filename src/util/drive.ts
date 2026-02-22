const DRIVE_PREFIX = 'pludo-drive_';
const DRIVE_BASE_PREFIX = 'pludo-drive';
const DRIVE_SHARE_PREFIX = 'pludo-drive-share_';
const DRIVE_P2P_PREFIX = '---p2p_';
const DRIVE_P2P_REGEX = /^---p2p_([a-z0-9_]+)---([a-z0-9_]+)$/i;
const DRIVE_META_PREFIX = 'pludo-drive-meta:';

type DriveChatKind = 'space' | 'share';

type DriveMetadata = {
  version: 1;
  kind: DriveChatKind;
  senderUsername?: string;
  receiverUsername?: string;
};

export type DriveSection = 'my_files' | 'sharing' | 'recent' | 'favorites' | 'notifications';
export type DriveSectionUi = 'my-files' | 'sharing' | 'recent' | 'favorites' | 'notifications';

function parseDriveMetadata(about?: string): DriveMetadata | undefined {
  if (!about) return undefined;

  const markerLine = about.split('\n').find((line) => line.startsWith(DRIVE_META_PREFIX));
  if (!markerLine) return undefined;

  const encoded = markerLine.slice(DRIVE_META_PREFIX.length).trim();
  if (!encoded) return undefined;

  try {
    const parsed = JSON.parse(encoded) as Partial<DriveMetadata>;

    if (parsed.version !== 1 || (parsed.kind !== 'space' && parsed.kind !== 'share')) {
      return undefined;
    }

    return {
      version: 1,
      kind: parsed.kind,
      senderUsername: parsed.senderUsername?.toLowerCase(),
      receiverUsername: parsed.receiverUsername?.toLowerCase(),
    };
  } catch {
    return undefined;
  }
}

function stringifyDriveMetadata(metadata: DriveMetadata) {
  return `${DRIVE_META_PREFIX}${JSON.stringify(metadata)}`;
}

function getDriveChatKind(title?: string, about?: string): DriveChatKind | undefined {
  const metadata = parseDriveMetadata(about);
  if (metadata) {
    return metadata.kind;
  }

  if (!title) return undefined;
  const normalizedTitle = title.toLowerCase();

  if (normalizedTitle.startsWith(DRIVE_SHARE_PREFIX) || DRIVE_P2P_REGEX.test(normalizedTitle)) {
    return 'share';
  }

  if (normalizedTitle.startsWith(DRIVE_BASE_PREFIX)) {
    return 'space';
  }

  return undefined;
}

export function isDriveTitle(title?: string) {
  return Boolean(title?.toLowerCase().startsWith(DRIVE_BASE_PREFIX));
}

export function buildDriveSpaceAbout() {
  return stringifyDriveMetadata({
    version: 1,
    kind: 'space',
  });
}

export function buildDriveShareAbout(senderUsername: string, receiverUsername: string) {
  return stringifyDriveMetadata({
    version: 1,
    kind: 'share',
    senderUsername: senderUsername.toLowerCase(),
    receiverUsername: receiverUsername.toLowerCase(),
  });
}

export function isDriveShareTitle(title?: string, about?: string) {
  return getDriveChatKind(title, about) === 'share';
}

export function isDriveFolderTitle(title?: string, about?: string) {
  return getDriveChatKind(title, about) === 'space';
}

export function getDriveDisplayName(title?: string) {
  return title ? title.replace(/^pludo-drive_?/i, '').trim() : '';
}

export function getDriveUiName(title?: string) {
  if (!title) return '';

  return title
    .replace(/^pludo-drive_/i, '')
    .replace(/^pludo-drive/i, '')
    .replace(/^pludo[_\s-]?drive[_\s-]?/i, '')
    .trim();
}

export function buildDriveFolderTitle(name: string) {
  return `${DRIVE_PREFIX}${name}`;
}

export function buildDriveP2PTitle(senderUsername: string, receiverUsername: string) {
  return `---P2P_${senderUsername.toLowerCase()}---${receiverUsername.toLowerCase()}`;
}

export function getDriveShareParticipants(title?: string, about?: string) {
  const metadata = parseDriveMetadata(about);
  if (metadata?.kind === 'share' && metadata.senderUsername && metadata.receiverUsername) {
    return {
      senderUsername: metadata.senderUsername,
      receiverUsername: metadata.receiverUsername,
    };
  }

  if (!title) return undefined;

  const legacyTitle = title.toLowerCase();
  if (legacyTitle.startsWith(DRIVE_SHARE_PREFIX)) {
    const participants = title.slice(DRIVE_SHARE_PREFIX.length).split('_');
    if (participants.length >= 2) {
      return {
        senderUsername: participants[0].toLowerCase(),
        receiverUsername: participants[1].toLowerCase(),
      };
    }
  }

  const match = title.match(DRIVE_P2P_REGEX);
  if (match) {
    return {
      senderUsername: match[1].toLowerCase(),
      receiverUsername: match[2].toLowerCase(),
    };
  }

  return undefined;
}

export function normalizeDriveSection(section?: DriveSection | DriveSectionUi) {
  if (!section) return undefined;
  return section === 'my-files' ? 'my_files' : section;
}

export function normalizeDriveSectionUi(section?: DriveSection | DriveSectionUi) {
  if (!section) return undefined;
  return section === 'my_files' ? 'my-files' : section;
}
