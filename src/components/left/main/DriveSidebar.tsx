import type { FC } from '../../../lib/teact/teact';
import { memo, useRef, useState, useEffect } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';
import { selectCurrentChat, selectTabState, selectUser } from '../../../global/selectors';
import type { ApiChat, ApiUser } from '../../../api/types';
import {
    buildDriveFolderTitle,
    buildDriveSpaceAbout,
    getDriveDisplayName,
    isDriveFolderTitle,
    normalizeDriveSection,
    normalizeDriveSectionUi,
} from '../../../util/drive';
import type { DriveSection, DriveSectionUi } from '../../../util/drive';

import useLang from '../../../hooks/useLang';
import { useClickOutside } from '../../../hooks/events/useOutsideClick';

import DriveCreateSpaceModal from './DriveCreateSpaceModal';
import DriveProfileModal from './DriveProfileModal';
import DriveShareSpaceModal from './DriveShareSpaceModal';
import DriveManageAccessModal from './DriveManageAccessModal';
import ConfirmDialog from '../../ui/ConfirmDialog';
import ProfilePhoto from '../../common/profile/ProfilePhoto';
import './DriveSidebar.scss';

type OwnProps = {
    onSelectFolder: (chatId: string) => void;
    onSectionChange?: (section: DriveSectionUi) => void;
    activeSection?: DriveSectionUi;
};

type StateProps = {
    driveFolders: ApiChat[];
    currentUser?: ApiUser;
    activeChatId?: string;
    driveActiveSection?: DriveSection;
    inviteLinkById: Record<string, string | undefined>;
};

const navigationLinks: { id: DriveSectionUi; icon: string }[] = [
    { id: 'my-files', icon: 'icon-document' },
    { id: 'sharing', icon: 'icon-user' },
    { id: 'recent', icon: 'icon-recent' },
    { id: 'favorites', icon: 'icon-heart' },
    { id: 'notifications', icon: 'icon-info' },
];

function getIsFolderAdmin(folder: ApiChat) {
    const hasAdminRights = folder.adminRights ? Object.values(folder.adminRights).some(Boolean) : false;
    return Boolean(folder.isCreator || hasAdminRights);
}

