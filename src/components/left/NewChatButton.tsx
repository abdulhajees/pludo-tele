import type { FC } from '../../lib/teact/teact';
import {
  useCallback, useEffect, useMemo, useState,
} from '../../lib/teact/teact';
import { getActions } from '../../global';

import buildClassName from '../../util/buildClassName';
import { buildDriveFolderTitle, buildDriveSpaceAbout } from '../../util/drive';

import useOldLang from '../../hooks/useOldLang';

import Icon from '../common/icons/Icon';
import Button from '../ui/Button';
import Menu from '../ui/Menu';
import MenuItem from '../ui/MenuItem';

import './NewChatButton.scss';

type OwnProps = {
  isShown: boolean;
  isAccountFrozen?: boolean;
};

const NewChatButton: FC<OwnProps> = ({
  isShown,
  isAccountFrozen,
}) => {
  const { openFrozenAccountModal, createChannel, syncDriveChatFolders } = getActions();

  const lang = useOldLang();

  const fabClassName = buildClassName(
    'NewChatButton',
    isShown && 'revealed',
  );

  const handleCreateFolder = useCallback(() => {
    if (isAccountFrozen) {
      openFrozenAccountModal();
      return;
    }
    const folderName = window.prompt(lang('EnterFolderName') || 'Enter a name for the new folder:');
    if (folderName && folderName.trim().length > 0) {
      createChannel({
        title: buildDriveFolderTitle(folderName.trim()),
        about: buildDriveSpaceAbout(),
        memberIds: [],
        isChannel: true,
      });
      syncDriveChatFolders();
      setTimeout(() => {
        syncDriveChatFolders();
      }, 1500);
    }
  }, [isAccountFrozen, openFrozenAccountModal, createChannel, syncDriveChatFolders, lang]);

  return (
    <div className={fabClassName} dir={lang.isRtl ? 'rtl' : undefined}>
      <Button
        round
        color="primary"
        onClick={handleCreateFolder}
        ariaLabel={lang('NewFolder') || 'New Folder'}
        tabIndex={-1}
      >
        <Icon name="channel" />
      </Button>
    </div>
  );
};

export default NewChatButton;
