import { get, set } from 'idb-keyval';
import type { ApiChat } from '../../../api/types';
import { useCallback, useEffect, useState } from '../../../lib/teact/teact';

const PERMISSIONS_KEY = 'pludo_drive_space_permissions';

export type SpacePermissions = {
    isAdmin: boolean;
};

let permissionsCache: Record<string, SpacePermissions> = {};
let isInitialized = false;

// Observers to trigger react re-renders when permissions update
const observers = new Set<() => void>();

const notifyObservers = () => {
    observers.forEach(cb => cb());
};

export const initDrivePermissions = async () => {
    if (isInitialized) return;
    try {
        const stored = await get<Record<string, SpacePermissions>>(PERMISSIONS_KEY);
        if (stored) {
            permissionsCache = stored;
            notifyObservers();
        }
    } catch (err) {
        console.error('Failed to init Drive Permissions IDB:', err);
    }
    isInitialized = true;
};

export const syncSpacePermissions = async (chat: ApiChat) => {
    // If user is creator or has ANY admin rights, they are considered an Admin of the space.
    const isValidAdmin = chat.adminRights ? Object.values(chat.adminRights).some(Boolean) : false;
    const isAdmin = Boolean(chat.isCreator || isValidAdmin);

    // Only update IDB if it has changed to avoid unnecessary writes
    if (!permissionsCache[chat.id] || permissionsCache[chat.id].isAdmin !== isAdmin) {
        permissionsCache = {
            ...permissionsCache,
            [chat.id]: { isAdmin }
        };

        try {
            await set(PERMISSIONS_KEY, permissionsCache);
        } catch (err) {
            console.error('Failed to save Drive Permissions IDB:', err);
        }

        notifyObservers();
    }
};

export const useSpacePermissions = (chatId?: string) => {
    const [permissions, setPermissions] = useState<SpacePermissions>(() => {
        return chatId ? (permissionsCache[chatId] || { isAdmin: false }) : { isAdmin: false };
    });

    useEffect(() => {
        if (!chatId) return;

        const handleChange = () => {
            const current = permissionsCache[chatId] || { isAdmin: false };
            setPermissions((prev: SpacePermissions) => prev.isAdmin === current.isAdmin ? prev : current);
        };

        observers.add(handleChange);
        handleChange(); // Initial check in case it updated before mount

        return () => {
            observers.delete(handleChange);
        };
    }, [chatId]);

    return permissions;
};

export const useAllSpacePermissions = () => {
    const [allPerms, setAllPerms] = useState<Record<string, SpacePermissions>>(permissionsCache);

    useEffect(() => {
        const handleChange = () => {
            setAllPerms({ ...permissionsCache });
        };

        observers.add(handleChange);
        return () => {
            observers.delete(handleChange);
        };
    }, []);

    return allPerms;
};
