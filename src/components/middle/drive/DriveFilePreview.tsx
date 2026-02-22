import type { FC } from '@teact';
import { memo, useState } from '@teact';
import type { ApiMessage } from '../../../api/types';
import { getMessageContent } from '../../../global/helpers';
import { getMessageMediaHash } from '../../../global/helpers/messageMedia';
import { formatMediaDateTime } from '../../../util/dates/dateFormat';
import { MediaViewerOrigin } from '../../../types';
import { getActions } from '../../../global';
import { GENERAL_TOPIC_ID } from '../../../config';
import useOldLang from '../../../hooks/useOldLang';
import useLang from '../../../hooks/useLang';
import type { ActiveDownloads } from '../../../types';

import DriveShareFileModal from './DriveShareFileModal';

import './DriveFilePreview.scss';

const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'heic', 'heif'];
const VIDEO_EXTS = ['mp4', 'mov', 'avi', 'webm', 'mkv', 'm4v'];

type PreviewMode = 'image' | 'video' | 'none';

type OwnProps = {
    file: ApiMessage;
    sourceChatId: string;
    threadId?: number | string;
    onClose: () => void;
    isAdmin?: boolean;
    currentUserId?: string;
    activeDownloads?: ActiveDownloads;
};

const formatSize = (bytes: number) => {
    if (!bytes) return '—';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
    return (bytes / 1073741824).toFixed(1) + ' GB';
};

