import type { FC } from '@teact';
import { memo, useMemo, useState, useEffect } from '@teact';
import { getActions, withGlobal } from '../../../global';
import { selectChatMessages } from '../../../global/selectors';
import type { ApiChat, ApiMessage } from '../../../api/types';
import { getMessageContent } from '../../../global/helpers';
import { getDocumentExtension } from '../../common/helpers/documentInfo';
import { openSystemFilesDialog } from '../../../util/systemFilesDialog';

import DriveHeader from './DriveHeader';
import QuickAccess from './QuickAccess';
import AssetTable from './AssetTable';
import DriveFilePreview from './DriveFilePreview';
import DriveNotifications from './DriveNotifications';
import Composer from '../../common/Composer';
import { DropAreaState } from '../composer/DropArea';
import { useSpacePermissions } from '../../left/main/DrivePermissions';

import './DriveView.scss';

type OwnProps = {
    chatId?: string;
    threadId?: number | string;
    isMobile?: boolean;
    section?: 'my-files' | 'sharing' | 'deleted';
    currentUserId?: string;
    driveActiveSection?: string;
};

type StateProps = {
    messagesById?: Record<number, ApiMessage>;
    inviteLink?: string;
    driveFoldersIds?: string[];
};

type FilterType = 'all' | 'doc' | 'image' | 'pdf' | 'video';

const DriveView: FC<OwnProps & StateProps> = ({
    chatId,
    threadId,
    isMobile,
    messagesById,
    inviteLink,
    section = 'my-files',
    currentUserId,
    driveActiveSection,
    driveFoldersIds,
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [selectedFile, setSelectedFile] = useState<ApiMessage | undefined>(undefined);
    const [activeFilter, setActiveFilter] = useState<FilterType>('all');
    const [isDraggingOver, setIsDraggingOver] = useState(false);

    const { isAdmin } = useSpacePermissions(chatId || '');

    useEffect(() => {
        if (driveFoldersIds && driveFoldersIds.length > 0) {
            const actions = getActions();
            driveFoldersIds.forEach(id => {
                actions.loadViewportMessages({ chatId: id });
            });
        }
    }, [driveFoldersIds?.join(',')]);

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

    const messages = useMemo(() => {
        if (!messagesById) return [];
        return Object.values(messagesById).sort((a, b) => b.date - a.date);
    }, [messagesById]);

    const allFiles = useMemo(() => {
        return messages.filter((msg) => {
            const { document, photo, video } = getMessageContent(msg);
            return document || photo || video;
        });
    }, [messages]);

    const sectionFiles = useMemo(() => {
        const targetSection = driveActiveSection || section;
        if (targetSection === 'sharing') {
            return allFiles.filter((f) => f.senderId && f.senderId !== currentUserId);
        }
        if (targetSection === 'recent') {
            return allFiles.sort((a, b) => b.date - a.date).slice(0, 50);
        }
        return allFiles;
    }, [allFiles, section, driveActiveSection, currentUserId]);

    const files = useMemo(() => {
        let result = sectionFiles;

        if (activeFilter !== 'all') {
            result = result.filter((file) => {
                const { document, photo } = getMessageContent(file);
                const ext = document ? getDocumentExtension(document)?.toLowerCase() : '';
                if (activeFilter === 'image') return photo || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '');
                if (activeFilter === 'pdf') return ext === 'pdf';
                if (activeFilter === 'doc') return ['doc', 'docx', 'txt', 'ppt', 'pptx'].includes(ext || '');
                if (activeFilter === 'video') return ['mp4', 'mov', 'avi', 'mkv'].includes(ext || '');
                return true;
            });
        }

        if (searchQuery.trim().length > 0) {
            const lowerQuery = searchQuery.toLowerCase();
            result = result.filter((file) => {
                const { document } = getMessageContent(file);
                const customFileName = file.content.text?.text?.trim();
                const rawFileName = document?.fileName || 'file';
                return (customFileName || rawFileName).toLowerCase().includes(lowerQuery);
            });
        }

        return result;
    }, [sectionFiles, activeFilter, searchQuery]);

    const filters: { id: FilterType; label: string }[] = [
        { id: 'all', label: 'All' },
        { id: 'doc', label: 'Documents' },
        { id: 'image', label: 'Images' },
        { id: 'pdf', label: 'PDFs' },
        { id: 'video', label: 'Videos' },
    ];

    if (!chatId && !driveActiveSection) {
        return (
            <div className={`DriveView empty-bg ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`} />
        );
    }

    const driveTitle = chatId
        ? 'Space Folder'
        : driveActiveSection === 'sharing'
            ? 'Shared with me'
            : driveActiveSection === 'recent'
                ? 'Recent'
                : 'Your Drive';

    const driveSubtitle = chatId
        ? 'Manage files in this space.'
        : driveActiveSection === 'sharing'
            ? 'Files shared by other members.'
            : driveActiveSection === 'recent'
                ? 'Recently uploaded and modified files.'
                : 'Upload and manage your assets securely.';

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
                        <h2>Drop files to upload</h2>
                        <p>Files will instantly upload to this Space</p>
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

                        {(driveActiveSection === 'my_files' || (!driveActiveSection && section === 'my-files')) && <QuickAccess files={allFiles} />}

                        <AssetTable
                            files={files}
                            chatId={chatId || ''}
                            threadId={threadId}
                            onFileSelect={setSelectedFile}
                            isAdmin={isAdmin}
                        />
                    </div>
                )}
                {selectedFile && (
                    <DriveFilePreview
                        file={selectedFile}
                        chatId={chatId || ''}
                        threadId={threadId}
                        onClose={() => setSelectedFile(undefined)}
                        isAdmin={isAdmin}
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
        let messagesById: Record<number, ApiMessage> | undefined;
        let inviteLink: string | undefined;
        let driveFoldersIds: string[] | undefined;

        if (chatId) {
            messagesById = selectChatMessages(global, chatId);
            inviteLink = global.chats.fullInfoById[chatId]?.inviteLink;
        } else if (driveActiveSection) {
            messagesById = {};
            const allChats = Object.values(global.chats.byId || {});
            const driveFolders = allChats.filter(
                (chat) => chat && chat.title && chat.title.toLowerCase().startsWith('pludo-drive') && !chat.isNotJoined && !chat.isRestricted
            ) as ApiChat[];

            driveFolders.forEach(folder => {
                const folderMessages = selectChatMessages(global, folder.id);
                if (folderMessages) {
                    Object.assign(messagesById!, folderMessages);
                }
            });
            driveFoldersIds = driveFolders.map(f => f.id);
        }

        return {
            messagesById,
            inviteLink,
            driveFoldersIds,
        };
    }
)(DriveView));
