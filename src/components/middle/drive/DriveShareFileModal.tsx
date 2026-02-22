import type { FC } from '../../../lib/teact/teact';
import { memo, useState, useEffect } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';
import type { ApiUser, ApiChat, ApiMessage, ApiChatFullInfo } from '../../../api/types';
import { callApi } from '../../../api/gramjs';
import { exportChatInvite } from '../../../api/gramjs/methods/management';
import { getChatAvatarHash } from '../../../global/helpers';
import { buildDriveP2PTitle, buildDriveShareAbout, getDriveShareParticipants } from '../../../util/drive';
import { getDriveShareRecentUsernames, rememberDriveShareUsername } from '../../../util/driveShareRecentUsernames';
import useMedia from '../../../hooks/useMedia';
import { ApiMediaFormat } from '../../../api/types';

import useLang from '../../../hooks/useLang';

import './DriveShareFileModal.scss';

type OwnProps = {
    isOpen: boolean;
    file?: ApiMessage;
    sourceChatId?: string;
    onClose: () => void;
};

type StateProps = {
    currentUser?: ApiUser;
    allChats?: Record<string, ApiChat>;
    fullInfoById?: Record<string, ApiChatFullInfo>;
};

const DriveShareFileModal: FC<OwnProps & StateProps> = ({
    isOpen,
    file,
    sourceChatId,
    onClose,
    currentUser,
    allChats,
    fullInfoById,
}) => {
    const lang = useLang();

    const [username, setUsername] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | undefined>();
    const [verifiedUser, setVerifiedUser] = useState<ApiUser | ApiChat | undefined>();
    const [recentUsernames, setRecentUsernames] = useState<string[]>([]);

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

    useEffect(() => {
        if (!isOpen) return;

        void getDriveShareRecentUsernames(currentUser?.id).then((items) => {
            setRecentUsernames(items);
        });
    }, [isOpen, currentUser?.id]);

    if (!isOpen || !file || !sourceChatId) return undefined;

    const senderUsername = currentUser?.usernames?.[0]?.username;

    const handleVerifyUser = async () => {
        const cleanUsername = username.trim().replace(/^@/, '');
        if (!cleanUsername) return;

        if (!senderUsername) {
            setError(lang('DriveShareFileNeedUsername'));
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
                setError(lang('DriveShareFileUserNotFound'));
            }
        } catch (err) {
            setError(lang('DriveShareUserLookupFailed'));
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
            const expectedTitle1 = buildDriveP2PTitle(senderUsername, receiverUsername);

            let targetChannel: ApiChat | undefined = Object.values(allChats || {}).find(
                (c) => {
                    if (!c || c.isNotJoined) return false;

                    const participants = getDriveShareParticipants(c.title, fullInfoById?.[c.id]?.about);
                    if (!participants) return false;

                    return (
                        (participants.senderUsername === senderUsername.toLowerCase()
                            && participants.receiverUsername === receiverUsername.toLowerCase())
                        || (participants.senderUsername === receiverUsername.toLowerCase()
                            && participants.receiverUsername === senderUsername.toLowerCase())
                    );
                }
            );

            if (!targetChannel) {
                // Create new private channel
                const result = await callApi('createChannel', {
                    title: expectedTitle1,
                    about: buildDriveShareAbout(senderUsername, receiverUsername),
                });
                if (!result || !result.channel) throw new Error('Failed to create sharing channel');

                targetChannel = result.channel;
            } else if (!fullInfoById?.[targetChannel.id]?.about) {
                getActions().updateChat({
                    chatId: targetChannel.id,
                    title: targetChannel.title,
                    about: buildDriveShareAbout(senderUsername, receiverUsername),
                });
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
                        text: `${lang('DriveShareFileInvitePrefix')} ${inviteLinkObj.link}`,
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

            await rememberDriveShareUsername(receiverUsername, currentUser.id);

            onClose();
        } catch (e) {
            console.error(e);
            setError(lang('DriveShareFileFailed'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) onClose();
    };

    const getDisplayName = (user: ApiUser | ApiChat): string => {
        if ('firstName' in user) {
            return `${user.firstName || ''} ${user.lastName || ''}`.trim() || lang('HiddenName');
        }
        if ('title' in user) {
            return user.title || lang('HiddenName');
        }
        return lang('HiddenName');
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
                        <h2>{lang('DriveShareFileTitle')}</h2>
                        <p>{lang('DriveShareFileSubtitle')}</p>
                    </div>
                </div>

                <div className="modal-body custom-scroll">
                    {!senderUsername && (
                        <div className="drive-share-field">
                            <p className="field-error">{lang('DriveShareFileNeedUsername')}</p>
                        </div>
                    )}

                    {!verifiedUser ? (
                        <div className="drive-share-field">
                            <label className="drive-field-label">{lang('DriveShareFileRecipient')}</label>
                            <div className="input-row">
                                <span className="input-prefix">@</span>
                                <input
                                    className="share-input-inline"
                                    placeholder={lang('Username')}
                                    value={username}
                                    onChange={(e) => {
                                        setUsername(e.target.value);
                                        setError(undefined);
                                    }}
                                    onKeyDown={(e) => e.key === 'Enter' && handleVerifyUser()}
                                    disabled={!senderUsername}
                                />
                                <button className="btn-primary small" onClick={handleVerifyUser} disabled={isLoading || !username.trim() || !senderUsername}>
                                    {isLoading ? lang('DriveShareVerifying') : lang('DriveShareFileFind')}
                                </button>
                            </div>
                            {recentUsernames.length > 0 && !username.trim() && (
                                <div className="recent-usernames-row">
                                    {recentUsernames.map((recentUsername) => (
                                        <button
                                            key={recentUsername}
                                            className="recent-username-chip"
                                            onClick={() => {
                                                setUsername(recentUsername);
                                                setError(undefined);
                                            }}
                                        >
                                            @{recentUsername}
                                        </button>
                                    ))}
                                </div>
                            )}
                            {error && <p className="field-error">{error}</p>}
                        </div>
                    ) : (
                        <div className="verified-user-section">
                            <div className="verified-user-card">
                                <div className="verified-avatar">
                                    {currentAvatarBlobUrl ? (
                                        <img src={currentAvatarBlobUrl} alt="" />
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
                                {lang('Cancel')}
                            </button>
                            <button className="modal-btn primary share-action" onClick={handleShareFile} disabled={isLoading}>
                                {isLoading ? lang('DriveShareFileSharing') : lang('DriveMenuShare')}
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
            currentUser: global.currentUserId ? global.users.byId[global.currentUserId] : undefined,
            allChats: global.chats.byId,
            fullInfoById: global.chats.fullInfoById,
        };
    }
)(DriveShareFileModal));
