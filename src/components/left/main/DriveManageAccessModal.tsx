import type { FC } from '../../../lib/teact/teact';
import { memo, useEffect } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';
import type { ApiUser, ApiChat, ApiChatMember } from '../../../api/types';
import { selectChatFullInfo, selectUser } from '../../../global/selectors';
import { getChatAvatarHash } from '../../../global/helpers';
import useMedia from '../../../hooks/useMedia';
import { ApiMediaFormat } from '../../../api/types';

import useLang from '../../../hooks/useLang';

import './DriveManageAccessModal.scss';

type OwnProps = {
    isOpen: boolean;
    chatId: string;
    onClose: () => void;
};

type StateProps = {
    members?: ApiChatMember[];
    adminMembersById?: Record<string, ApiChatMember>;
    usersById: Record<string, ApiUser | undefined>;
    currentUserId?: string;
};

const DriveManageAccessModal: FC<OwnProps & StateProps> = ({
    isOpen,
    chatId,
    onClose,
    members,
    adminMembersById,
    usersById,
    currentUserId
}) => {
    const lang = useLang();

    useEffect(() => {
        if (isOpen && !members) {
            getActions().loadFullChat({ chatId });
        }
    }, [isOpen, chatId, members]);

    if (!isOpen) return undefined;

    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) onClose();
    };

    const handleRemoveMember = (userId: string) => {
        if (window.confirm(lang('DriveManageRemoveConfirm'))) {
            getActions().deleteChatMember({ chatId, userId });
        }
    };

    const handleToggleManager = (member: ApiChatMember, isManager: boolean) => {
        if (isManager) {
            // Revoke admin rights
            getActions().updateChatAdmin({
                chatId,
                userId: member.userId,
                adminRights: {}
            });
        } else {
            // Grant admin rights
            getActions().updateChatAdmin({
                chatId,
                userId: member.userId,
                adminRights: {
                    changeInfo: true,
                    postMessages: true,
                    editMessages: true,
                    deleteMessages: true,
                    banUsers: true,
                    inviteUsers: true,
                    pinMessages: true,
                    manageCall: true,
                    manageTopics: true,
                    postStories: true,
                    editStories: true,
                    deleteStories: true,
                    manageDirectMessages: true
                }
            });
        }
    };

    return (
        <div className="DriveManageAccessModal-overlay" onClick={handleOverlayClick}>
            <div className="DriveManageAccessModal">
                <div className="modal-header">
                    <div className="modal-icon">
                        <i className="icon icon-permissions" />
                    </div>
                    <div>
                        <h2>{lang('DriveManageTitle')}</h2>
                        <p>{lang('DriveManageSubtitle')}</p>
                    </div>
                </div>

                <div className="modal-body custom-scroll">
                    {!members ? (
                        <div className="manage-loading">{lang('Loading')}...</div>
                    ) : members.length === 0 ? (
                        <div className="manage-empty">{lang('NoMembersFound')}</div>
                    ) : (
                        <div className="members-list">
                            {members.map((member) => {
                                const user = usersById[member.userId];
                                if (!user) return null;

                                const isCurrentUser = member.userId === currentUserId;
                                const isOwner = member.isOwner;
                                const isManager = member.isAdmin || (adminMembersById && adminMembersById[member.userId]) || isOwner;

                                return (
                                    <MemberRow
                                        key={member.userId}
                                        user={user}
                                        isOwner={!!isOwner}
                                        isManager={!!isManager}
                                        isCurrentUser={isCurrentUser}
                                        onRemove={() => handleRemoveMember(member.userId)}
                                        onToggleManager={() => handleToggleManager(member, !!isManager)}
                                    />
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    <button className="modal-btn primary" onClick={onClose}>{lang('Done')}</button>
                </div>
            </div>
        </div>
    );
};

const MemberRow: FC<{
    user: ApiUser;
    isOwner: boolean;
    isManager: boolean;
    isCurrentUser: boolean;
    onRemove: () => void;
    onToggleManager: () => void;
}> = ({ user, isOwner, isManager, isCurrentUser, onRemove, onToggleManager }) => {
    const lang = useLang();

    const avatarHash = getChatAvatarHash(user);
    const avatarBlobUrl = useMedia(avatarHash, false, ApiMediaFormat.BlobUrl);

    const initials = `${user.firstName?.charAt(0) || ''}${user.lastName?.charAt(0) || ''}`.toUpperCase() || 'U';
    const displayName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || lang('HiddenName');

    return (
        <div className="member-row">
            <div className="member-avatar">
                {avatarBlobUrl ? (
                    <img src={avatarBlobUrl} alt="" draggable={false} />
                ) : (
                    <span className="initials">{initials}</span>
                )}
            </div>
            <div className="member-info">
                <h4>{displayName} {isCurrentUser && <span className="you-badge">{lang('ThisIsYou')}</span>}</h4>
                <p>@{user.usernames?.[0]?.username || user.phoneNumber || lang('HiddenName')}</p>
            </div>

            <div className="member-actions">
                <span className={`role-badge ${isOwner ? 'owner' : isManager ? 'manager' : 'member'}`}>
                    {isOwner ? lang('DriveManageRoleOwner') : isManager ? lang('DriveManageRoleManager') : lang('DriveManageRoleMember')}
                </span>

                {!isOwner && !isCurrentUser && (
                    <div className="action-buttons">
                        <button
                            className="action-btn toggle-role"
                            onClick={onToggleManager}
                            title={isManager ? lang('DriveManageDemote') : lang('DriveManagePromote')}
                        >
                            {isManager ? <i className="icon icon-arrow-down" /> : <i className="icon icon-arrow-up" />}
                        </button>
                        <button
                            className="action-btn remove"
                            onClick={onRemove}
                            title={lang('DriveManageRemove')}
                        >
                            <i className="icon icon-delete" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default memo(withGlobal<OwnProps>(
    (global, { chatId }): StateProps => {
        const fullInfo = selectChatFullInfo(global, chatId);
        const { byId: usersById } = global.users;

        return {
            members: fullInfo?.members,
            adminMembersById: fullInfo?.adminMembersById,
            usersById,
            currentUserId: global.currentUserId
        };
    }
)(DriveManageAccessModal));
