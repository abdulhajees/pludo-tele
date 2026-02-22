import type { FC } from '@teact';
import { memo, useRef, useState } from '@teact';
import { getActions, withGlobal } from '../../../global';
import { selectTabState, selectUser } from '../../../global/selectors';
import type { ApiChat, ApiChatFullInfo, ApiMessage, ApiUser } from '../../../api/types';
import { GENERAL_TOPIC_ID } from '../../../config';
import { getMessageContent } from '../../../global/helpers';
import { getMessageMediaHash } from '../../../global/helpers/messageMedia';
import { formatMediaDateTime } from '../../../util/dates/dateFormat';
import { getMessageKey } from '../../../util/keys/messageKey';
import type { ActiveDownloads } from '../../../types';
import useOldLang from '../../../hooks/useOldLang';
import useLang from '../../../hooks/useLang';
import ProfilePhoto from '../../common/profile/ProfilePhoto';
import { getDriveDisplayName, getDriveShareParticipants } from '../../../util/drive';
import { useClickOutside } from '../../../hooks/events/useOutsideClick';

import DriveShareFileModal from './DriveShareFileModal';

import './AssetTable.scss';

const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'heic', 'heif'];

type OwnProps = {
    files: {
        id: string;
        sourceChatId: string;
        file: ApiMessage;
    }[];
    chatId?: string;
    threadId?: number | string;
    onFileSelect?: (file: { id: string; sourceChatId: string; file: ApiMessage }) => void;
    isAdmin?: boolean;
    tableMode?: 'sharing' | 'space';
    chatsById?: Record<string, ApiChat>;
    usersById?: Record<string, ApiUser | undefined>;
    currentUserId?: string;
    usersByUsername?: Record<string, ApiUser>;
    currentUser?: ApiUser;
    chatFullInfoById?: Record<string, ApiChatFullInfo>;
    uploadProgressByMessageKey?: Record<string, { progress: number }>;
    activeDownloads?: ActiveDownloads;
};

const formatSize = (bytes: number) => {
    if (!bytes) return '—';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
    return (bytes / 1073741824).toFixed(1) + ' GB';
};

const getPreviewMode = (ext: string, isPhoto: boolean): 'image' | 'none' => {
    if (isPhoto) return 'image';
    if (IMAGE_EXTS.includes(ext)) return 'image';
    return 'none';
};

