import type { FC } from '@teact';
import { memo, useMemo } from '@teact';
import type { ApiMessage } from '../../../api/types';
import { getMessageContent } from '../../../global/helpers';
import { getDocumentExtension } from '../../common/helpers/documentInfo';
import useLang from '../../../hooks/useLang';

import './QuickAccess.scss';

type OwnProps = {
    files: ApiMessage[];
};

const QuickAccess: FC<OwnProps> = ({ files }) => {
    const lang = useLang();

    const stats = useMemo(() => {
        let docs = { count: 0, size: 0 };
        let presentations = { count: 0, size: 0 };
        let pdfs = { count: 0, size: 0 };
        let images = { count: 0, size: 0 };

        files.forEach(file => {
            const { document, photo } = getMessageContent(file);
            const ext = document ? getDocumentExtension(document)?.toLowerCase() : '';
            const size = document?.size || 0;

            if (photo || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) {
                images.count++;
                images.size += size;
            } else if (['pdf'].includes(ext || '')) {
                pdfs.count++;
                pdfs.size += size;
            } else if (['ppt', 'pptx', 'key'].includes(ext || '')) {
                presentations.count++;
                presentations.size += size;
            } else {
                docs.count++;
                docs.size += size;
            }
        });

        return { docs, presentations, pdfs, images };
    }, [files]);

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
        return (bytes / 1073741824).toFixed(1) + ' GB';
    };

    return (
        <div className="QuickAccess">
            <h2 className="section-title">{lang('DriveQuickAccessTitle')}</h2>
            <div className="QuickAccess-cards">
                <div className="card documents-card">
                    <div className="card-icon documents-icon">
                        <i className="icon icon-document" />
                    </div>
                    <div className="card-info">
                        <span className="card-title">{lang('DriveFilterDocuments')}</span>
                        <span className="card-meta">{stats.docs.count} · {formatSize(stats.docs.size)}</span>
                    </div>
                </div>

                <div className="card presentations-card">
                    <div className="card-icon presentations-icon">
                        <i className="icon icon-document" />
                    </div>
                    <div className="card-info">
                        <span className="card-title">{lang('DriveQuickAccessPresentations')}</span>
                        <span className="card-meta">{stats.presentations.count} · {formatSize(stats.presentations.size)}</span>
                    </div>
                </div>

                <div className="card pdfs-card">
                    <div className="card-icon pdfs-icon">
                        <i className="icon icon-document" />
                    </div>
                    <div className="card-info">
                        <span className="card-title">{lang('DriveFilterPdfs')}</span>
                        <span className="card-meta">{stats.pdfs.count} · {formatSize(stats.pdfs.size)}</span>
                    </div>
                </div>

                <div className="card images-card">
                    <div className="card-icon images-icon">
                        <i className="icon icon-photo" />
                    </div>
                    <div className="card-info">
                        <span className="card-title">{lang('DriveFilterImages')}</span>
                        <span className="card-meta">{stats.images.count} · {formatSize(stats.images.size)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default memo(QuickAccess);
