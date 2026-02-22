import type { FC } from '@teact';
import { memo, useMemo, useState, useEffect } from '@teact';
import { getActions, withGlobal } from '../../../global';
import { selectChatMessages, selectTabState } from '../../../global/selectors';
import { MAIN_THREAD_ID } from '../../../api/types';
import type { ApiChat, ApiMessage } from '../../../api/types';
import type { ActiveDownloads } from '../../../types';
import { getMessageContent } from '../../../global/helpers';
import { getDocumentExtension } from '../../common/helpers/documentInfo';
import { openSystemFilesDialog } from '../../../util/systemFilesDialog';
import { parseDriveFavoriteMessage } from '../../../util/driveFavorites';
import { isDriveFolderTitle, isDriveShareTitle, normalizeDriveSectionUi } from '../../../util/drive';
import type { DriveSection, DriveSectionUi } from '../../../util/drive';

import useLang from '../../../hooks/useLang';
import DriveHeader from './DriveHeader';
import AssetTable from './AssetTable';
import DriveFilePreview from './DriveFilePreview';
import DriveNotifications from './DriveNotifications';
import Composer from '../../common/Composer';
import { DropAreaState } from '../composer/DropArea';

import './DriveView.scss';

type OwnProps = {
    chatId?: string;
    threadId?: number | string;
    isMobile?: boolean;
    section?: DriveSectionUi;
    currentUserId?: string;
    driveActiveSection?: DriveSection;
};

type StateProps = {
    messagesByChatId?: Record<string, Record<number, ApiMessage> | undefined>;
    savedMessagesById?: Record<number, ApiMessage>;
    inviteLink?: string;
    driveFoldersIds?: string[];
    driveFoldersById?: Record<string, ApiChat>;
    isCurrentChatAdmin?: boolean;
    activeDownloads?: ActiveDownloads;
};

type FilterType = 'all' | 'doc' | 'image' | 'pdf' | 'video' | 'audio' | 'archive' | 'sheet' | 'code';
type TimeFilterType = 'all' | '24h' | '7d' | '30d';

type DriveFileItem = {
    id: string;
    sourceChatId: string;
    file: ApiMessage;
};

