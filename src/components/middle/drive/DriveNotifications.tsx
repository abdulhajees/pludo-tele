import type { FC } from '../../../lib/teact/teact';
import { memo, useMemo, useState } from '../../../lib/teact/teact';
import { withGlobal } from '../../../global';
import type { ApiMessage, ApiChat } from '../../../api/types';
import { isChatBasicGroup, isChatSuperGroup, isChatChannel } from '../../../global/helpers';

import './DriveNotifications.scss';

type StateProps = {
    allMessagesByChatId?: Record<string, Record<number, ApiMessage>>;
    allChatsById?: Record<string, ApiChat>;
    currentUserId?: string;
};

type NotificationItem = {
    id: string; // chat_id + msg_id
    type: 'invite' | 'file';
    timestamp: number;
    senderId: string;
    text?: string;
    filePath?: string; // used for files
    inviteLink?: string; // used for invites
    message: ApiMessage;
    chat: ApiChat;
};

const DriveNotifications: FC<StateProps> = ({
    allMessagesByChatId,
    allChatsById,
    currentUserId
}) => {
    const [activeTab, setActiveTab] = useState<'all' | 'files' | 'invites'>('all');

    const notifications = useMemo(() => {
        if (!allMessagesByChatId || !allChatsById) return [];

        let items: NotificationItem[] = [];

        Object.keys(allMessagesByChatId).forEach((chatId) => {
            const chat = allChatsById[chatId];
            if (!chat) return;

            const isDM = !isChatBasicGroup(chat) && !isChatSuperGroup(chat) && !isChatChannel(chat);
            const isShareChannel = chat.title?.toLowerCase().startsWith('pludo-drive-share_');

            const chatMessages = Object.values(allMessagesByChatId[chatId]);

            chatMessages.forEach((msg) => {
                if (!msg || msg.senderId === currentUserId) return; // skip own messages

                // Check for Invite Links in DMs
                if (isDM && msg.content?.text?.text.includes('pludo.systems/drive/')) {
                    const textContent = msg.content.text.text;
                    const regex = /(https?:\/\/(?:www\.)?pludo\.systems\/drive\/\+?[^\s]+)/gi;
                    const matches = textContent.match(regex);
                    if (matches && matches.length > 0) {
                        items.push({
                            id: `${chatId}_${msg.id}`,
                            type: 'invite',
                            timestamp: msg.date,
                            senderId: msg.senderId || chatId,
                            text: textContent,
                            inviteLink: matches[0],
                            message: msg,
                            chat
                        });
                    }
                }

                // Check for Shared Files in hidden channels
                if (isShareChannel && (msg.content?.document || msg.content?.photo || msg.content?.video)) {
                    items.push({
                        id: `${chatId}_${msg.id}`,
                        type: 'file',
                        timestamp: msg.date,
                        senderId: msg.senderId || '',
                        message: msg,
                        chat
                    });
                }
            });
        });

        // Filter out items without valid senderId for 'file' type if necessary, or sort by date
        return items.sort((a, b) => b.timestamp - a.timestamp);
    }, [allMessagesByChatId, allChatsById, currentUserId]);

    const filteredNotifications = useMemo(() => {
        if (activeTab === 'all') return notifications;
        return notifications.filter(n => n.type === activeTab.replace(/s$/, '')); // naive singularize -> 'file' / 'invite'
    }, [notifications, activeTab]);

    const emptyStateTitle = activeTab === 'all'
        ? 'No Notifications'
        : activeTab === 'files'
            ? 'No Recent Files'
            : 'No Pending Invites';

    const emptyStateText = activeTab === 'all'
        ? "You're all caught up! Pending invites and shared files will appear here."
        : activeTab === 'files'
            ? "Files directly shared with you will appear here."
            : "Any Space invite links sent to you will appear here.";

    return (
        <div className="DriveNotifications custom-scroll">
            <div className="DriveNotifications-header">
                <h1>Notifications</h1>
                <p>Stay updated with invites and files shared with you.</p>
            </div>

            <div className="DriveView-filters">
                <button
                    className={`filter-pill ${activeTab === 'all' ? 'active' : ''}`}
                    onClick={() => setActiveTab('all')}
                >
                    All
                </button>
                <button
                    className={`filter-pill ${activeTab === 'files' ? 'active' : ''}`}
                    onClick={() => setActiveTab('files')}
                >
                    Files
                </button>
                <button
                    className={`filter-pill ${activeTab === 'invites' ? 'active' : ''}`}
                    onClick={() => setActiveTab('invites')}
                >
                    Invites
                </button>
            </div>

            <div className="DriveNotifications-list">
                {filteredNotifications.length === 0 ? (
                    <div className="empty-state">
                        <i className={`icon ${activeTab === 'files' ? 'icon-document' : 'icon-info'}`} />
                        <h3>{emptyStateTitle}</h3>
                        <p>{emptyStateText}</p>
                    </div>
                ) : (
                    filteredNotifications.map((notif) => (
                        <div key={notif.id} className="notification-card">
                            <div className="notification-icon">
                                <i className={`icon ${notif.type === 'file' ? 'icon-document' : 'icon-link'}`} />
                            </div>
                            <div className="notification-content">
                                <h4>{notif.type === 'file' ? 'New file shared with you' : 'New Drive Space Invite'}</h4>
                                <p className="notification-detail">
                                    {notif.type === 'invite' ? notif.text : 'A file was uploaded to your direct sharing channel.'}
                                </p>
                                <span className="notification-time">
                                    {new Date(notif.timestamp * 1000).toLocaleString()}
                                </span>
                            </div>
                            {notif.type === 'invite' && notif.inviteLink && (
                                <a className="btn-primary small" href={notif.inviteLink} target="_blank" rel="noopener noreferrer">
                                    Open Link
                                </a>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default memo(withGlobal<{}>(
    (global): StateProps => {
        return {
            allMessagesByChatId: global.messages.byChatId,
            allChatsById: global.chats.byId,
            currentUserId: global.currentUserId,
        };
    }
)(DriveNotifications));