const DriveSidebar: FC<OwnProps & StateProps> = ({
    driveFolders,
    currentUser,
    activeChatId,
    inviteLinkById,
    driveActiveSection,
    onSelectFolder,
    onSectionChange,
    activeSection = 'my-files',
}) => {
    const lang = useLang();
    const sidebarRef = useRef<HTMLDivElement>();

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [sharingFolderId, setSharingFolderId] = useState<string | undefined>();
    const [manageAccessFolderId, setManageAccessFolderId] = useState<string | undefined>();
    const [folderMenuId, setFolderMenuId] = useState<string | undefined>(undefined);
    const [renamingFolderId, setRenamingFolderId] = useState<string | undefined>(undefined);
    const [renameValue, setRenameValue] = useState('');
    const [dragTargetFolderId, setDragTargetFolderId] = useState<string | undefined>();
    const [confirmDeleteFolderId, setConfirmDeleteFolderId] = useState<string | undefined>();

    useClickOutside([sidebarRef], () => {
        if (!folderMenuId) return;
        setFolderMenuId(undefined);
    });

    useEffect(() => {
        if (!activeChatId && !driveActiveSection) {
            getActions().setDriveActiveSection({ section: 'my_files' });
        }
    }, [activeChatId, driveActiveSection]);

    useEffect(() => {
        getActions().syncDriveChatFolders();
    }, []);

    const handleDragOverFolder = (e: React.DragEvent, folderId: string) => {
        const folder = driveFolders.find((item) => item.id === folderId);
        if (!folder || !getIsFolderAdmin(folder)) return;
        e.preventDefault();
        e.stopPropagation();
        if (dragTargetFolderId !== folderId) setDragTargetFolderId(folderId);
    };

    const handleDragLeaveFolder = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragTargetFolderId(undefined);
    };

    const handleSelectFolder = (folderId: string) => {
        getActions().setDriveActiveSection({ section: undefined });
        onSelectFolder(folderId);
    };

    const handleSectionChange = (sectionId: DriveSectionUi) => {
        getActions().setDriveActiveSection({ section: normalizeDriveSection(sectionId) });
    };

    const handleDropOnFolder = (e: React.DragEvent, folderId: string) => {
        e.preventDefault();
        e.stopPropagation();
        setDragTargetFolderId(undefined);

        const folder = driveFolders.find((item) => item.id === folderId);
        if (!folder || !getIsFolderAdmin(folder)) return;

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const files = Array.from(e.dataTransfer.files);
            window.dispatchEvent(new CustomEvent('ui-drive-upload', { detail: { files, forceAsFile: true, targetChatId: folderId } }));
            onSelectFolder(folderId); // Switch to the folder to show upload progress
        }
    };

    // Copy link moved to Share Modal
    // Rename start/confirm handled below

    const handleRenameStart = (folder: ApiChat) => {
        const displayName = getDriveDisplayName(folder.title);
        setRenameValue(displayName);
        setRenamingFolderId(folder.id);
        setFolderMenuId(undefined);
    };

    const handleRenameConfirm = (folderId: string) => {
        const newName = renameValue.trim();
        if (newName) {
            getActions().updateChat({
                chatId: folderId,
                title: buildDriveFolderTitle(newName),
                about: buildDriveSpaceAbout(),
            });
        }
        setRenamingFolderId(undefined);
    };

    const handleDelete = (folderId: string) => {
        setFolderMenuId(undefined);
        setConfirmDeleteFolderId(folderId);
    };

    const handleConfirmDelete = () => {
        if (confirmDeleteFolderId) {
            getActions().leaveChannel({ chatId: confirmDeleteFolderId });
            setConfirmDeleteFolderId(undefined);
        }
    };

    const userInitials = currentUser
        ? ((currentUser.firstName?.[0] || '') + (currentUser.lastName?.[0] || '')).toUpperCase() || 'U'
        : 'U';

    const userName = currentUser
        ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || lang('HiddenName')
        : lang('HiddenName');

    const normalizedActiveSection = normalizeDriveSectionUi(driveActiveSection);
    const confirmTargetFolder = confirmDeleteFolderId ? driveFolders.find((folder) => folder.id === confirmDeleteFolderId) : undefined;
    const isConfirmDeleteByAdmin = confirmTargetFolder ? getIsFolderAdmin(confirmTargetFolder) : false;

    return (
        <div className="DriveSidebar" onClick={() => setFolderMenuId(undefined)} ref={sidebarRef}>
            <div className="DriveSidebar-logo">
                <span className="logo-brand">{lang('DriveBrand')}</span>
            </div>

            <nav className="DriveSidebar-nav">
                <div
                    className="DriveSidebar-nav-item top-item"
                    onClick={() => onSectionChange?.('my-files')}
                >
                    <i className="icon icon-check-outline" />
                    <span>{lang('DriveNavMyDrive')}</span>
                </div>
            </nav>

            <div className="DriveSidebar-section">
                <span className="section-label">{lang('DriveSectionFiles')}</span>
                {navigationLinks.map((link) => (
                    <div
                        key={link.id}
                        className={`DriveSidebar-nav-item ${normalizedActiveSection === link.id ? 'active' : ''}`}
                        onClick={() => handleSectionChange(link.id)}
                    >
                        <i className={`icon ${link.icon}`} />
                        <span>
                            {link.id === 'my-files' && lang('DriveNavMyFiles')}
                            {link.id === 'sharing' && lang('DriveNavSharing')}
                            {link.id === 'recent' && lang('Recent')}
                            {link.id === 'favorites' && lang('DriveNavFavorites')}
                            {link.id === 'notifications' && lang('Notifications')}
                        </span>
                    </div>
                ))}
            </div>

            <div className="DriveSidebar-section">
                <div className="section-label-row">
                    <span className="section-label">{lang('DriveSectionPrivateSpaces')}</span>
                    <button
                        className="new-folder-btn"
                        onClick={(e) => { e.stopPropagation(); setShowCreateModal(true); }}
                        title={lang('DriveNavNewSpace')}
                    >
                        <i className="icon icon-add" />
                    </button>
                </div>

                {(() => {
                    const privateFolders = driveFolders.filter(f => !f.membersCount || f.membersCount <= 1);
                    return privateFolders.map((folder) => {
                        const folderName = getDriveDisplayName(folder.title) || folder.title;
                        const isActive = folder.id === activeChatId;
                        const isRenaming = renamingFolderId === folder.id;
                        const menuOpen = folderMenuId === folder.id;
                        const isAdmin = getIsFolderAdmin(folder);

                        return (
                            <div
                                key={folder.id}
                                className={`DriveSidebar-folder-item ${isActive ? 'active' : ''} ${dragTargetFolderId === folder.id ? 'drag-over' : ''}`}
                                onClick={() => !isRenaming && handleSelectFolder(folder.id)}
                                onDragOver={(e) => handleDragOverFolder(e, folder.id)}
                                onDragLeave={handleDragLeaveFolder}
                                onDrop={(e) => handleDropOnFolder(e, folder.id)}
                            >
                                <i className="icon icon-folder folder-icon" />

                                {isRenaming ? (
                                    <input
                                        className="folder-rename-input"
                                        value={renameValue}
                                        onChange={(e) => setRenameValue(e.target.value)}
                                        onBlur={() => handleRenameConfirm(folder.id)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleRenameConfirm(folder.id);
                                            if (e.key === 'Escape') setRenamingFolderId(undefined);
                                            e.stopPropagation();
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        autoFocus
                                    />
                                ) : (
                                    <span className="folder-name">{folderName}</span>
                                )}

                                <button
                                    className="folder-menu-btn"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setFolderMenuId(menuOpen ? undefined : folder.id);
                                    }}
                                    title={lang('AccDescrMoreOptions')}
                                >
                                    <i className="icon icon-more" />
                                </button>

                                {menuOpen && (
                                    <div className="folder-context-menu" onClick={(e) => e.stopPropagation()}>
                                        {isAdmin && (
                                            <>
                                                <button className="ctx-item" onClick={() => handleRenameStart(folder)}>
                                                    <i className="icon icon-edit" /> {lang('DriveActionRename')}
                                                </button>
                                                <button className="ctx-item" onClick={() => {
                                                    setFolderMenuId(undefined);
                                                    setSharingFolderId(folder.id);
                                                }}>
                                                    <i className="icon icon-user" /> {lang('DriveActionShareSpace')}
                                                </button>
                                                <button className="ctx-item" onClick={() => {
                                                    setFolderMenuId(undefined);
                                                    setManageAccessFolderId(folder.id);
                                                }}>
                                                    <i className="icon icon-permissions" /> {lang('DriveActionManageAccess')}
                                                </button>
                                                <div className="ctx-divider" />
                                            </>
                                        )}
                                        <button className="ctx-item danger" onClick={() => handleDelete(folder.id)}>
                                            <i className={`icon icon-${isAdmin ? 'delete' : 'arrow-left'}`} /> {isAdmin ? lang('DriveActionDeleteSpace') : lang('DriveActionLeaveSpace')}
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    });
                })()}

                {driveFolders.filter(f => !f.membersCount || f.membersCount <= 1).length === 0 && (
                    <span className="no-folders-hint">{lang('DriveHintNoPrivateSpaces')}</span>
                )}
            </div>

            {(() => {
                const sharedFolders = driveFolders.filter(f => f.membersCount && f.membersCount > 1);
                if (sharedFolders.length === 0) return null;

                return (
                    <div className="DriveSidebar-section split-section">
                        <div className="section-label-row">
                            <span className="section-label">{lang('DriveSectionSharedSpaces')}</span>
                        </div>

                        {sharedFolders.map((folder) => {
                            const folderName = getDriveDisplayName(folder.title) || folder.title;
                            const isActive = folder.id === activeChatId;
                            const isRenaming = renamingFolderId === folder.id;
                            const menuOpen = folderMenuId === folder.id;
                            const isAdmin = getIsFolderAdmin(folder);

                            return (
                                <div
                                    key={folder.id}
                                    className={`DriveSidebar-folder-item ${isActive ? 'active' : ''} ${dragTargetFolderId === folder.id ? 'drag-over' : ''}`}
                                    onClick={() => !isRenaming && onSelectFolder(folder.id)}
                                    onDragOver={(e) => handleDragOverFolder(e, folder.id)}
                                    onDragLeave={handleDragLeaveFolder}
                                    onDrop={(e) => handleDropOnFolder(e, folder.id)}
                                >
                                    <i className="icon icon-users folder-icon shared" />

                                    {isRenaming ? (
                                        <input
                                            className="folder-rename-input"
                                            value={renameValue}
                                            onChange={(e) => setRenameValue(e.target.value)}
                                            onBlur={() => handleRenameConfirm(folder.id)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleRenameConfirm(folder.id);
                                                if (e.key === 'Escape') setRenamingFolderId(undefined);
                                                e.stopPropagation();
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                            autoFocus
                                        />
                                    ) : (
                                        <span className="folder-name">{folderName}</span>
                                    )}

                                    <button
                                        className="folder-menu-btn"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setFolderMenuId(menuOpen ? undefined : folder.id);
                                        }}
                                        title={lang('AccDescrMoreOptions')}
                                    >
                                        <i className="icon icon-more" />
                                    </button>

                                    {menuOpen && (
                                        <div className="folder-context-menu" onClick={(e) => e.stopPropagation()}>
                                            {isAdmin && (
                                                <>
                                                    <button className="ctx-item" onClick={() => handleRenameStart(folder)}>
                                                        <i className="icon icon-edit" /> {lang('DriveActionRename')}
                                                    </button>
                                                    <button className="ctx-item" onClick={() => {
                                                        setFolderMenuId(undefined);
                                                        setSharingFolderId(folder.id);
                                                    }}>
                                                        <i className="icon icon-user" /> {lang('DriveActionShareSpace')}
                                                    </button>
                                                    <button className="ctx-item" onClick={() => {
                                                        setFolderMenuId(undefined);
                                                        setManageAccessFolderId(folder.id);
                                                    }}>
                                                        <i className="icon icon-permissions" /> {lang('DriveActionManageAccess')}
                                                    </button>
                                                    <div className="ctx-divider" />
                                                </>
                                            )}
                                            <button className="ctx-item danger" onClick={() => handleDelete(folder.id)}>
                                                <i className={`icon icon-${isAdmin ? 'delete' : 'arrow-left'}`} /> {isAdmin ? lang('DriveActionDeleteSpace') : lang('DriveActionLeaveSpace')}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                );
            })()}

            <div
                className="DriveSidebar-footer"
                onClick={() => setShowProfileModal(true)}
                title={lang('Settings')}
            >
                {currentUser ? (
                    <ProfilePhoto
                        user={currentUser}
                        theme="light"
                        canPlayVideo={false}
                        className="sidebar-profile-photo"
                        onClick={() => setShowProfileModal(true)}
                    />
                ) : (
                    <div className="user-initials">{userInitials}</div>
                )}
                <div className="user-info">
                    <span className="user-name">{userName}</span>
                    <span className="user-role">{lang('DriveUserRole')}</span>
                </div>
            </div>

            <DriveCreateSpaceModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
            />
            <DriveProfileModal
                isOpen={showProfileModal}
                onClose={() => setShowProfileModal(false)}
            />
            {sharingFolderId && (
                <DriveShareSpaceModal
                    isOpen={true}
                    chatId={sharingFolderId}
                    inviteLink={inviteLinkById[sharingFolderId]}
                    onClose={() => setSharingFolderId(undefined)}
                />
            )}
            {manageAccessFolderId && (
                <DriveManageAccessModal
                    isOpen={true}
                    chatId={manageAccessFolderId}
                    onClose={() => setManageAccessFolderId(undefined)}
                />
            )}
            <ConfirmDialog
                isOpen={!!confirmDeleteFolderId}
                onClose={() => setConfirmDeleteFolderId(undefined)}
                title={isConfirmDeleteByAdmin ? lang('DriveDialogDeleteSpaceTitle') : lang('DriveDialogLeaveSpaceTitle')}
                text={
                    isConfirmDeleteByAdmin
                        ? lang('DriveDialogDeleteSpaceText')
                        : lang('DriveDialogLeaveSpaceText')
                }
                confirmLabel={isConfirmDeleteByAdmin ? lang('DriveDialogDelete') : lang('DriveDialogLeave')}
                confirmHandler={handleConfirmDelete}
            />
        </div>
    );
};

export default memo(withGlobal<OwnProps>(
    (global): StateProps => {
        const allChats = Object.values(global.chats.byId || {});
        const fullInfoById = global.chats.fullInfoById || {};
        const driveFolders = allChats.filter(
            (chat) => chat
                && isDriveFolderTitle(chat.title, fullInfoById[chat.id]?.about)
                && !chat.isNotJoined
                && !chat.isRestricted
        ) as ApiChat[];

        const currentUser = global.currentUserId
            ? selectUser(global, global.currentUserId)
            : undefined;

        const currentChat = selectCurrentChat(global);
        const { driveActiveSection } = selectTabState(global);

        const inviteLinkById: Record<string, string | undefined> = {};
        driveFolders.forEach((folder) => {
            inviteLinkById[folder.id] = global.chats.fullInfoById[folder.id]?.inviteLink;
        });

        return {
            driveFolders,
            currentUser,
            activeChatId: currentChat?.id,
            driveActiveSection,
            inviteLinkById,
        };
    }
)(DriveSidebar));
