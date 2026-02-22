import type { FC } from '@teact';
import { memo, useState } from '@teact';
import { getActions, withGlobal } from '../../../global';
import { selectUser } from '../../../global/selectors';
import type { ApiMessage } from '../../../api/types';
import { getMessageContent } from '../../../global/helpers';
import { formatMediaDateTime } from '../../../util/dates/dateFormat';
import { MediaViewerOrigin } from '../../../types';
import useOldLang from '../../../hooks/useOldLang';

import DriveShareFileModal from './DriveShareFileModal';

import './AssetTable.scss';

type OwnProps = {
    files: ApiMessage[];
    chatId: string;
    threadId?: number | string;
    onFileSelect?: (file: ApiMessage) => void;
    isAdmin?: boolean;
};

const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
    return (bytes / 1073741824).toFixed(1) + ' GB';
};

const AssetTableRow: FC<{
    file: ApiMessage;
    chatId: string;
    threadId?: number | string;
    onFileSelect?: (file: ApiMessage) => void;
    isAdmin?: boolean;
}> = memo(({ file, chatId, threadId, onFileSelect, isAdmin = true }) => {
    const oldLang = useOldLang();
    const [menuOpen, setMenuOpen] = useState(false);
    const [renaming, setRenaming] = useState(false);
    const [renameValue, setRenameValue] = useState('');
    const [shareModalOpen, setShareModalOpen] = useState(false);

    const { document, photo, video } = getMessageContent(file);
    const customFileName = file.content.text?.text?.trim();
    const rawFileName = document?.fileName || 'file';
    const fileName = customFileName || rawFileName;
    const size = document?.size || (video && 'size' in video ? (video as any).size : 0) || 0;
    const ext = document?.fileName?.split('.').pop()?.toLowerCase() || '';

    const isPending = file.sendingState === 'messageSendingStatePending';
    const isFailed = file.sendingState === 'messageSendingStateFailed';

    const getFileIcon = () => {
        if (photo) return 'icon-photo';
        if (['pdf'].includes(ext)) return 'icon-document';
        if (['doc', 'docx'].includes(ext)) return 'icon-document';
        if (['ppt', 'pptx'].includes(ext)) return 'icon-document';
        if (['mp4', 'mov', 'avi'].includes(ext)) return 'icon-video';
        if (['mp3', 'wav'].includes(ext)) return 'icon-audio';
        return 'icon-document';
    };

    const getIconColor = () => {
        if (photo || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return '#10b981';
        if (['pdf'].includes(ext)) return '#ef4444';
        if (['doc', 'docx'].includes(ext)) return '#3b82f6';
        if (['ppt', 'pptx'].includes(ext)) return '#f97316';
        if (['mp4', 'mov'].includes(ext)) return '#8b5cf6';
        return '#6b7280';
    };

    const handleRowClick = (e: React.MouseEvent) => {
        if (menuOpen || renaming) return;
        if (isPending) return;
        if (onFileSelect) {
            onFileSelect(file);
            return;
        }
        const { openMediaViewer } = getActions();
        openMediaViewer({
            chatId,
            threadId: threadId as number,
            messageId: file.id,
            origin: MediaViewerOrigin.Inline,
        });
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
                origin: MediaViewerOrigin.Inline,
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
            getActions().editMessage({
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
            className={`AssetTableRow ${isPending ? 'pending' : ''} ${isFailed ? 'failed' : ''}`}
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
                    <span className="file-name">{fileName}</span>
                )}
            </div>
            <div className="AssetTable-col size-col">
                {isPending ? 'Uploading...' : isFailed ? 'Failed' : formatSize(size)}
            </div>
            <div className="AssetTable-col createdBy-col">
                <SenderName userId={file.senderId} chatId={chatId} />
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
                        <button className="menu-item" onClick={handleDownload}>
                            <i className="icon icon-download" /> Download
                        </button>
                        <button className="menu-item" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); setShareModalOpen(true); }}>
                            <i className="icon icon-share" /> Share
                        </button>
                        {isAdmin && (
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

const SenderName = memo(withGlobal<{ userId?: string; chatId: string }>(
    (global, { userId, chatId }) => {
        const isSelf = userId === global.currentUserId || userId === chatId || !userId;
        const user = userId ? selectUser(global, userId) : undefined;
        let name = 'Unknown';
        if (isSelf) {
            name = 'Me';
        } else if (user) {
            name = `${user.firstName || ''} ${user.lastName || ''}`.trim();
        }
        return { name };
    }
)(({ name }: { name: string }) => <span>{name}</span>));

const AssetTable: FC<OwnProps> = ({ files, chatId, threadId, onFileSelect, isAdmin = true }) => {
    return (
        <div className="AssetTable">
            <div className="AssetTable-header-row">
                <h2 className="section-title">Assets</h2>
                <span className="asset-count">{files.length} item{files.length !== 1 ? 's' : ''}</span>
            </div>

            <div className="AssetTable-container">
                <div className="AssetTable-header">
                    <div className="AssetTable-col name-col">Name</div>
                    <div className="AssetTable-col size-col">Size</div>
                    <div className="AssetTable-col createdBy-col">Created by</div>
                    <div className="AssetTable-col created-col">Created</div>
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
                        />
                    ))}
                    {files.length === 0 && (
                        <div className="AssetTable-empty">
                            <i className="icon icon-document" />
                            <p>No assets yet. Upload your first file.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default memo(AssetTable);
