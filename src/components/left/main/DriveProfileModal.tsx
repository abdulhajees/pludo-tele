import type { FC } from '../../../lib/teact/teact';
import { memo, useState, useEffect } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';
import { selectUser, selectTabState } from '../../../global/selectors';
import type { ApiUser } from '../../../api/types';
import { ApiMediaFormat } from '../../../api/types';
import { ProfileEditProgress } from '../../../types';
import { getChatAvatarHash } from '../../../global/helpers';
import useMedia from '../../../hooks/useMedia';

import useLang from '../../../hooks/useLang';

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
    const lang = useLang();

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
        if (window.confirm(lang('DriveProfileLogoutConfirm'))) {
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
                            title={lang('ChangeYourProfilePicture')}
                            disabled={isLoading}
                        />
                    </div>
                    <div className="modal-header-text">
                        <h2>{lang('DriveProfileTitle')}</h2>
                        <p>{lang('DriveProfileSubtitle')}</p>
                    </div>
                </div>

                <div className="modal-body custom-scroll">
                    <div className="drive-profile-field">
                        <label className="drive-field-label">{lang('LoginRegisterFirstNamePlaceholder')}</label>
                        <input
                            className="profile-input"
                            placeholder={lang('DriveProfileRequired')}
                            value={firstName}
                            onChange={(e) => { setFirstName(e.target.value); setIsTouched(true); }}
                        />
                    </div>

                    <div className="drive-profile-field">
                        <label className="drive-field-label">{lang('DriveProfileLastNameOptional')}</label>
                        <input
                            className="profile-input"
                            placeholder={lang('DriveProfileOptional')}
                            value={lastName}
                            onChange={(e) => { setLastName(e.target.value); setIsTouched(true); }}
                        />
                    </div>

                    <div className="drive-profile-field">
                        <label className="drive-field-label">{lang('Username')}</label>
                        <div className="input-row">
                            <span className="input-prefix">@</span>
                            <input
                                className="profile-input-inline"
                                placeholder={lang('Username')}
                                value={username}
                                onChange={(e) => { setUsername(e.target.value); setIsTouched(true); }}
                            />
                        </div>
                    </div>
                </div>

                <div className="modal-footer">
                    <button className="modal-btn danger" onClick={handleLogout}>{lang('DriveProfileLogout')}</button>
                    <div className="footer-right">
                        <button className="modal-btn cancel" onClick={onClose}>{lang('Cancel')}</button>
                        <button
                            className={`modal-btn primary ${isLoading ? 'loading' : ''}`}
                            onClick={handleSave}
                            disabled={isLoading || !firstName.trim()}
                        >
                            {isLoading ? lang('DriveProfileSaving') : lang('DriveProfileSave')}
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
