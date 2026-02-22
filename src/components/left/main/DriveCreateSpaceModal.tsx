import type { FC } from '../../../lib/teact/teact';
import { memo, useState } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';
import { ChatCreationProgress } from '../../../types';
import { selectTabState } from '../../../global/selectors';

import './DriveCreateSpaceModal.scss';

type OwnProps = {
    isOpen: boolean;
    onClose: () => void;
};

type StateProps = {
    creationProgress?: ChatCreationProgress;
};

const DriveCreateSpaceModal: FC<OwnProps & StateProps> = ({ isOpen, onClose, creationProgress }) => {
    const [spaceName, setSpaceName] = useState('');
    const [error, setError] = useState('');

    const isLoading = creationProgress === ChatCreationProgress.InProgress;
    const isComplete = creationProgress === ChatCreationProgress.Complete;

    if (isComplete && isOpen) {
        setSpaceName('');
        setError('');
        onClose();
    }

    if (!isOpen) return undefined;

    const handleCreate = () => {
        const name = spaceName.trim();
        if (!name) {
            setError('Space name cannot be empty');
            return;
        }
        setError('');
        getActions().createChannel({
            title: `pludo-drive_${name}`,
            about: '',
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
                        <h2>Create New Space</h2>
                        <p>A private space to store and organize your files</p>
                    </div>
                </div>

                <div className="modal-body">
                    <label className="input-label">Space name</label>
                    <div className="input-row">
                        <span className="input-prefix">pludo-drive_</span>
                        <input
                            className={`space-name-input ${error ? 'has-error' : ''}`}
                            placeholder="my-space"
                            value={spaceName}
                            onChange={(e) => {
                                setSpaceName(e.target.value.replace(/\s+/g, '-'));
                                setError('');
                            }}
                            onKeyDown={handleKeyDown}
                            autoFocus
                        />
                    </div>
                    {error && <span className="input-error">{error}</span>}
                </div>

                <div className="modal-footer">
                    <button className="modal-btn cancel" onClick={onClose}>Cancel</button>
                    <button
                        className={`modal-btn create ${isLoading ? 'loading' : ''}`}
                        onClick={handleCreate}
                        disabled={isLoading}
                    >
                        {isLoading ? 'Creating...' : 'Create Space'}
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
