import type { FC } from '../../../lib/teact/teact';
import { memo, useState, useEffect } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';
import type { ApiUser, ApiChat, ApiMessage } from '../../../api/types';
import { callApi } from '../../../api/gramjs';
import { exportChatInvite } from '../../../api/gramjs/methods/management';
import { getChatAvatarHash } from '../../../global/helpers';
import useMedia from '../../../hooks/useMedia';
import { ApiMediaFormat } from '../../../api/types';

import './DriveShareFileModal.scss';

type OwnProps = {
    isOpen: boolean;
    file?: ApiMessage;
    sourceChatId?: string;
    onClose: () => void;
};

type StateProps = {
    currentUserId?: string;
    currentUser?: ApiUser;
    allChats?: Record<string, ApiChat>;
};

const DriveShareFileModal: FC<OwnProps & StateProps> = ({
    isOpen,
    file,
    sourceChatId,
    onClose,
    currentUserId,
    currentUser,
    allChats
}) => {
    const [username, setUsername] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | undefined>();
    const [verifiedUser, setVerifiedUser] = useState<ApiUser | ApiChat | undefined>();

    const currentAvatarHash = verifiedUser ? getChatAvatarHash(verifiedUser) : undefined;
    const currentAvatarBlobUrl = useMedia(currentAvatarHash, false, ApiMediaFormat.BlobUrl);

    useEffect(() => {
        if (isOpen) {
            setUsername('');
            setVerifiedUser(undefined);
            setError(undefined);
            setIsLoading(false);
        }
    }, [isOpen]);

    if (!isOpen || !file || !sourceChatId) return undefined;

    const senderUsername = currentUser?.usernames?.[0]?.username;

    const handleVerifyUser = async () => {
        const cleanUsername = username.trim().replace(/^@/, '');
        if (!cleanUsername) return;

        if (!senderUsername) {
            setError('You must have a Telegram @username to share files directly.');
            return;
        }

        setIsLoading(true);
        setError(undefined);
        setVerifiedUser(undefined);

        try {
            const result = await callApi('getChatByUsername', cleanUsername);
            if (result && result.user && result.user.usernames?.length) {
                setVerifiedUser(result.user);
            } else {
                setError('User not found or they do not have a @username.');
            }
        } catch (err) {
            setError('Error finding user.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleShareFile = async () => {
        if (!verifiedUser || !currentUser || !senderUsername) return;
        const receiverUsername = (verifiedUser as ApiUser).usernames?.[0]?.username;
        if (!receiverUsername) return;

        setIsLoading(true);

        try {
            const expectedTitle1 = `pludo-drive-share_${senderUsername}_${receiverUsername}`;
            const expectedTitle2 = `pludo-drive-share_${receiverUsername}_${senderUsername}`;

            let targetChannel: ApiChat | undefined = Object.values(allChats || {}).find(
                (c) => c && c.title && (c.title === expectedTitle1 || c.title === expectedTitle2) && !c.isNotJoined
            );

            if (!targetChannel) {
                // Create new private channel
                const result = await callApi('createChannel', {
                    title: expectedTitle1,
                    about: 'Pludo Drive P2P Sharing Channel',
                });
                if (!result || !result.channel) throw new Error('Failed to create sharing channel');

                targetChannel = result.channel;
            }

            if (!targetChannel) throw new Error('Missing target channel');

            // Always add the user to ensure they are inside
            try {
                await callApi('addChatMembers', targetChannel, [verifiedUser as ApiUser]);
            } catch (memberErr) {
                console.warn('Could not add user directly, sending invite link via DM instead', memberErr);
                const inviteLinkObj = await exportChatInvite({ peer: targetChannel });
                if (inviteLinkObj && inviteLinkObj.link) {
                    getActions().sendMessage({
                        chat: verifiedUser as ApiChat,
                        text: `I shared a file with you on Pludo Drive! Join here to access it: ${inviteLinkObj.link}`,
                    });
                }
            }

            // Forward the file directly using API
            const sourceChat = allChats?.[sourceChatId];
            if (sourceChat && targetChannel) {
                await callApi('forwardMessages', {
                    fromChat: sourceChat,
                    toChat: targetChannel,
                    messages: [file],
                });
            }

            // Sync folders to categorize it immediately
            getActions().syncDriveChatFolders();

            onClose();
        } catch (e) {
            console.error(e);
            setError('Failed to share file.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) onClose();
    };

    const getDisplayName = (user: ApiUser | ApiChat): string => {
        if ('firstName' in user) {
            return `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'User';
        }
        if ('title' in user) {
            return user.title || 'User';
        }
        return 'User';
    };

    const getInitials = (user: ApiUser | ApiChat): string => {
        if ('firstName' in user) {
            return `${user.firstName?.charAt(0) || ''}${user.lastName?.charAt(0) || ''}`.toUpperCase() || 'U';
        }
        if ('title' in user) {
            return user.title?.charAt(0).toUpperCase() || '?';
        }
        return '?';
    };

    return (
        <div className="DriveShareSpaceModal-overlay" onClick={handleOverlayClick}>
            <div className="DriveShareSpaceModal">
                <div className="modal-header">
                    <div className="modal-icon">
                        <i className="icon icon-share" />
                    </div>
                    <div>
                        <h2>Share File</h2>
                        <p>Share directly with a Telegram username</p>
                    </div>
                </div>

                <div className="modal-body custom-scroll">
                    {!senderUsername && (
                        <div className="drive-share-field">
                            <p className="field-error">You must configure a Telegram @username in your settings before you can share files directly.</p>
                        </div>
                    )}

                    {!verifiedUser ? (
                        <div className="drive-share-field">
                            <label className="drive-field-label">Recipient's Username</label>
                            <div className="input-row">
                                <span className="input-prefix">@</span>
                                <input
                                    className="share-input-inline"
                                    placeholder="username"
                                    value={username}
                                    onChange={(e) => {
                                        setUsername(e.target.value);
                                        setError(undefined);
                                    }}
                                    onKeyDown={(e) => e.key === 'Enter' && handleVerifyUser()}
                                    disabled={!senderUsername}
                                />
                                <button className="btn-primary small" onClick={handleVerifyUser} disabled={isLoading || !username.trim() || !senderUsername}>
                                    {isLoading ? '...' : 'Find'}
                                </button>
                            </div>
                            {error && <p className="field-error">{error}</p>}
                        </div>
                    ) : (
                        <div className="verified-user-section">
                            <div className="verified-user-card">
                                <div className="verified-avatar">
                                    {currentAvatarBlobUrl ? (
                                        <img src={currentAvatarBlobUrl} alt="avatar" />
                                    ) : (
                                        <span className="user-initials">{getInitials(verifiedUser)}</span>
                                    )}
                                </div>
                                <div className="verified-info">
                                    <h3>{getDisplayName(verifiedUser)}</h3>
                                    <p>@{username}</p>
                                </div>
                                <button className="change-user-btn" onClick={() => setVerifiedUser(undefined)}>
                                    <i className="icon icon-close" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {verifiedUser && (
                    <div className="modal-footer">
                        {error && <p className="share-error">{error}</p>}
                        <div className="footer-right">
                            <button className="modal-btn cancel" onClick={() => {
                                setVerifiedUser(undefined);
                                onClose();
                            }}>
                                Cancel
                            </button>
                            <button className="modal-btn primary share-action" onClick={handleShareFile} disabled={isLoading}>
                                {isLoading ? 'Sharing...' : 'Share File'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default memo(withGlobal<OwnProps>(
    (global): StateProps => {
        return {
            currentUserId: global.currentUserId,
            currentUser: global.currentUserId ? global.users.byId[global.currentUserId] : undefined,
            allChats: global.chats.byId,
        };
    }
)(DriveShareFileModal));