const DriveView: FC<OwnProps & StateProps> = ({
    chatId,
    threadId,
    isMobile,
    messagesByChatId,
    savedMessagesById,
    inviteLink,
    section = 'my-files',
    currentUserId,
    driveActiveSection,
    driveFoldersIds,
    driveFoldersById,
    isCurrentChatAdmin,
    activeDownloads,
}) => {
    const lang = useLang();

    const [searchQuery, setSearchQuery] = useState('');
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [selectedFile, setSelectedFile] = useState<DriveFileItem | undefined>(undefined);
    const [activeFilter, setActiveFilter] = useState<FilterType>('all');
    const [activeTimeFilter, setActiveTimeFilter] = useState<TimeFilterType>('all');
    const [shouldSearchSpaces, setShouldSearchSpaces] = useState(false);
    const [isDraggingOver, setIsDraggingOver] = useState(false);

    const isAdmin = Boolean(isCurrentChatAdmin);

    useEffect(() => {
        if (driveFoldersIds && driveFoldersIds.length > 0) {
            const actions = getActions();
            driveFoldersIds.forEach((id) => {
                actions.loadViewportMessages({ chatId: id, threadId: MAIN_THREAD_ID });
            });
        }
    }, [driveFoldersIds?.join(',')]);

    useEffect(() => {
        setSelectedFile(undefined);
    }, [chatId, driveActiveSection]);

    const handleUploadClick = () => {
        openSystemFilesDialog('*', (e: Event) => {
            const target = e.target as HTMLInputElement;
            if (target && target.files && target.files.length > 0) {
                const files = Array.from(target.files);
                window.dispatchEvent(new CustomEvent('ui-drive-upload', { detail: { files, forceAsFile: true, targetChatId: chatId } }));
            }
        });
    };

    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (isAdmin) setIsDraggingOver(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(false);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isDraggingOver && isAdmin) setIsDraggingOver(true);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(false);
        if (!isAdmin) return;

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const files = Array.from(e.dataTransfer.files);
            window.dispatchEvent(new CustomEvent('ui-drive-upload', { detail: { files, forceAsFile: true, targetChatId: chatId } }));
        }
    };

    const handleSidebarToggle = () => {
        setIsSidebarCollapsed((prev) => !prev);
        const leftColumn = document.getElementById('LeftColumn') as HTMLElement | null;
        if (leftColumn) {
            leftColumn.classList.toggle('drive-sidebar-collapsed', !isSidebarCollapsed);
        }
    };

    const handleShareClick = () => {
        if (!inviteLink) return;
        navigator.clipboard.writeText(inviteLink).catch(() => {
            const textarea = window.document.createElement('textarea');
            textarea.value = inviteLink;
            window.document.body.appendChild(textarea);
            textarea.select();
            window.document.execCommand('copy');
            window.document.body.removeChild(textarea);
        });
    };

    const allFiles = useMemo(() => {
        if (!messagesByChatId) return [];

        const items: DriveFileItem[] = [];

        Object.entries(messagesByChatId).forEach(([sourceChatId, messagesById]) => {
            if (!messagesById) return;

            Object.values(messagesById).forEach((message) => {
                const { document, photo, video } = getMessageContent(message);
                if (!(document || photo || video)) return;

                items.push({
                    id: `${sourceChatId}_${message.id}`,
                    sourceChatId,
                    file: message,
                });
            });
        });

        return items.sort((a, b) => b.file.date - a.file.date);
    }, [messagesByChatId]);

    const sectionFiles = useMemo(() => {
        const targetSection = normalizeDriveSectionUi(driveActiveSection) || section;

        if (targetSection === 'sharing') {
            return allFiles;
        }

        if (targetSection === 'recent') {
            return allFiles.slice(0, 10);
        }

        if (targetSection === 'favorites') {
            const favoriteMeta = Object.values(savedMessagesById || {})
                .map((message) => parseDriveFavoriteMessage(message.content.text?.text))
                .filter(Boolean) as ReturnType<typeof parseDriveFavoriteMessage>[];

            const favoriteKeys = new Set(favoriteMeta.map((entry) => `${entry!.sourceChatId}:${entry!.messageId}`));

            return allFiles.filter(({ sourceChatId, file }) => favoriteKeys.has(`${sourceChatId}:${file.id}`));
        }

        return allFiles;
    }, [allFiles, section, driveActiveSection, currentUserId, savedMessagesById]);

    const files = useMemo(() => {
        let result = sectionFiles;

        if (activeFilter !== 'all') {
            result = result.filter(({ file }) => {
                const { document, photo } = getMessageContent(file);
                const ext = document ? getDocumentExtension(document)?.toLowerCase() : '';
                if (activeFilter === 'image') return photo || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '');
                if (activeFilter === 'pdf') return ext === 'pdf';
                if (activeFilter === 'doc') return ['doc', 'docx', 'txt', 'ppt', 'pptx'].includes(ext || '');
                if (activeFilter === 'video') return ['mp4', 'mov', 'avi', 'mkv'].includes(ext || '');
                if (activeFilter === 'audio') return ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext || '');
                if (activeFilter === 'archive') return ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext || '');
                if (activeFilter === 'sheet') return ['xls', 'xlsx', 'csv', 'ods'].includes(ext || '');
                if (activeFilter === 'code') return ['json', 'xml', 'yaml', 'yml', 'ts', 'tsx', 'js', 'jsx', 'css', 'scss', 'html', 'md'].includes(ext || '');
                return true;
            });
        }

        if (activeTimeFilter !== 'all') {
            const now = Date.now();
            const threshold = activeTimeFilter === '24h'
                ? now - 24 * 60 * 60 * 1000
                : activeTimeFilter === '7d'
                    ? now - 7 * 24 * 60 * 60 * 1000
                    : now - 30 * 24 * 60 * 60 * 1000;

            result = result.filter(({ file }) => (file.date * 1000) >= threshold);
        }

        if (searchQuery.trim().length > 0) {
            const lowerQuery = searchQuery.toLowerCase();
            result = result.filter(({ file, sourceChatId }) => {
                const { document } = getMessageContent(file);
                const customFileName = file.content.text?.text?.trim();
                const rawFileName = document?.fileName || 'file';
                const nameMatched = (customFileName || rawFileName).toLowerCase().includes(lowerQuery);
                if (nameMatched) return true;

                if (!shouldSearchSpaces) return false;

                const folder = driveFoldersById?.[sourceChatId];
                const folderName = folder?.title?.toLowerCase() || '';
                return folderName.includes(lowerQuery);
            });
        }

        return result;
    }, [sectionFiles, activeFilter, activeTimeFilter, searchQuery, shouldSearchSpaces, driveFoldersById]);

    const filters: { id: FilterType; label: string }[] = [
        { id: 'all', label: lang('DriveFilterAll') },
        { id: 'doc', label: lang('DriveFilterDocuments') },
        { id: 'image', label: lang('DriveFilterImages') },
        { id: 'pdf', label: lang('DriveFilterPdfs') },
        { id: 'video', label: lang('DriveFilterVideos') },
        { id: 'audio', label: lang('DriveFilterAudio') },
        { id: 'archive', label: lang('DriveFilterArchives') },
        { id: 'sheet', label: lang('DriveFilterSheets') },
        { id: 'code', label: lang('DriveFilterCode') },
    ];

    const timeFilters: { id: TimeFilterType; label: string }[] = [
        { id: 'all', label: lang('DriveFilterTimeAll') },
        { id: '24h', label: lang('DriveFilterTime24h') },
        { id: '7d', label: lang('DriveFilterTime7d') },
        { id: '30d', label: lang('DriveFilterTime30d') },
    ];

    const favoriteMeta = useMemo(() => {
        return Object.values(savedMessagesById || {})
            .map((message) => parseDriveFavoriteMessage(message.content.text?.text))
            .filter(Boolean) as ReturnType<typeof parseDriveFavoriteMessage>[];
    }, [savedMessagesById]);

    const favoriteKeys = useMemo(() => {
        const map: Record<string, true> = {};

        favoriteMeta.forEach((entry) => {
            if (!entry) return;
            map[`${entry.sourceChatId}:${entry.messageId}`] = true;
        });

        return map;
    }, [favoriteMeta]);

    if (!chatId && !driveActiveSection) {
        return (
            <div className={`DriveView empty-bg ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`} />
        );
    }

    const driveSection = normalizeDriveSectionUi(driveActiveSection);

    const driveTitle = chatId
        ? lang('DriveTitleSpaceFolder')
        : driveSection === 'sharing'
            ? lang('DriveTitleSharedWithMe')
            : driveSection === 'recent'
                ? lang('Recent')
                : driveSection === 'favorites'
                    ? lang('DriveTitleFavorites')
                : lang('DriveTitleYourDrive');

    const driveSubtitle = chatId
        ? lang('DriveSubtitleSpaceFolder')
        : driveSection === 'sharing'
            ? lang('DriveSubtitleSharedWithMe')
            : driveSection === 'recent'
                ? lang('DriveSubtitleRecent')
                : driveSection === 'favorites'
                    ? lang('DriveSubtitleFavorites')
                : lang('DriveSubtitleYourDrive');

    const selectedThreadId = selectedFile?.sourceChatId === chatId ? threadId : undefined;

    return (
        <div
            className={`DriveView ${isDraggingOver ? 'drag-over' : ''}`}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            {isDraggingOver && (
                <div className="drive-drop-overlay">
                    <div className="drop-content">
                        <i className="icon icon-upload" />
                        <h2>{lang('DriveDropTitle')}</h2>
                        <p>{lang('DriveDropText')}</p>
                    </div>
                </div>
            )}
            <DriveHeader
                chatId={chatId || ''}
                threadId={threadId}
                onUploadClick={isAdmin && chatId ? handleUploadClick : undefined}
                onShareClick={isAdmin && chatId ? handleShareClick : undefined}
                onSidebarToggle={handleSidebarToggle}
                isSidebarCollapsed={isSidebarCollapsed}
                searchQuery={searchQuery}
                onSearchQueryChange={setSearchQuery}
            />
            <div className="DriveView-body">
                {driveActiveSection === 'notifications' ? (
                    <DriveNotifications />
                ) : (
                    <div className="DriveView-content custom-scroll">
                        <div className="DriveView-page-header">
                            <h1>{driveTitle}</h1>
                            <p>{driveSubtitle}</p>
                        </div>

                        <div className="DriveView-filters">
                            {filters.map((f) => (
                                <button
                                    key={f.id}
                                    className={`filter-pill ${activeFilter === f.id ? 'active' : ''}`}
                                    onClick={() => setActiveFilter(f.id)}
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>

                        <div className="DriveView-filters secondary">
                            {timeFilters.map((f) => (
                                <button
                                    key={f.id}
                                    className={`filter-pill ${activeTimeFilter === f.id ? 'active' : ''}`}
                                    onClick={() => setActiveTimeFilter(f.id)}
                                >
                                    {f.label}
                                </button>
                            ))}
                            <button
                                className={`filter-pill ${shouldSearchSpaces ? 'active' : ''}`}
                                onClick={() => setShouldSearchSpaces((prev) => !prev)}
                            >
                                {lang('DriveFilterSearchSpaces')}
                            </button>
                        </div>

                        <AssetTable
                            files={files}
                            chatId={chatId}
                            threadId={threadId}
                            onFileSelect={setSelectedFile}
                            isAdmin={isAdmin}
                            tableMode={driveSection === 'sharing' ? 'sharing' : 'space'}
                            favoriteKeys={favoriteKeys}
                        />
                    </div>
                )}
                {selectedFile && (
                    <DriveFilePreview
                        file={selectedFile.file}
                        sourceChatId={selectedFile.sourceChatId}
                        threadId={selectedThreadId}
                        onClose={() => setSelectedFile(undefined)}
                        isAdmin={isAdmin}
                        currentUserId={currentUserId}
                        activeDownloads={activeDownloads}
                    />
                )}
            </div>

            {
                chatId && isAdmin && (
                    <div className="hidden-composer">
                        <Composer
                            type="messageList"
                            chatId={chatId}
                            threadId={threadId as number}
                            messageListType="thread"
                            dropAreaState={DropAreaState.None}
                            isReady={true}
                            isMobile={isMobile}
                            editableInputId="drive-upload-input"
                            editableInputCssSelector=".drive-upload-input"
                            inputId="message-input-text"
                        />
                    </div>
                )
            }
        </div >
    );
};

export default memo(withGlobal<OwnProps>(
    (global, { chatId, driveActiveSection }): StateProps => {
        let messagesByChatId: Record<string, Record<number, ApiMessage> | undefined> | undefined;
        let savedMessagesById: Record<number, ApiMessage> | undefined;
        let inviteLink: string | undefined;
        let driveFoldersIds: string[] | undefined;
        const fullInfoById = global.chats.fullInfoById || {};

        if (chatId) {
            messagesByChatId = {
                [chatId]: selectChatMessages(global, chatId),
            };
            inviteLink = global.chats.fullInfoById[chatId]?.inviteLink;
        } else if (driveActiveSection) {
            messagesByChatId = {};
            const allChats = Object.values(global.chats.byId || {});
            const driveFolders = allChats.filter(
                (chat) => chat
                    && isDriveFolderTitle(chat.title, fullInfoById[chat.id]?.about)
                    && !chat.isNotJoined
                    && !chat.isRestricted
            ) as ApiChat[];
            const shareFolders = allChats.filter(
                (chat) => chat
                    && isDriveShareTitle(chat.title, fullInfoById[chat.id]?.about)
                    && !chat.isNotJoined
                    && !chat.isRestricted
            ) as ApiChat[];

            const sourceChats = driveActiveSection === 'sharing'
                ? shareFolders
                : (driveActiveSection === 'recent' || driveActiveSection === 'favorites')
                    ? [...driveFolders, ...shareFolders]
                    : driveFolders;

            sourceChats.forEach((folder) => {
                messagesByChatId![folder.id] = selectChatMessages(global, folder.id);
            });
            driveFoldersIds = sourceChats.map((f) => f.id);
            savedMessagesById = global.currentUserId ? selectChatMessages(global, global.currentUserId) : undefined;
        }

        return {
            messagesByChatId,
            savedMessagesById,
            inviteLink,
            driveFoldersIds,
            driveFoldersById: global.chats.byId,
            isCurrentChatAdmin: chatId ? Boolean(global.chats.byId[chatId]?.isCreator || Object.values(global.chats.byId[chatId]?.adminRights || {}).some(Boolean)) : false,
            activeDownloads: selectTabState(global).activeDownloads,
        };
    }
)(DriveView));
