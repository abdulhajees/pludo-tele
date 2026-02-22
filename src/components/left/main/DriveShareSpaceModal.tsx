import type { FC } from '../../../lib/teact/teact';
import { memo, useState, useEffect } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';
import type { ApiUser, ApiChat } from '../../../api/types';
import { callApi } from '../../../api/gramjs';
import { getChatAvatarHash } from '../../../global/helpers';
import useMedia from '../../../hooks/useMedia';
import { ApiMediaFormat } from '../../../api/types';
import { getDriveShareRecentUsernames, rememberDriveShareUsername } from '../../../util/driveShareRecentUsernames';

import useLang from '../../../hooks/useLang';

import './DriveShareSpaceModal.scss';

type OwnProps = {
    isOpen: boolean;
    chatId: string;
    inviteLink?: string;
    onClose: () => void;
};

type StateProps = {
    currentUser?: ApiUser;
};

const DriveShareSpaceModal: FC<OwnProps & StateProps> = ({ isOpen, chatId, inviteLink, onClose, currentUser }) => {
    const lang = useLang();

    const [username, setUsername] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | undefined>();
    const [verifiedUser, setVerifiedUser] = useState<ApiUser | ApiChat | undefined>();
    const [copied, setCopied] = useState(false);
    const [recentUsernames, setRecentUsernames] = useState<string[]>([]);

    const currentAvatarHash = verifiedUser ? getChatAvatarHash(verifiedUser) : undefined;
    const currentAvatarBlobUrl = useMedia(currentAvatarHash, false, ApiMediaFormat.BlobUrl);

    useEffect(() => {
        if (isOpen) {
            setUsername('');
            setVerifiedUser(undefined);
            setError(undefined);
            setIsLoading(false);
            setCopied(false);
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;

        void getDriveShareRecentUsernames(currentUser?.id).then((items) => {
            setRecentUsernames(items);
        });
    }, [isOpen, currentUser?.id]);

    if (!isOpen) return undefined;

    const handleVerifyUser = async () => {
        const cleanUsername = username.trim().replace(/^@/, '');
        if (!cleanUsername) return;

        setIsLoading(true);
        setError(undefined);
        setVerifiedUser(undefined);

        try {
            const result = await callApi('getChatByUsername', cleanUsername);
            if (result && result.user) {
                setVerifiedUser(result.user);
            } else {
                setError(lang('DriveShareUserNotFound'));
            }
        } catch (err) {
            setError(lang('DriveShareUserLookupFailed'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleShareSpace = async () => {
        if (!verifiedUser) return;

        const receiverUsername = ('usernames' in verifiedUser && verifiedUser.usernames?.[0])
            ? verifiedUser.usernames[0].username
            : username.trim().replace(/^@/, '').toLowerCase();

        getActions().addChatMembers({
            chatId,
            memberIds: [verifiedUser.id]
        });

        await rememberDriveShareUsername(receiverUsername, currentUser?.id);

        onClose();
    };

    const handleCopyLink = () => {
        if (!inviteLink) return;
        navigator.clipboard.writeText(inviteLink).catch(() => {
            const ta = document.createElement('textarea');
            ta.value = inviteLink;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
        });
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) onClose();
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

    const getDisplayName = (user: ApiUser | ApiChat): string => {
        if ('firstName' in user) {
            return `${user.firstName || ''} ${user.lastName || ''}`.trim() || lang('HiddenName');
        }
        if ('title' in user) {
            return user.title || lang('HiddenName');
        }
        return lang('HiddenName');
    };

    return (
        <div className="DriveShareSpaceModal-overlay" onClick={handleOverlayClick}>
            <div className="DriveShareSpaceModal">
                <div className="modal-header">
                    <div className="modal-icon">
                        <i className="icon icon-share" />
                    </div>
                    <div>
                        <h2>{lang('DriveShareSpaceTitle')}</h2>
                        <p>{lang('DriveShareSpaceSubtitle')}</p>
                    </div>
                </div>

                <div className="modal-body custom-scroll">
                    {!verifiedUser ? (
                        <div className="drive-share-field">
                            <label className="drive-field-label">{lang('DriveShareUsernameLabel')}</label>
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
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleVerifyUser();
                                    }}
                                />
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
                            {error && <div className="share-error">{error}</div>}

                            {inviteLink && (
                                <div className="drive-copy-link-section">
                                    <div className="copy-link-divider">
                                        <span>{lang('DriveShareOr')}</span>
                                    </div>
                                    <label className="drive-field-label">{lang('DriveShareCopyInviteLink')}</label>
                                    <div className="input-row copy-row">
                                        <input
                                            className="share-input-inline link-input"
                                            value={inviteLink}
                                            readOnly
                                        />
                                        <button
                                            className={`copy-btn ${copied ? 'copied' : ''}`}
                                            onClick={handleCopyLink}
                                            title={lang('Copy')}
                                        >
                                            {copied ? <i className="icon icon-check" /> : <i className="icon icon-copy" />}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="verified-user-card">
                            <div className="verified-avatar">
                                {currentAvatarBlobUrl ? (
                                    <img src={currentAvatarBlobUrl} alt="" draggable={false} />
                                ) : (
                                    <span className="user-initials">{getInitials(verifiedUser)}</span>
                                )}
                            </div>
                            <div className="verified-info">
                                <h3>{getDisplayName(verifiedUser)}</h3>
                                {('usernames' in verifiedUser && verifiedUser.usernames?.[0]) ? (
                                    <p>@{verifiedUser.usernames[0].username}</p>
                                ) : (
                                    <p>@{username}</p>
                                )}
                            </div>
                            <button
                                className="change-user-btn"
                                onClick={() => setVerifiedUser(undefined)}
                                title={lang('DriveShareChangeUser')}
                            >
                                <i className="icon icon-close" />
                            </button>
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    <div className="footer-right">
                        <button className="modal-btn cancel" onClick={onClose}>{lang('Cancel')}</button>
                        {!verifiedUser ? (
                            <button
                                className={`modal-btn primary ${isLoading ? 'loading' : ''}`}
                                onClick={handleVerifyUser}
                                disabled={isLoading || !username.trim()}
                            >
                                {isLoading ? lang('DriveShareVerifying') : lang('DriveShareVerifyUser')}
                            </button>
                        ) : (
                            <button
                                className="modal-btn share-action"
                                onClick={handleShareSpace}
                            >
                                {lang('DriveActionShareSpace')}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default memo(withGlobal<OwnProps>(
    (global): StateProps => ({
        currentUser: global.currentUserId ? global.users.byId[global.currentUserId] : undefined,
    })
)(DriveShareSpaceModal));
