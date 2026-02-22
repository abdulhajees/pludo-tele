import type { FC } from '@teact';
import { memo } from '@teact';

import './DriveHeader.scss';

type OwnProps = {
    chatId: string;
    threadId?: number | string;
    onUploadClick?: () => void;
    onShareClick?: () => void;
    onSidebarToggle?: () => void;
    isSidebarCollapsed?: boolean;
    searchQuery: string;
    onSearchQueryChange: (query: string) => void;
};

const DriveHeader: FC<OwnProps> = ({
    chatId,
    threadId,
    onUploadClick,
    onShareClick,
    onSidebarToggle,
    isSidebarCollapsed,
    searchQuery,
    onSearchQueryChange,
}) => {
    return (
        <div className="DriveHeader">
            <div className="DriveHeader-left">
                <button
                    className="sidebar-toggle-btn"
                    onClick={onSidebarToggle}
                    title={isSidebarCollapsed ? 'Show Sidebar' : 'Hide Sidebar'}
                >
                    <i className={`icon icon-${isSidebarCollapsed ? 'menu' : 'close'}`} />
                </button>
                <div className="DriveHeader-logo">
                    <i className="icon icon-channel" />
                    <span className="logo-text">Pludo Drive</span>
                </div>
            </div>
            <div className="DriveHeader-search">
                <div className="search-input-wrapper">
                    <i className="icon icon-search" />
                    <input
                        type="text"
                        placeholder="Search Files or Assets"
                        className="search-input"
                        value={searchQuery}
                        onChange={(e) => onSearchQueryChange(e.target.value)}
                    />
                </div>
            </div>
            <div className="DriveHeader-actions">
                <button className="btn btn-secondary share-btn" onClick={onShareClick}>
                    <i className="icon icon-user-plus" />
                    <span>Share</span>
                </button>
                {onUploadClick && (
                    <button className="btn btn-primary new-folder-btn" onClick={onUploadClick}>
                        <i className="icon icon-add" />
                        <span>New Upload</span>
                    </button>
                )}
            </div>
        </div>
    );
};

export default memo(DriveHeader);
