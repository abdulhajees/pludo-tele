import type { FC } from '../../../lib/teact/teact';
import { memo, useEffect, useState } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';
import { ChatCreationProgress } from '../../../types';
import { selectTabState } from '../../../global/selectors';
import { buildDriveFolderTitle, buildDriveSpaceAbout } from '../../../util/drive';

import useLang from '../../../hooks/useLang';

import './DriveCreateSpaceModal.scss';

type OwnProps = {
    isOpen: boolean;
    onClose: () => void;
};

type StateProps = {
    creationProgress?: ChatCreationProgress;
};

const DriveCreateSpaceModal: FC<OwnProps & StateProps> = ({ isOpen, onClose, creationProgress }) => {
    const lang = useLang();

    const [spaceName, setSpaceName] = useState('');
    const [error, setError] = useState('');

    const isLoading = creationProgress === ChatCreationProgress.InProgress;
    const isComplete = creationProgress === ChatCreationProgress.Complete;

    useEffect(() => {
        if (!isComplete || !isOpen) return;
        setSpaceName('');
        setError('');
        getActions().syncDriveChatFolders();
        onClose();
    }, [isComplete, isOpen, onClose]);

    if (!isOpen) return undefined;

    const handleCreate = () => {
        const name = spaceName.trim();
        if (!name) {
            setError(lang('DriveCreateErrorNameEmpty'));
            return;
        }
        setError('');
        getActions().createChannel({
            title: buildDriveFolderTitle(name),
            about: buildDriveSpaceAbout(),
            memberIds: [],
            isChannel: true,
        });
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleCreate();
        if (e.key === 'Escape') onClose();
    };

    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) onClose();
    };

    return (
        <div className="DriveCreateSpaceModal-overlay" onClick={handleOverlayClick}>
            <div className="DriveCreateSpaceModal">
                <div className="modal-header">
                    <div className="modal-icon">
                        <i className="icon icon-folder" />
                    </div>
                    <div>
                        <h2>{lang('DriveCreateTitle')}</h2>
                        <p>{lang('DriveCreateSubtitle')}</p>
                    </div>
                </div>

                <div className="modal-body">
                    <label className="input-label">{lang('DriveCreateSpaceName')}</label>
                    <div className="input-row">
                        <span className="input-prefix">pludo-drive_</span>
                        <input
                            className={`space-name-input ${error ? 'has-error' : ''}`}
                            placeholder={lang('DriveCreatePlaceholder')}
                            value={spaceName}
                            onChange={(e) => {
                                setSpaceName(e.target.value);
                                setError('');
                            }}
                            onKeyDown={handleKeyDown}
                            autoFocus
                        />
                    </div>
                    {error && <span className="input-error">{error}</span>}
                </div>

                <div className="modal-footer">
                    <button className="modal-btn cancel" onClick={onClose}>{lang('Cancel')}</button>
                    <button
                        className={`modal-btn create ${isLoading ? 'loading' : ''}`}
                        onClick={handleCreate}
                        disabled={isLoading}
                    >
                        {isLoading ? lang('DriveCreateLoading') : lang('DriveCreateAction')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default memo(withGlobal<OwnProps>(
    (global): StateProps => {
        const { progress: creationProgress } = selectTabState(global).chatCreation || {};
        return { creationProgress };
    }
)(DriveCreateSpaceModal));