const AssetTableRow: FC<{
    id: string;
    sourceChatId: string;
    file: ApiMessage;
    chatId?: string;
    threadId?: number | string;
    onFileSelect?: (file: { id: string; sourceChatId: string; file: ApiMessage }) => void;
    isAdmin?: boolean;
    tableMode?: 'sharing' | 'space';
    chatsById?: Record<string, ApiChat>;
    usersById?: Record<string, ApiUser | undefined>;
    currentUserId?: string;
    usersByUsername?: Record<string, ApiUser>;
    currentUser?: ApiUser;
    chatFullInfoById?: Record<string, ApiChatFullInfo>;
    uploadProgressByMessageKey?: Record<string, { progress: number }>;
    activeDownloads?: ActiveDownloads;
}> = memo(({
    id,
    sourceChatId,
    file,
    chatId,
    threadId,
    onFileSelect,
    isAdmin = false,
    tableMode = 'space',
    chatsById,
    usersById,
    currentUserId,
    usersByUsername,
    currentUser,
    chatFullInfoById,
    uploadProgressByMessageKey,
    activeDownloads,
}) => {
    const oldLang = useOldLang();
    const lang = useLang();
    const [menuOpen, setMenuOpen] = useState(false);
    const [renaming, setRenaming] = useState(false);
    const [renameValue, setRenameValue] = useState('');
    const [shareModalOpen, setShareModalOpen] = useState(false);
    const rowMenuRef = useRef<HTMLDivElement>();

    useClickOutside([rowMenuRef], () => {
        if (!menuOpen) return;
        setMenuOpen(false);
    });

    const { document, photo, video } = getMessageContent(file);
    const customFileName = file.content.text?.text?.trim();
    const rawFileName = document?.fileName || (photo ? lang('DrivePreviewPhoto') : video ? lang('DrivePreviewVideo') : lang('DrivePreviewUntitled'));
    const fileName = customFileName || rawFileName;
    const size = document?.size || (video && 'size' in video ? (video as any).size : 0) || 0;
    const ext = document?.fileName?.split('.').pop()?.toLowerCase() || '';

    const isPending = file.sendingState === 'messageSendingStatePending';
    const isFailed = file.sendingState === 'messageSendingStateFailed';
    const previewMode = getPreviewMode(ext, Boolean(photo));
    const canManage = Boolean(isAdmin || (currentUserId && file.senderId === currentUserId));
    const messageKey = getMessageKey(file);
    const uploadProgress = uploadProgressByMessageKey?.[messageKey]?.progress;
    const downloadMediaHash = getMessageMediaHash(file, {}, 'download');
    const isDownloading = Boolean(downloadMediaHash && activeDownloads?.[downloadMediaHash]);

    const sourceChat = sourceChatId && chatsById
        ? chatsById[sourceChatId]
        : undefined;

    const sourceChatTitle = sourceChat?.title;
    const participants = getDriveShareParticipants(sourceChatTitle, chatFullInfoById?.[sourceChatId]?.about);
    const currentUsername = currentUser?.usernames?.[0]?.username?.toLowerCase();
    const isReceiver = Boolean(participants && currentUsername && participants.receiverUsername === currentUsername);
    const isSender = Boolean(participants && currentUsername && participants.senderUsername === currentUsername);

    const sharedByUsername = participants
        ? (isReceiver ? participants.senderUsername : (isSender ? participants.senderUsername : participants.senderUsername))
        : undefined;
    const sharedWithUsername = participants
        ? (isReceiver ? participants.receiverUsername : (isSender ? participants.receiverUsername : participants.receiverUsername))
        : undefined;

    const sharedByUser = sharedByUsername ? usersByUsername?.[sharedByUsername] : undefined;
    const sharedWithUser = sharedWithUsername ? usersByUsername?.[sharedWithUsername] : undefined;
    const modifiedByUser = file.senderId ? usersById?.[file.senderId] : undefined;
    const isModifiedByMe = Boolean(!file.senderId || file.senderId === currentUserId);

    const sharedByName = participants
        ? (isSender
            ? lang('DriveTableSenderMe')
            : sharedByUser?.firstName || sharedByUser?.usernames?.[0]?.username || sharedByUsername || lang('DriveTableSenderUnknown'))
        : undefined;

    const sharedWithName = participants
        ? (isReceiver
            ? lang('DriveTableSenderMe')
            : sharedWithUser?.firstName || sharedWithUser?.usernames?.[0]?.username || sharedWithUsername || lang('DriveTableSenderUnknown'))
        : undefined;

    const fallbackLocationLabel = sourceChatTitle
        ? getDriveDisplayName(sourceChatTitle)
        : lang('DriveTableMyDrive');

    const getFileIcon = () => {
        if (photo) return 'icon-photo';
        if (ext === 'pdf') return 'icon-document';
        if (['doc', 'docx', 'txt', 'md'].includes(ext)) return 'icon-document';
        if (['ppt', 'pptx'].includes(ext)) return 'icon-document';
        if (['mp4', 'mov', 'avi', 'webm'].includes(ext)) return 'icon-video';
        if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) return 'icon-note';
        if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'icon-archive';
        if (['csv', 'xls', 'xlsx'].includes(ext)) return 'icon-file-badge';
        if (['xml', 'json', 'yaml', 'yml'].includes(ext)) return 'icon-file-badge';
        return 'icon-file-badge';
    };

    const getIconColor = () => {
        if (photo || IMAGE_EXTS.includes(ext)) return '#10b981';
        if (ext === 'pdf') return '#ef4444';
        if (['doc', 'docx'].includes(ext)) return '#3b82f6';
        if (['csv', 'xls', 'xlsx'].includes(ext)) return '#0f766e';
        if (['xml', 'json', 'yaml', 'yml'].includes(ext)) return '#334155';
        if (['ppt', 'pptx'].includes(ext)) return '#f97316';
        if (['mp4', 'mov', 'webm'].includes(ext)) return '#8b5cf6';
        if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) return '#ec4899';
        if (['zip', 'rar', '7z'].includes(ext)) return '#f59e0b';
        return '#6b7280';
    };

    const handlePreview = (e: React.MouseEvent) => {
        e.stopPropagation();
        setMenuOpen(false);
        if (previewMode === 'image') {
            getActions().openMediaViewer({
                chatId: sourceChatId,
                threadId: typeof threadId === 'number' && sourceChatId === chatId ? threadId : undefined,
                messageId: file.id,
                origin: 'inline' as any,
            });
        }
    };

    const handleRowClick = (e: React.MouseEvent) => {
        if (menuOpen || renaming) return;
        if (isPending) return;
        if (onFileSelect) {
            onFileSelect({ id, sourceChatId, file });
            return;
        }
        if (previewMode === 'image') {
            handlePreview(e);
        }
    };

    const handleDownload = (e: React.MouseEvent) => {
        e.stopPropagation();
        setMenuOpen(false);
        if (document) {
            getActions().downloadMedia({ media: document, originMessage: file });
        } else {
            getActions().openMediaViewer({
                chatId: sourceChatId,
                threadId: typeof threadId === 'number' && sourceChatId === chatId ? threadId : undefined,
                messageId: file.id,
                origin: 'inline' as any,
            });
        }
    };

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        setMenuOpen(false);
        getActions().deleteMessages({
            messageIds: [file.id],
            shouldDeleteForAll: true,
            messageList: {
                chatId: sourceChatId,
                threadId: typeof threadId === 'number' && sourceChatId === chatId ? threadId : GENERAL_TOPIC_ID,
                type: 'thread',
            },
        });
    };

    const handleRenameStart = (e: React.MouseEvent) => {
        e.stopPropagation();
        setMenuOpen(false);
        setRenameValue(fileName);
        setRenaming(true);
    };

    const handleRenameConfirm = () => {
        if (renameValue.trim() && renameValue.trim() !== fileName) {
            getActions().setEditingId({ messageId: file.id });
            getActions().editMessage({
                messageList: {
                    chatId: sourceChatId,
                    threadId: typeof threadId === 'number' && sourceChatId === chatId ? threadId : GENERAL_TOPIC_ID,
                    type: 'thread',
                },
                text: renameValue.trim(),
            });
        }
        setRenaming(false);
    };

    const handleRenameKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleRenameConfirm();
        if (e.key === 'Escape') setRenaming(false);
    };

    return (
        <div
            className={`AssetTableRow ${isPending ? 'pending' : ''} ${isFailed ? 'failed' : ''} ${previewMode === 'none' ? 'no-preview' : 'can-preview'}`}
            onClick={handleRowClick}
        >
            <div className="AssetTable-col name-col">
                <div className="file-type-icon" style={`background: ${getIconColor()}18`}>
                    <i className={`icon ${getFileIcon()}`} style={`color: ${getIconColor()}`} />
                    {ext && <span className="file-ext-badge">{ext.slice(0, 4).toUpperCase()}</span>}
                </div>
                {renaming ? (
                    <input
                        className="rename-input"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={handleRenameConfirm}
                        onKeyDown={handleRenameKeyDown}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                    />
                ) : (
                    <div className="file-name-block">
                        <div className="file-name-main">
                            <span className="file-name">{fileName}</span>
                            {isFailed && <span className="file-badge failed">{lang('DriveTableBadgeFailed')}</span>}
                        </div>
                        {(uploadProgress !== undefined || isDownloading) && (
                            <div className="transfer-progress">
                                <div
                                    className={`transfer-progress-fill ${isDownloading && uploadProgress === undefined ? 'indeterminate' : ''}`}
                                    style={uploadProgress !== undefined ? `width: ${Math.max(0, Math.min(100, Math.round(uploadProgress * 100)))}%` : undefined}
                                />
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="AssetTable-col size-col">
                {formatSize(size)}
            </div>

            <div className="AssetTable-col sharedBy-col">
                {tableMode === 'sharing' ? (
                    <ParticipantInfo
                        user={sharedByUser}
                        isMe={Boolean(isSender)}
                        fallbackName={sharedByName || lang('DriveTableSenderUnknown')}
                    />
                ) : (
                    <ParticipantInfo
                        user={modifiedByUser}
                        isMe={isModifiedByMe}
                        fallbackName={lang('DriveTableSenderUnknown')}
                    />
                )}
            </div>

            <div className="AssetTable-col sharedWith-col">
                {tableMode === 'sharing' && participants ? (
                    <ParticipantInfo
                        user={sharedWithUser}
                        isMe={Boolean(isReceiver)}
                        fallbackName={sharedWithName || lang('DriveTableSenderUnknown')}
                    />
                ) : (
                    <div className="location-badge">
                        <i className="icon icon-folder" />
                        <span>{fallbackLocationLabel}</span>
                    </div>
                )}
            </div>

            <div className="AssetTable-col created-col">
                {isPending ? lang('DriveTableJustNow') : formatMediaDateTime(oldLang, file.date * 1000)}
            </div>

            <div className="AssetTable-col actions-col" onClick={(e) => e.stopPropagation()} ref={rowMenuRef}>
                <button
                    className="row-action-btn"
                    onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
                    title={lang('AccDescrMoreOptions')}
                >
                    <i className="icon icon-more" />
                </button>
                {menuOpen && (
                    <div className="row-action-menu">
                        {previewMode === 'image' && (
                            <button className="menu-item" onClick={handlePreview}>
                                <i className="icon icon-eye-open" /> {lang('DriveMenuPreview')}
                            </button>
                        )}
                        <button className="menu-item" onClick={handleDownload}>
                            <i className="icon icon-download" /> {lang('DriveMenuDownload')}
                        </button>
                        <button className="menu-item" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); setShareModalOpen(true); }}>
                            <i className="icon icon-share" /> {lang('DriveMenuShare')}
                        </button>
                        {canManage && previewMode === 'image' && (
                            <>
                                <button className="menu-item" onClick={handleRenameStart}>
                                    <i className="icon icon-edit" /> {lang('DriveActionRename')}
                                </button>
                                <button className="menu-item danger" onClick={handleDelete}>
                                    <i className="icon icon-delete" /> {lang('DeleteChat')}
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>

            <DriveShareFileModal
                isOpen={shareModalOpen}
                file={file}
                sourceChatId={sourceChatId}
                onClose={() => setShareModalOpen(false)}
            />
        </div>
    );
});

const ParticipantInfo = ({
    user,
    isMe,
    fallbackName,
}: {
    user?: ApiUser;
    isMe?: boolean;
    fallbackName: string;
}) => {
    const lang = useLang();

    const name = isMe
        ? lang('DriveTableSenderMe')
        : user
            ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.usernames?.[0]?.username || lang('DriveTableSenderUser')
            : fallbackName;

    return (
        <div className="AssetTable-sender">
            {(user && !isMe) ? (
                <ProfilePhoto
                    user={user}
                    theme="light"
                    canPlayVideo={false}
                    onClick={() => { }}
                />
            ) : (
                <div className="placeholder-avatar">
                    {name.charAt(0).toUpperCase()}
                </div>
            )}
            <span>{name}</span>
        </div>
    );
};

const AssetTable: FC<OwnProps> = ({
    files,
    chatId,
    threadId,
    onFileSelect,
    isAdmin = false,
    tableMode = 'space',
    chatsById,
    usersById,
    currentUserId,
    usersByUsername,
    currentUser,
    chatFullInfoById,
    uploadProgressByMessageKey,
    activeDownloads,
}) => {
    const lang = useLang();

    return (
        <div className="AssetTable">
            <div className="AssetTable-header-row">
                <h2 className="section-title">{lang('DriveTableFilesTitle')}</h2>
                <span className="asset-count">{files.length === 1 ? lang('DriveTableCountOne', { count: files.length }) : lang('DriveTableCountOther', { count: files.length })}</span>
            </div>

            <div className="AssetTable-container">
                <div className="AssetTable-header">
                    <div className="AssetTable-col name-col">{lang('DriveTableColName')}</div>
                    <div className="AssetTable-col size-col">{lang('DriveTableColSize')}</div>
                    <div className="AssetTable-col sharedBy-col">{tableMode === 'sharing' ? lang('DriveTableColSharedBy') : lang('DriveTableColModifiedBy')}</div>
                    <div className="AssetTable-col sharedWith-col">{tableMode === 'sharing' ? lang('DriveTableColSharedWith') : lang('DriveTableColLocation')}</div>
                    <div className="AssetTable-col created-col">{lang('DriveTableColDate')}</div>
                    <div className="AssetTable-col actions-col" />
                </div>

                <div className="AssetTable-body">
                    {files.map((item) => (
                        <AssetTableRow
                            key={item.id}
                            id={item.id}
                            sourceChatId={item.sourceChatId}
                            file={item.file}
                            chatId={chatId}
                            threadId={threadId}
                            onFileSelect={onFileSelect}
                            isAdmin={isAdmin}
                            tableMode={tableMode}
                            chatsById={chatsById}
                            usersById={usersById}
                            currentUserId={currentUserId}
                            usersByUsername={usersByUsername}
                            currentUser={currentUser}
                            chatFullInfoById={chatFullInfoById}
                            uploadProgressByMessageKey={uploadProgressByMessageKey}
                            activeDownloads={activeDownloads}
                        />
                    ))}
                    {files.length === 0 && (
                        <div className="AssetTable-empty">
                            <i className="icon icon-document" />
                            <p>{lang('DriveTableEmpty')}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default memo(withGlobal<OwnProps>(
    (global) => {
        const usersByUsername: Record<string, ApiUser> = {};

        Object.values(global.users.byId || {}).forEach((user) => {
            if (!user?.usernames?.length) return;
            user.usernames.forEach((usernameItem) => {
                if (!usernameItem?.username) return;
                usersByUsername[usernameItem.username.toLowerCase()] = user;
            });
        });

        const currentUser = global.currentUserId ? selectUser(global, global.currentUserId) : undefined;

        return {
            chatsById: global.chats.byId as Record<string, ApiChat>,
            chatFullInfoById: global.chats.fullInfoById,
            usersById: global.users.byId,
            currentUserId: global.currentUserId,
            usersByUsername,
            currentUser,
            uploadProgressByMessageKey: global.fileUploads.byMessageKey,
            activeDownloads: selectTabState(global).activeDownloads,
        };
    }
)(AssetTable));
