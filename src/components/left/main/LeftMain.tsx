import type { FC } from '../../../lib/teact/teact';
import { memo, useState } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';
import { selectCurrentChat } from '../../../global/selectors';

import type { FolderEditDispatch } from '../../../hooks/reducers/useFoldersReducer';
import { LeftColumnContent } from '../../../types';

import DriveSidebar from './DriveSidebar';

import './LeftMain.scss';

type Section = 'my-files' | 'sharing' | 'recent' | 'notifications';

type OwnProps = {
  content: LeftColumnContent;
  searchQuery?: string;
  searchDate?: number;
  contactsFilter: string;
  shouldSkipTransition?: boolean;
  foldersDispatch: FolderEditDispatch;
  isAppUpdateAvailable?: boolean;
  isForumPanelOpen?: boolean;
  isClosingSearch?: boolean;
  onSearchQuery: (query: string) => void;
  onTopicSearch: NoneToVoidFunction;
  isAccountFrozen?: boolean;
  onReset: () => void;
  isFoldersSidebarShown?: boolean;
};

type StateProps = {
  currentUserId?: string;
  activeChatId?: string;
};

const LeftMain: FC<OwnProps & StateProps> = ({ currentUserId, activeChatId }) => {
  const { openChat } = getActions();
  const [activeSection, setActiveSection] = useState<Section>('my-files');

  return (
    <DriveSidebar
      onSelectFolder={(chatId) => {
        openChat({ id: chatId, shouldReplaceHistory: true });
      }}
      onSectionChange={setActiveSection}
      activeSection={activeSection}
    />
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const currentChat = selectCurrentChat(global);
    return {
      currentUserId: global.currentUserId,
      activeChatId: currentChat?.id,
    };
  }
)(LeftMain));
