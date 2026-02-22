import type { FC } from '@teact';
import { memo, useState } from '@teact';
import type { ApiMessage } from '../../../api/types';
import { getMessageContent } from '../../../global/helpers';
import { formatMediaDateTime } from '../../../util/dates/dateFormat';
import { MediaViewerOrigin } from '../../../types';
import { getActions } from '../../../global';
import useOldLang from '../../../hooks/useOldLang';

import './DriveFilePreview.scss';

type OwnProps = {
    file: ApiMessage;
    chatId: string;
    threadId?: number | string;
    onClose: () => void;
    isAdmin?: boolean;
};

const formatSize = (bytes: number) => {
    if (!bytes) return '—';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
    return (bytes / 1073741824).toFixed(1) + ' GB';
};

const DriveFilePreview: FC<OwnProps> = ({ file, chatId, threadId, onClose, isAdmin = true }) => {
    const oldLang = useOldLang();

    const { document, photo, video } = getMessageContent(file);
    const customFileName = file.content.text?.text?.trim();
    const rawFileName = document?.fileName || (photo ? 'image' : video ? 'video' : 'Untitled');
    const fileName = customFileName || rawFileName;
    const size = document?.size || (video && 'size' in video ? (video as any).size : 0) || 0;
    const ext = document?.fileName?.split('.').pop()?.toLowerCase() || (photo ? 'image' : '');

    const hasPreviewableContent = Boolean(document || photo || video);
    const fileColor = (() => {
        if (photo || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return '#10b981';
        if (ext === 'pdf') return '#ef4444';
        if (['doc', 'docx'].includes(ext)) return '#3b82f6';
        if (['ppt', 'pptx'].includes(ext)) return '#f97316';
        if (['mp4', 'mov'].includes(ext)) return '#8B5CF6';
        return '#6b7280';
    })();

    const openViewer = () => {
        getActions().openMediaViewer({
            chatId,
            threadId: threadId as number,
            messageId: file.id,
            origin: MediaViewerOrigin.Inline,
        });
    };

    const handleDownload = () => {
        if (!document) return;
        getActions().downloadMedia({ media: document, originMessage: file });
    };

    const handleDelete = () => {
        getActions().deleteMessages({ messageIds: [file.id], shouldDeleteForAll: true });
        onClose();
    };

    const [isEditingTag, setIsEditingTag] = useState(false);
    const [tagValue, setTagValue] = useState(customFileName || '');

    const handleSaveTag = () => {
        if (tagValue.trim() !== customFileName) {
            getActions().setEditingId({ messageId: file.id });
            getActions().editMessage({
                messageList: { chatId, threadId: threadId as number, type: 'thread' },
                text: tagValue.trim(),
            });
        }
        setIsEditingTag(false);
    };

    return (
        <div className="DriveFilePreview">
            <div className="DriveFilePreview-header">
                <span className="preview-title">File Details</span>
                <button className="close-btn" onClick={onClose}>
                    <i className="icon icon-close" />
                </button>
            </div>

            <div className="DriveFilePreview-body">
                <div
                    className="preview-icon-box"
                    style={{ backgroundColor: `${fileColor}15` } as React.CSSProperties}
                >
                    <i
                        className="icon icon-document preview-icon"
                        style={{ color: fileColor } as React.CSSProperties}
                    />
                    {ext && <span className="file-ext">{ext.toUpperCase()}</span>}
                </div>

                <h3 className="preview-file-name">
                    {isEditingTag ? (
                        <div className="tag-edit-container">
                            <input
                                className="tag-input"
                                value={tagValue}
                                onChange={(e) => setTagValue(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveTag();
                                    if (e.key === 'Escape') setIsEditingTag(false);
                                }}
                                autoFocus
                                placeholder="Enter tag/name..."
                            />
                            <div className="tag-edit-actions">
                                <button className="tag-btn save" onClick={handleSaveTag}>Save</button>
                                <button className="tag-btn cancel" onClick={() => setIsEditingTag(false)}>Cancel</button>
                            </div>
                        </div>
                    ) : (
                        <div className="tag-display-container">
                            <span>{fileName}</span>
                            {isAdmin && (
                                <button
                                    className="tag-edit-icon"
                                    onClick={() => {
                                        setTagValue(customFileName || '');
                                        setIsEditingTag(true);
                                    }}
                                    title={customFileName ? "Edit tag" : "Add tag"}
                                >
                                    <i className={`icon ${customFileName ? 'icon-edit' : 'icon-add'}`} />
                                </button>
                            )}
                        </div>
                    )}
                </h3>

                <div className="preview-meta">
                    <div className="meta-row">
                        <span className="meta-label">Size</span>
                        <span className="meta-value">{formatSize(size)}</span>
                    </div>
                    <div className="meta-row">
                        <span className="meta-label">Date</span>
                        <span className="meta-value">{formatMediaDateTime(oldLang, file.date * 1000)}</span>
                    </div>
                    <div className="meta-row">
                        <span className="meta-label">Type</span>
                        <span className="meta-value">{ext ? ext.toUpperCase() : 'N/A'}</span>
                    </div>
                </div>

                {!hasPreviewableContent && (
                    <div className="no-content-notice">
                        <i className="icon icon-warning" />
                        <span>This message has no file attached — it may be a text-only entry.</span>
                    </div>
                )}
            </div>

            <div className="DriveFilePreview-actions">
                {hasPreviewableContent && (
                    <button className="preview-action-btn primary" onClick={openViewer}>
                        <i className="icon icon-eye-1" /> Preview
                    </button>
                )}
                {hasPreviewableContent && (
                    <button className="preview-action-btn secondary" onClick={handleDownload}>
                        <i className="icon icon-download" /> Download
                    </button>
                )}
                {isAdmin && (
                    <button className="preview-action-btn danger" onClick={handleDelete}>
                        <i className="icon icon-delete" /> Delete
                    </button>
                )}
            </div>
        </div>
    );
};

export default memo(DriveFilePreview);
