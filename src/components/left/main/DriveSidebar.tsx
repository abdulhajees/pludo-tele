import type { FC } from '../../../lib/teact/teact';
import { memo, useRef, useState, useEffect } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';
import { selectCurrentChat, selectTabState, selectUser } from '../../../global/selectors';
import type { ApiChat, ApiUser } from '../../../api/types';

import DriveCreateSpaceModal from './DriveCreateSpaceModal';
import DriveProfileModal from './DriveProfileModal';
import DriveShareSpaceModal from './DriveShareSpaceModal';
import DriveManageAccessModal from './DriveManageAccessModal';
import { initDrivePermissions, syncSpacePermissions, useAllSpacePermissions } from './DrivePermissions';
import ConfirmDialog from '../../ui/ConfirmDialog';
import ProfilePhoto from '../../common/profile/ProfilePhoto';
import './DriveSidebar.scss';

type Section = 'my-files' | 'sharing' | 'recent' | 'notifications';

type OwnProps = {
    onSelectFolder: (chatId: string) => void;
    onSectionChange?: (section: Section) => void;
    activeSection?: Section;
};

type StateProps = {
    driveFolders: ApiChat[];
    currentUser?: ApiUser;
    activeChatId?: string;
    driveActiveSection?: string;
    inviteLinkById: Record<string, string | undefined>;
};

