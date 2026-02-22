import type { FC } from '@teact';
import { memo, useState } from '@teact';
import { getActions, withGlobal } from '../../../global';
import { selectUser, selectChat } from '../../../global/selectors';
import type { ApiChat, ApiMessage, ApiUser } from '../../../api/types';
import { getMessageContent } from '../../../global/helpers';
import { formatMediaDateTime } from '../../../util/dates/dateFormat';
import useOldLang from '../../../hooks/useOldLang';
import ProfilePhoto from '../../common/profile/ProfilePhoto';

import DriveShareFileModal from './DriveShareFileModal';

import './AssetTable.scss';

const BROWSER_VIEWABLE_EXTS = ['pdf', 'txt', 'svg', 'mp3', 'wav', 'ogg', 'webm'];
const TELEGRAM_VIEWER_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'mov'];
const NO_PREVIEW_EXTS = ['zip', 'rar', '7z', 'tar', 'gz', 'exe', 'dmg', 'pkg', 'deb', 'apk', 'iso'];

type OwnProps = {
    files: ApiMessage[];
    chatId: string;
    threadId?: number | string;
    onFileSelect?: (file: ApiMessage) => void;
    isAdmin?: boolean;
    chatsById?: Record<string, ApiChat>;
    currentUserId?: string;
};

const formatSize = (bytes: number) => {
    if (!bytes) return '—';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
    return (bytes / 1073741824).toFixed(1) + ' GB';
};

const getPreviewMode = (ext: string, isPhoto: boolean, isVideo: boolean): 'telegram' | 'browser' | 'none' => {
    if (isPhoto) return 'telegram';
    if (TELEGRAM_VIEWER_EXTS.includes(ext)) return 'telegram';
    if (BROWSER_VIEWABLE_EXTS.includes(ext)) return 'browser';
    if (NO_PREVIEW_EXTS.includes(ext)) return 'none';
    return 'browser';
};

const AssetTableRow: FC<{
    file: ApiMessage;
    chatId: string;
    threadId?: number | string;
    onFileSelect?: (file: ApiMessage) => void;
    isAdmin?: boolean;
    chatsById?: Record<string, ApiChat>;
    currentUserId?: string;
}> = memo(({ file, chatId, threadId, onFileSelect, isAdmin = false, chatsById, currentUserId }) => {
    const oldLang = useOldLang();
    const [menuOpen, setMenuOpen] = useState(false);
    const [renaming, setRenaming] = useState(false);
    const [renameValue, setRenameValue] = useState('');
    const [shareModalOpen, setShareModalOpen] = useState(false);

    const { document, photo, video } = getMessageContent(file);
    const customFileName = file.content.text?.text?.trim();
    const rawFileName = document?.fileName || (photo ? 'Photo' : video ? 'Video' : 'file');
    const fileName = customFileName || rawFileName;
    const size = document?.size || (video && 'size' in video ? (video as any).size : 0) || 0;
    const ext = document?.fileName?.split('.').pop()?.toLowerCase() || '';

    const isPending = file.sendingState === 'messageSendingStatePending';
    const isFailed = file.sendingState === 'messageSendingStateFailed';
    const previewMode = getPreviewMode(ext, Boolean(photo), Boolean(video));
    const canManage = Boolean(isAdmin || (currentUserId && file.senderId === currentUserId));

    const sourceChat = (file as any).chatId && chatsById
        ? chatsById[(file as any).chatId]
        : undefined;

    const locationLabel = sourceChat?.title
        ? sourceChat.title.replace(/^pludo-drive_/i, '').replace(/^pludo-drive/i, 'Drive')
        : 'My Drive';

    const isSharedWithMe = file.senderId && file.senderId !== currentUserId;

    const getFileIcon = () => {
        if (photo) return 'icon-photo';
        if (ext === 'pdf') return 'icon-document';
        if (['doc', 'docx'].includes(ext)) return 'icon-document';
        if (['ppt', 'pptx'].includes(ext)) return 'icon-document';
        if (['mp4', 'mov', 'avi', 'webm'].includes(ext)) return 'icon-video';
        if (['mp3', 'wav', 'ogg'].includes(ext)) return 'icon-audio';
        if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'icon-archive';
        return 'icon-document';
    };

    const getIconColor = () => {
        if (photo || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return '#10b981';
        if (ext === 'pdf') return '#ef4444';
        if (['doc', 'docx'].includes(ext)) return '#3b82f6';
        if (['ppt', 'pptx'].includes(ext)) return '#f97316';
        if (['mp4', 'mov', 'webm'].includes(ext)) return '#8b5cf6';
        if (['mp3', 'wav'].includes(ext)) return '#ec4899';
        if (['zip', 'rar', '7z'].includes(ext)) return '#f59e0b';
        return '#6b7280';
    };

    const handlePreview = (e: React.MouseEvent) => {
        e.stopPropagation();
        setMenuOpen(false);
        if (previewMode === 'telegram') {
            getActions().openMediaViewer({
                chatId,
                threadId: threadId as number,
                messageId: file.id,
                origin: 'inline' as any,
            });
        } else if (previewMode === 'browser' && document) {
            getActions().downloadMedia({ media: document, originMessage: file });
        }
    };

    const handleRowClick = (e: React.MouseEvent) => {
        if (menuOpen || renaming) return;
        if (isPending) return;
        if (previewMode === 'none') return;
        if (onFileSelect) {
            onFileSelect(file);
            return;
        }
        handlePreview(e);
    };

    const handleDownload = (e: React.MouseEvent) => {
        e.stopPropagation();
        setMenuOpen(false);
        if (document) {
            getActions().downloadMedia({ media: document, originMessage: file });
        } else {
            getActions().openMediaViewer({
                chatId,
                threadId: threadId as number,
                messageId: file.id,
                origin: 'inline' as any,
            });
        }
    };

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        setMenuOpen(false);
        getActions().deleteMessages({ messageIds: [file.id], shouldDeleteForAll: true });
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
                messageList: { chatId, threadId: threadId as number, type: 'thread' },
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
                <div className="file-type-icon" style={{ background: `${getIconColor()}18` } as React.CSSProperties}>
                    <i className={`icon ${getFileIcon()}`} style={{ color: getIconColor() } as React.CSSProperties} />
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
                        <span className="file-name">{fileName}</span>
                        {isPending && <span className="file-badge uploading">Uploading</span>}
                        {isFailed && <span className="file-badge failed">Failed</span>}
                        {previewMode === 'none' && !isPending && <span className="file-badge no-preview">No Preview</span>}
                    </div>
                )}
            </div>

            <div className="AssetTable-col size-col">
                {formatSize(size)}
            </div>

            <div className="AssetTable-col sharedBy-col">
                <SenderInfo userId={file.senderId} currentUserId={currentUserId} />
            </div>

            <div className="AssetTable-col location-col">
                <div className="location-badge">
                    <i className={`icon ${isSharedWithMe ? 'icon-user' : 'icon-folder'}`} />
                    <span>{isSharedWithMe ? 'Shared with me' : locationLabel}</span>
                </div>
            </div>

            <div className="AssetTable-col created-col">
                {isPending ? 'Just now' : formatMediaDateTime(oldLang, file.date * 1000)}
            </div>

            <div className="AssetTable-col actions-col" onClick={(e) => e.stopPropagation()}>
                <button
                    className="row-action-btn"
                    onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
                    title="More options"
                >
                    <i className="icon icon-more" />
                </button>
                {menuOpen && (
                    <div className="row-action-menu">
                        {previewMode === 'telegram' && (
                            <button className="menu-item" onClick={handlePreview}>
                                <i className="icon icon-eye-open" /> Preview
                            </button>
                        )}
                        {previewMode === 'browser' && (
                            <button className="menu-item" onClick={handlePreview}>
                                <i className="icon icon-web" /> Open in Browser
                            </button>
                        )}
                        <button className="menu-item" onClick={handleDownload}>
                            <i className="icon icon-download" /> Download
                        </button>
                        <button className="menu-item" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); setShareModalOpen(true); }}>
                            <i className="icon icon-share" /> Share
                        </button>
                        {canManage && (
                            <>
                                <button className="menu-item" onClick={handleRenameStart}>
                                    <i className="icon icon-edit" /> Rename
                                </button>
                                <button className="menu-item danger" onClick={handleDelete}>
                                    <i className="icon icon-delete" /> Delete
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>

            <DriveShareFileModal
                isOpen={shareModalOpen}
                file={file}
                sourceChatId={chatId}
                onClose={() => setShareModalOpen(false)}
            />
        </div>
    );
});