const DriveFilePreview: FC<OwnProps> = ({
    file,
    sourceChatId,
    threadId,
    onClose,
    isAdmin = false,
    currentUserId,
    activeDownloads,
}) => {
    const oldLang = useOldLang();
    const lang = useLang();

    const { document, photo, video } = getMessageContent(file);
    const customFileName = file.content.text?.text?.trim();
    const rawFileName = document?.fileName || (photo ? lang('DrivePreviewPhoto') : video ? lang('DrivePreviewVideo') : lang('DrivePreviewUntitled'));
    const fileName = customFileName || rawFileName;
    const size = document?.size || (video && 'size' in video ? (video as any).size : 0) || 0;
    const ext = document?.fileName?.split('.').pop()?.toLowerCase() || '';
    const downloadMediaHash = getMessageMediaHash(file, {}, 'download');
    const isDownloading = Boolean(downloadMediaHash && activeDownloads?.[downloadMediaHash]);

    const previewMode: PreviewMode = (() => {
        if (photo || IMAGE_EXTS.includes(ext)) return 'image';
        if (video || VIDEO_EXTS.includes(ext)) return 'video';
        return 'none';
    })();

    const fileColor = (() => {
        if (photo || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return '#10b981';
        if (ext === 'pdf') return '#ef4444';
        if (['doc', 'docx'].includes(ext)) return '#3b82f6';
        if (['ppt', 'pptx'].includes(ext)) return '#f97316';
        if (['mp4', 'mov', 'webm'].includes(ext)) return '#8B5CF6';
        if (['mp3', 'wav', 'ogg'].includes(ext)) return '#ec4899';
        if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return '#f59e0b';
        return '#6b7280';
    })();

    const getFileIconClass = () => {
        if (photo) return 'icon-photo';
        if (['mp4', 'mov', 'webm', 'avi'].includes(ext)) return 'icon-video';
        if (['mp3', 'wav', 'ogg'].includes(ext)) return 'icon-audio';
        if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'icon-archive';
        return 'icon-document';
    };

    const handleTelegramPreview = () => {
        getActions().openMediaViewer({
            chatId: sourceChatId,
            threadId: typeof threadId === 'number' ? threadId : undefined,
            messageId: file.id,
            origin: MediaViewerOrigin.Inline,
        });
    };

    const handleDownload = () => {
        if (document) {
            getActions().downloadMedia({ media: document, originMessage: file });
        } else if (photo || video) {
            getActions().openMediaViewer({
                chatId: sourceChatId,
                threadId: typeof threadId === 'number' ? threadId : undefined,
                messageId: file.id,
                origin: MediaViewerOrigin.Inline,
            });
        }
    };

    const handleDelete = () => {
        getActions().deleteMessages({
            messageIds: [file.id],
            shouldDeleteForAll: true,
            messageList: {
                chatId: sourceChatId,
                threadId: typeof threadId === 'number' ? threadId : GENERAL_TOPIC_ID,
                type: 'thread',
            },
        });
        onClose();
    };

    const [isEditingTag, setIsEditingTag] = useState(false);
    const [tagValue, setTagValue] = useState(customFileName || '');
    const [shareModalOpen, setShareModalOpen] = useState(false);

    const handleSaveTag = () => {
        if (tagValue.trim() !== customFileName) {
            getActions().setEditingId({ messageId: file.id });
            getActions().editMessage({
                messageList: {
                    chatId: sourceChatId,
                    threadId: typeof threadId === 'number' ? threadId : GENERAL_TOPIC_ID,
                    type: 'thread',
                },
                text: tagValue.trim(),
            });
        }
        setIsEditingTag(false);
    };

    const canManage = Boolean(isAdmin || (currentUserId && file.senderId === currentUserId));

    const previewLabel = previewMode === 'video'
        ? lang('DrivePreviewViewVideo')
        : photo ? lang('DrivePreviewViewImage') : lang('DriveMenuPreview');

    return (
        <div className="DriveFilePreview">
            <div className="DriveFilePreview-header">
                <span className="preview-title">{lang('DrivePreviewTitle')}</span>
                <button className="close-btn" onClick={onClose}>
                    <i className="icon icon-close" />
                </button>
            </div>

            <div className="DriveFilePreview-body">
                <div
                    className="preview-icon-box"
                    style={`background-color: ${fileColor}15`}
                >
                    <i
                        className={`icon ${getFileIconClass()} preview-icon`}
                        style={`color: ${fileColor}`}
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
                                placeholder={lang('DrivePreviewTagPlaceholder')}
                            />
                            <div className="tag-edit-actions">
                                <button className="tag-btn save" onClick={handleSaveTag}>{lang('Save')}</button>
                                <button className="tag-btn cancel" onClick={() => setIsEditingTag(false)}>{lang('Cancel')}</button>
                            </div>
                        </div>
                    ) : (
                        <div className="tag-display-container">
                            <span>{fileName}</span>
                            {canManage && (
                                <button
                                    className="tag-edit-icon"
                                    onClick={() => {
                                        setTagValue(customFileName || '');
                                        setIsEditingTag(true);
                                    }}
                                    title={customFileName ? lang('DrivePreviewEditTag') : lang('DrivePreviewAddTag')}
                                >
                                    <i className={`icon ${customFileName ? 'icon-edit' : 'icon-add'}`} />
                                </button>
                            )}
                        </div>
                    )}
                </h3>

                <div className="preview-meta">
                    <div className="meta-row">
                        <span className="meta-label">{lang('DriveTableColSize')}</span>
                        <span className="meta-value">{formatSize(size)}</span>
                    </div>
                    <div className="meta-row">
                        <span className="meta-label">{lang('DriveTableColDate')}</span>
                        <span className="meta-value">{formatMediaDateTime(oldLang, file.date * 1000)}</span>
                    </div>
                    <div className="meta-row">
                        <span className="meta-label">{lang('DrivePreviewType')}</span>
                        <span className="meta-value">{ext ? ext.toUpperCase() : (photo ? lang('DrivePreviewImageType') : lang('DrivePreviewNotAvailable'))}</span>
                    </div>
                    {isDownloading && (
                        <div className="transfer-progress">
                            <div className="transfer-progress-fill indeterminate" />
                        </div>
                    )}
                </div>
            </div>

            <div className="DriveFilePreview-actions">
                {(previewMode === 'image' || previewMode === 'video') && (
                    <button
                        className="preview-action-btn primary"
                        onClick={handleTelegramPreview}
                    >
                        <i className="icon icon-eye-1" /> {previewLabel}
                    </button>
                )}
                <button className="preview-action-btn secondary" onClick={handleDownload}>
                    <i className="icon icon-download" /> {lang('DriveMenuDownload')}
                </button>
                <button className="preview-action-btn secondary" onClick={() => setShareModalOpen(true)}>
                    <i className="icon icon-share" /> {lang('DriveMenuShare')}
                </button>
            </div>

            <DriveShareFileModal
                isOpen={shareModalOpen}
                file={file}
                sourceChatId={sourceChatId}
                onClose={() => setShareModalOpen(false)}
            />
        </div>
    );
};

export default memo(DriveFilePreview);