const navigationLinks: { id: Section; icon: string; label: string }[] = [
    { id: 'my-files', icon: 'icon-document', label: 'My files' },
    { id: 'sharing', icon: 'icon-user', label: 'Sharing' },
    { id: 'recent', icon: 'icon-recent', label: 'Recent' },
    { id: 'notifications', icon: 'icon-info', label: 'Notifications' },
];

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
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [sharingFolderId, setSharingFolderId] = useState<string | undefined>();
    const [manageAccessFolderId, setManageAccessFolderId] = useState<string | undefined>();
    const [folderMenuId, setFolderMenuId] = useState<string | undefined>(undefined);
    const [renamingFolderId, setRenamingFolderId] = useState<string | undefined>(undefined);
    const [renameValue, setRenameValue] = useState('');
    const [dragTargetFolderId, setDragTargetFolderId] = useState<string | undefined>();
    const [confirmDeleteFolderId, setConfirmDeleteFolderId] = useState<string | undefined>();

    useEffect(() => {
        if (!activeChatId && !driveActiveSection) {
            getActions().setDriveActiveSection({ section: 'my_files' });
        }
    }, [activeChatId, driveActiveSection]);

    useEffect(() => {
        initDrivePermissions();
        getActions().syncDriveChatFolders();
    }, []);

    useEffect(() => {
        driveFolders.forEach(syncSpacePermissions);
    }, [driveFolders]);

    const allPerms = useAllSpacePermissions();

    const handleDragOverFolder = (e: React.DragEvent, folderId: string) => {
        if (!allPerms[folderId]?.isAdmin) return;
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

    const handleSectionChange = (sectionId: Section) => {
        getActions().setDriveActiveSection({ section: sectionId === 'my-files' ? 'my_files' : sectionId });
    };

    const handleDropOnFolder = (e: React.DragEvent, folderId: string) => {
        e.preventDefault();
        e.stopPropagation();
        setDragTargetFolderId(undefined);

        if (!allPerms[folderId]?.isAdmin) return;

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const files = Array.from(e.dataTransfer.files);
            window.dispatchEvent(new CustomEvent('ui-drive-upload', { detail: { files, forceAsFile: true, targetChatId: folderId } }));
            onSelectFolder(folderId); // Switch to the folder to show upload progress
        }
    };

    // Copy link moved to Share Modal
    // Rename start/confirm handled below

    const handleRenameStart = (folder: ApiChat) => {
        const displayName = folder.title.replace(/^pludo-drive_?/i, '').trim();
        setRenameValue(displayName);
        setRenamingFolderId(folder.id);
        setFolderMenuId(undefined);
    };

    const handleRenameConfirm = (folderId: string) => {
        const newName = renameValue.trim();
        if (newName) {
            getActions().updateChat({
                chatId: folderId,
                title: `pludo-drive_${newName}`,
                about: '',
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
        ? `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || 'User'
        : 'User';

    return (
        <div className="DriveSidebar" onClick={() => setFolderMenuId(undefined)}>
            <div className="DriveSidebar-logo">
                <span className="logo-brand">drive.</span>
            </div>

            <nav className="DriveSidebar-nav">
                <div
                    className="DriveSidebar-nav-item top-item"
                    onClick={() => onSectionChange?.('my-files')}
                >
                    <i className="icon icon-check-outline" />
                    <span>My drive</span>
                </div>
            </nav>

            <div className="DriveSidebar-section">
                <span className="section-label">FILES</span>
                {navigationLinks.map((link) => (
                    <div
                        key={link.id}
                        className={`DriveSidebar-nav-item ${driveActiveSection === link.id ? 'active' : ''}`}
                        onClick={() => handleSectionChange(link.id as any)}
                    >
                        <i className={`icon icon-${link.icon}`} />
                        <span>{link.label}</span>
                    </div>
                ))}
            </div>

            <div className="DriveSidebar-section">
                <div className="section-label-row">
                    <span className="section-label">PRIVATE SPACES</span>
                    <button
                        className="new-folder-btn"
                        onClick={(e) => { e.stopPropagation(); setShowCreateModal(true); }}
                        title="New Space"
                    >
                        <i className="icon icon-add" />
                    </button>
                </div>

                {(() => {
                    const privateFolders = driveFolders.filter(f => !f.membersCount || f.membersCount <= 1);
                    return privateFolders.map((folder) => {
                        const folderName = folder.title.replace(/^pludo-drive_?\s*/i, '') || folder.title;
                        const isActive = folder.id === activeChatId;
                        const isRenaming = renamingFolderId === folder.id;
                        const menuOpen = folderMenuId === folder.id;

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
                                    title="Options"
                                >
                                    <i className="icon icon-more" />
                                </button>

                                {menuOpen && (
                                    <div className="folder-context-menu" onClick={(e) => e.stopPropagation()}>
                                        {allPerms[folder.id]?.isAdmin && (
                                            <>
                                                <button className="ctx-item" onClick={() => handleRenameStart(folder)}>
                                                    <i className="icon icon-edit" /> Rename
                                                </button>
                                                <button className="ctx-item" onClick={() => {
                                                    setFolderMenuId(undefined);
                                                    setSharingFolderId(folder.id);
                                                }}>
                                                    <i className="icon icon-user" /> Share space
                                                </button>
                                                <button className="ctx-item" onClick={() => {
                                                    setFolderMenuId(undefined);
                                                    setManageAccessFolderId(folder.id);
                                                }}>
                                                    <i className="icon icon-permissions" /> Manage access
                                                </button>
                                                <div className="ctx-divider" />
                                            </>
                                        )}
                                        <button className="ctx-item danger" onClick={() => handleDelete(folder.id)}>
                                            <i className={`icon icon-${allPerms[folder.id]?.isAdmin ? 'delete' : 'arrow-left'}`} /> {allPerms[folder.id]?.isAdmin ? 'Delete space' : 'Leave space'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    });
                })()}

                {driveFolders.filter(f => !f.membersCount || f.membersCount <= 1).length === 0 && (
                    <span className="no-folders-hint">No private spaces. Click + to create one.</span>
                )}
            </div>

            {(() => {
                const sharedFolders = driveFolders.filter(f => f.membersCount && f.membersCount > 1);
                if (sharedFolders.length === 0) return null;

                return (
                    <div className="DriveSidebar-section split-section">
                        <div className="section-label-row">
                            <span className="section-label">SHARED SPACES</span>
                        </div>

                        {sharedFolders.map((folder) => {
                            const folderName = folder.title.replace(/^pludo-drive_?\s*/i, '') || folder.title;
                            const isActive = folder.id === activeChatId;
                            const isRenaming = renamingFolderId === folder.id;
                            const menuOpen = folderMenuId === folder.id;

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
                                        title="Options"
                                    >
                                        <i className="icon icon-more" />
                                    </button>

                                    {menuOpen && (
                                        <div className="folder-context-menu" onClick={(e) => e.stopPropagation()}>
                                            {allPerms[folder.id]?.isAdmin && (
                                                <>
                                                    <button className="ctx-item" onClick={() => handleRenameStart(folder)}>
                                                        <i className="icon icon-edit" /> Rename
                                                    </button>
                                                    <button className="ctx-item" onClick={() => {
                                                        setFolderMenuId(undefined);
                                                        setSharingFolderId(folder.id);
                                                    }}>
                                                        <i className="icon icon-user" /> Share more
                                                    </button>
                                                    <button className="ctx-item" onClick={() => {
                                                        setFolderMenuId(undefined);
                                                        setManageAccessFolderId(folder.id);
                                                    }}>
                                                        <i className="icon icon-permissions" /> Manage access
                                                    </button>
                                                    <div className="ctx-divider" />
                                                </>
                                            )}
                                            <button className="ctx-item danger" onClick={() => handleDelete(folder.id)}>
                                                <i className={`icon icon-${allPerms[folder.id]?.isAdmin ? 'delete' : 'arrow-left'}`} /> {allPerms[folder.id]?.isAdmin ? 'Delete space' : 'Leave space'}
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
                title="Open profile settings"
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
                    <span className="user-role">DRIVE USER</span>
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
                title={confirmDeleteFolderId && allPerms[confirmDeleteFolderId]?.isAdmin ? 'Delete space' : 'Leave space'}
                text={
                    confirmDeleteFolderId && allPerms[confirmDeleteFolderId]?.isAdmin
                        ? 'Are you sure you want to delete this space? This action cannot be undone.'
                        : 'Are you sure you want to leave this space? You will lose access to its files.'
                }
                confirmLabel={confirmDeleteFolderId && allPerms[confirmDeleteFolderId]?.isAdmin ? 'Delete' : 'Leave'}
                confirmHandler={handleConfirmDelete}
            />
        </div>
    );
};

export default memo(withGlobal<OwnProps>(
    (global): StateProps => {
        const allChats = Object.values(global.chats.byId || {});
        const driveFolders = allChats.filter(
            (chat) => chat && chat.title && chat.title.toLowerCase().startsWith('pludo-drive') && !chat.title.toLowerCase().includes('pludo-drive-share_') && !chat.isNotJoined && !chat.isRestricted
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