const SenderInfo = memo(withGlobal<{ userId?: string; currentUserId?: string }>(
    (global, { userId, currentUserId }) => {
        const isSelf = !userId || userId === currentUserId || userId === global.currentUserId;
        const user = userId && !isSelf ? selectUser(global, userId) : undefined;
        let name = 'Unknown';
        if (isSelf) {
            name = 'Me';
        } else if (user) {
            name = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.usernames?.[0]?.username || 'User';
        }
        return { user, isSelf, name };
    }
)(({ user, isSelf, name }: { user?: ApiUser; isSelf?: boolean; name: string }) => (
    <div className="AssetTable-sender">
        {(user && !isSelf) ? (
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
)));

const AssetTable: FC<OwnProps> = ({ files, chatId, threadId, onFileSelect, isAdmin = false, chatsById, currentUserId }) => {
    return (
        <div className="AssetTable">
            <div className="AssetTable-header-row">
                <h2 className="section-title">Files</h2>
                <span className="asset-count">{files.length} item{files.length !== 1 ? 's' : ''}</span>
            </div>

            <div className="AssetTable-container">
                <div className="AssetTable-header">
                    <div className="AssetTable-col name-col">Name</div>
                    <div className="AssetTable-col size-col">Size</div>
                    <div className="AssetTable-col sharedBy-col">Shared by</div>
                    <div className="AssetTable-col location-col">Location</div>
                    <div className="AssetTable-col created-col">Date</div>
                    <div className="AssetTable-col actions-col" />
                </div>

                <div className="AssetTable-body">
                    {files.map((file) => (
                        <AssetTableRow
                            key={file.id}
                            file={file}
                            chatId={chatId}
                            threadId={threadId}
                            onFileSelect={onFileSelect}
                            isAdmin={isAdmin}
                            chatsById={chatsById}
                            currentUserId={currentUserId}
                        />
                    ))}
                    {files.length === 0 && (
                        <div className="AssetTable-empty">
                            <i className="icon icon-document" />
                            <p>No files yet. Upload your first file.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default memo(withGlobal<OwnProps>(
    (global) => ({
        chatsById: global.chats.byId as Record<string, ApiChat>,
        currentUserId: global.currentUserId,
    })
)(AssetTable));
