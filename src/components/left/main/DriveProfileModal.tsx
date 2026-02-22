import type { FC } from '../../../lib/teact/teact';
import { memo, useState, useEffect } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';
import { selectUser, selectTabState } from '../../../global/selectors';
import type { ApiUser } from '../../../api/types';
import { ApiMediaFormat } from '../../../api/types';
import { ProfileEditProgress } from '../../../types';
import { getChatAvatarHash } from '../../../global/helpers';
import useMedia from '../../../hooks/useMedia';

import AvatarEditable from '../../ui/AvatarEditable';
import './DriveProfileModal.scss';

type OwnProps = {
    isOpen: boolean;
    onClose: () => void;
};

type StateProps = {
    currentUser?: ApiUser;
    progress?: ProfileEditProgress;
};

const DriveProfileModal: FC<OwnProps & StateProps> = ({ isOpen, onClose, currentUser, progress }) => {
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [username, setUsername] = useState('');
    const [isTouched, setIsTouched] = useState(false);
    const [photo, setPhoto] = useState<File | undefined>();

    const currentAvatarHash = currentUser ? getChatAvatarHash(currentUser) : undefined;
    const currentAvatarBlobUrl = useMedia(currentAvatarHash, false, ApiMediaFormat.BlobUrl);

    const isLoading = progress === ProfileEditProgress.InProgress;
    const isComplete = progress === ProfileEditProgress.Complete;

    useEffect(() => {
        if (currentUser && !isTouched) {
            setFirstName(currentUser.firstName || '');
            setLastName(currentUser.lastName || '');
            setUsername(currentUser.usernames?.[0]?.username || '');
        }
    }, [currentUser, isTouched]);

    useEffect(() => {
        if (isComplete && isOpen) {
            setIsTouched(false);
            setPhoto(undefined);
            onClose();
        }
    }, [isComplete, isOpen, onClose]);

    useEffect(() => {
        setPhoto(undefined);
    }, [currentAvatarBlobUrl]);

    if (!isOpen) return undefined;

    const handleSave = () => {
        if (!firstName.trim()) return;
        getActions().updateProfile({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            username: username.trim() || undefined,
            photo,
        });
    };

    const handleLogout = () => {
        if (window.confirm('Are you sure you want to log out?')) {
            getActions().signOut({ forceInitApi: true });
        }
    };

    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) onClose();
    };

    return (
        <div className="DriveProfileModal-overlay" onClick={handleOverlayClick}>
            <div className="DriveProfileModal">
                <div className="modal-header">
                    <div className="modal-icon-avatar">
                        <AvatarEditable
                            currentAvatarBlobUrl={currentAvatarBlobUrl}
                            onChange={(newPhoto) => { setPhoto(newPhoto); setIsTouched(true); }}
                            title="Edit Profile Photo"
                            disabled={isLoading}
                        />
                    </div>
                    <div className="modal-header-text">
                        <h2>Edit Profile</h2>
                        <p>Manage your account details and settings</p>
                    </div>
                </div>

                <div className="modal-body custom-scroll">
                    <div className="drive-profile-field">
                        <label className="drive-field-label">First Name</label>
                        <input
                            className="profile-input"
                            placeholder="Required"
                            value={firstName}
                            onChange={(e) => { setFirstName(e.target.value); setIsTouched(true); }}
                        />
                    </div>

                    <div className="drive-profile-field">
                        <label className="drive-field-label">Last Name (Optional)</label>
                        <input
                            className="profile-input"
                            placeholder="Optional"
                            value={lastName}
                            onChange={(e) => { setLastName(e.target.value); setIsTouched(true); }}
                        />
                    </div>

                    <div className="drive-profile-field">
                        <label className="drive-field-label">Username</label>
                        <div className="input-row">
                            <span className="input-prefix">@</span>
                            <input
                                className="profile-input-inline"
                                placeholder="username"
                                value={username}
                                onChange={(e) => { setUsername(e.target.value); setIsTouched(true); }}
                            />
                        </div>
                    </div>
                </div>

                <div className="modal-footer">
                    <button className="modal-btn danger" onClick={handleLogout}>Log Out</button>
                    <div className="footer-right">
                        <button className="modal-btn cancel" onClick={onClose}>Cancel</button>
                        <button
                            className={`modal-btn primary ${isLoading ? 'loading' : ''}`}
                            onClick={handleSave}
                            disabled={isLoading || !firstName.trim()}
                        >
                            {isLoading ? 'Saving...' : 'Save Profile'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default memo(withGlobal<OwnProps>(
    (global): StateProps => {
        const currentUser = global.currentUserId ? selectUser(global, global.currentUserId) : undefined;
        const { progress } = selectTabState(global).profileEdit || {};

        return {
            currentUser,
            progress,
        };
    }
)(DriveProfileModal));
