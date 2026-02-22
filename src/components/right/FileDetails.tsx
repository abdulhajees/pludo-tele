import type { FC } from '@teact';
import { memo } from '@teact';
import { getActions, withGlobal } from '../../global';
import type { ApiMessage } from '../../api/types';
import { selectChatMessage, selectUser } from '../../global/selectors';
import useOldLang from '../../hooks/useOldLang';
import { formatMediaDateTime } from '../../util/dates/dateFormat';
import renderText from '../common/helpers/renderText';
import { getMessageContent } from '../../global/helpers';
import { getDocumentExtension } from '../common/helpers/documentInfo';
import Button from '../ui/Button';

import './FileDetails.scss';

type OwnProps = {
    chatId: string;
    messageId: number;
    onClose: () => void;
};

type StateProps = {
    message?: ApiMessage;
    senderName?: string;
};

const FileDetails: FC<OwnProps & StateProps> = ({ message, senderName, onClose }) => {
    const oldLang = useOldLang();
    const { downloadMedia, closeMediaViewer } = getActions();

    if (!message) {
        return (
            <div className="FileDetails">
                <div className="FileDetails-header">
                    <Button round color="translucent" size="smaller" onClick={onClose} ariaLabel="Close">
                        <i className="icon icon-close" />
                    </Button>
                    <h3>File Details</h3>
                </div>
                <div className="FileDetails-body">Loading...</div>
            </div>
        );
    }

    const { document, photo, video } = getMessageContent(message);
    const media = document || photo || video;

    const customFileName = message.content.text?.text?.trim();
    const rawFileName = document?.fileName || 'file';
    const fileName = customFileName || rawFileName;
    const extension = document ? getDocumentExtension(document) : '';
    const size = document?.size || (video && 'size' in video ? video.size : 0);

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        else return (bytes / 1048576).toFixed(1) + ' MB';
    };

    const handleDownload = () => {
        if (media) {
            downloadMedia({ media, originMessage: message });
        }
    };

    return (
        <div className="FileDetails">
            <div className="FileDetails-header">
                <Button round color="translucent" size="smaller" onClick={onClose} ariaLabel="Close">
                    <i className="icon icon-close" />
                </Button>
                <h3>{customFileName ? 'File Details' : 'Details'}</h3>
            </div>
            <div className="FileDetails-body custom-scroll">
                <div className="FileDetails-icon">
                    <i className="icon icon-document" />
                </div>
                <h2 className="FileDetails-title">{renderText(fileName)}</h2>
                <div className="FileDetails-info">
                    <div className="info-item">
                        <span className="info-label">Type</span>
                        <span className="info-value">{extension ? extension.toUpperCase() : 'Unknown'}</span>
                    </div>
                    <div className="info-item">
                        <span className="info-label">Size</span>
                        <span className="info-value">{formatSize(size)}</span>
                    </div>
                    <div className="info-item">
                        <span className="info-label">Modified</span>
                        <span className="info-value">{formatMediaDateTime(oldLang, message.date * 1000)}</span>
                    </div>
                    {senderName && (
                        <div className="info-item">
                            <span className="info-label">Uploaded By</span>
                            <span className="info-value">{renderText(senderName)}</span>
                        </div>
                    )}
                </div>
                <div className="FileDetails-actions">
                    <Button onClick={handleDownload} fluid>Download File</Button>
                </div>
            </div>
        </div>
    );
};

export default memo(withGlobal<OwnProps>(
    (global, { chatId, messageId }): StateProps => {
        const message = selectChatMessage(global, chatId, messageId);
        let senderName;
        if (message?.senderId) {
            const sender = selectUser(global, message.senderId);
            senderName = sender ? `${sender.firstName || ''} ${sender.lastName || ''}`.trim() : undefined;
        }
        return {
            message,
            senderName,
        };
    }
)(FileDetails));
