import type { FC } from '../../../lib/teact/teact';
import { memo, useState, useEffect, useCallback } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';
import type { ApiUser, ApiChat } from '../../../api/types';
import { callApi } from '../../../api/gramjs';
import { getChatAvatarHash } from '../../../global/helpers';
import useMedia from '../../../hooks/useMedia';
import { ApiMediaFormat } from '../../../api/types';
import renderText from '../../common/helpers/renderText';

import './DriveShareSpaceModal.scss';

type OwnProps = {
    isOpen: boolean;
    chatId: string;
    inviteLink?: string;
    onClose: () => void;
};

type StateProps = {};

const DriveShareSpaceModal: FC<OwnProps & StateProps> = ({ isOpen, chatId, inviteLink, onClose }) => {
    const [username, setUsername] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | undefined>();
    const [verifiedUser, setVerifiedUser] = useState<ApiUser | ApiChat | undefined>();
    const [copied, setCopied] = useState(false);

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
                setError('User not found.');
            }
        } catch (err) {
            setError('Error finding user.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleShareSpace = () => {
        if (!verifiedUser) return;

        getActions().addChatMembers({
            chatId,
            memberIds: [verifiedUser.id]
        });

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
            return `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'User';
        }
        if ('title' in user) {
            return user.title || 'User';
        }
        return 'User';
    };

    return (
        <div className="DriveShareSpaceModal-overlay" onClick={handleOverlayClick}>
            <div className="DriveShareSpaceModal">
                <div className="modal-header">
                    <div className="modal-icon">
                        <i className="icon icon-share" />
                    </div>
                    <div>
                        <h2>Share Space</h2>
                        <p>Invite a Telegram member by username</p>
                    </div>
                </div>

                <div className="modal-body custom-scroll">
                    {!verifiedUser ? (
                        <div className="drive-share-field">
                            <label className="drive-field-label">Telegram Username</label>
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
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleVerifyUser();
                                    }}
                                />
                            </div>
                            {error && <div className="share-error">{error}</div>}

                            {inviteLink && (
                                <div className="drive-copy-link-section">
                                    <div className="copy-link-divider">
                                        <span>or</span>
                                    </div>
                                    <label className="drive-field-label">Copy Invite Link</label>
                                    <div className="input-row copy-row">
                                        <input
                                            className="share-input-inline link-input"
                                            value={inviteLink}
                                            readOnly
                                        />
                                        <button
                                            className={`copy-btn ${copied ? 'copied' : ''}`}
                                            onClick={handleCopyLink}
                                            title="Copy connect link"
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
                                    <img src={currentAvatarBlobUrl} alt="Avatar" draggable={false} />
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
                                title="Change username"
                            >
                                <i className="icon icon-close" />
                            </button>
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    <div className="footer-right">
                        <button className="modal-btn cancel" onClick={onClose}>Cancel</button>
                        {!verifiedUser ? (
                            <button
                                className={`modal-btn primary ${isLoading ? 'loading' : ''}`}
                                onClick={handleVerifyUser}
                                disabled={isLoading || !username.trim()}
                            >
                                {isLoading ? 'Verifying...' : 'Verify User'}
                            </button>
                        ) : (
                            <button
                                className="modal-btn share-action"
                                onClick={handleShareSpace}
                            >
                                Share Space
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default memo(withGlobal<OwnProps>(
    (global): StateProps => ({})
)(DriveShareSpaceModal));
