# Drive Audit Pending List

This document lists UI, UX, logic, and completeness gaps found during the Drive audit.

## P0 — Must fix before SaaS-style release

1. **Cross-space actions break in global sections (`sharing`, `recent`, `notifications`)**
   - **Issue**: `DriveView` passes `chatId || ''` to `AssetTable` / `DriveFilePreview`, but files in aggregated views come from many chats. Actions (preview, rename, delete, share) use wrong chat context.
   - **Impact**: Wrong file operations, failed preview/download/share, potential destructive action on wrong thread context.
   - **Where**: `src/components/middle/drive/DriveView.tsx`, `src/components/middle/drive/AssetTable.tsx`, `src/components/middle/drive/DriveFilePreview.tsx`, `src/components/middle/drive/DriveShareFileModal.tsx`.
   - **Fix direction**: Carry `sourceChatId` per row/file and route all actions by file-level chat/thread context.

2. **Message ID collisions in aggregated file map**
   - **Issue**: Aggregation uses `Object.assign(messagesById, folderMessages)` keyed only by numeric message id.
   - **Impact**: Files from different spaces can overwrite each other; missing rows or incorrect row actions.
   - **Where**: `src/components/middle/drive/DriveView.tsx`.
   - **Fix direction**: Avoid flattening into a single id map; aggregate as array with `(chatId, messageId)` identity.

3. **Asset row key collision across chats**
   - **Issue**: `key={file.id}` in global sections.
   - **Impact**: React reconciliation bugs, wrong row state/menu/selection.
   - **Where**: `src/components/middle/drive/AssetTable.tsx`.
   - **Fix direction**: Use composite key `chatId_messageId`.

4. **Permission model is client-side cache, not authoritative**
   - **Issue**: `DrivePermissions` stores `isAdmin` in IDB and UI trusts it for critical controls.
   - **Impact**: Stale/incorrect permissions and potentially misleading destructive controls.
   - **Where**: `src/components/left/main/DrivePermissions.ts`, usages in sidebar/view.
   - **Fix direction**: Treat cache as hint only; derive effective permissions from fresh chat state/full info and gracefully downgrade UI when unknown.

5. **Section type inconsistency and naming drift (`my_files` vs `my-files`)**
   - **Issue**: Mixed section enums, conversion logic spread across components; `DriveView` prop type still contains `deleted` while runtime uses `recent`/`notifications`.
   - **Impact**: High chance of regressions and silent routing bugs.
   - **Where**: `src/components/middle/drive/DriveView.tsx`, `src/components/left/main/DriveSidebar.tsx`, `src/global/types/tabState.ts`, `src/global/actions/ui/chats.ts`.
   - **Fix direction**: Centralize one canonical union and one mapper.

6. **Hardcoded invite URL parsing is brittle and environment-coupled**
   - **Issue**: Notifications detect invites only with hardcoded `pludo.systems/drive/` regex in message text.
   - **Impact**: Broken in staging/custom domains, false negatives/positives.
   - **Where**: `src/components/middle/drive/DriveNotifications.tsx`.
   - **Fix direction**: Parse structured invite metadata or centralize domain config.

7. **Hardcoded user-facing strings remain in Drive UI**
   - **Issue**: Several strings bypass `lang()` (`Me`, `Unknown`, `User`, `item/items`, `'Photo'/'Video'` fallbacks, loading ellipsis patterns).
   - **Impact**: Incomplete localization and inconsistent international UX.
   - **Where**: `src/components/middle/drive/AssetTable.tsx` and related rows.
   - **Fix direction**: Replace with localization keys everywhere.

## P1 — Important UX/logic improvements

8. **No user feedback when header share link copy succeeds/fails**
   - **Issue**: `DriveHeader` share action copies silently.
   - **Impact**: Poor UX; users can’t trust action completion.
   - **Where**: `src/components/middle/drive/DriveView.tsx`.

9. **Rename action clears chat description unintentionally**
   - **Issue**: Renaming folder sends `about: ''`.
   - **Impact**: Data loss for space description/about.
   - **Where**: `src/components/left/main/DriveSidebar.tsx`.

10. **Share-file flow tightly depends on sender username**
    - **Issue**: If current user has no username, sharing is blocked.
    - **Impact**: Feature unavailable for valid accounts.
    - **Where**: `src/components/middle/drive/DriveShareFileModal.tsx`.

11. **Share-file flow assumes verified target is always user**
    - **Issue**: Type allows `ApiChat | ApiUser`, but logic casts to `ApiUser` and reads user fields.
    - **Impact**: Runtime edge-case failures.
    - **Where**: `src/components/middle/drive/DriveShareFileModal.tsx`.

12. **Notifications timestamp formatting not localized consistently**
    - **Issue**: Uses `new Date(...).toLocaleString()` directly.
    - **Impact**: Inconsistent formatting vs app standard.
    - **Where**: `src/components/middle/drive/DriveNotifications.tsx`.

13. **Invite/open actions in notifications are one-way and not integrated with app actions**
    - **Issue**: Opens raw links in browser only.
    - **Impact**: Fragmented flow, reduced conversion/completion.
    - **Where**: `src/components/middle/drive/DriveNotifications.tsx`.

14. **Potential over-fetch/perf pressure in DriveView preload**
    - **Issue**: On aggregate views, loads viewport messages for every drive folder.
    - **Impact**: Startup lag, unnecessary traffic for users with many spaces.
    - **Where**: `src/components/middle/drive/DriveView.tsx`.

15. **No pagination/virtualization for large file tables**
    - **Issue**: Full render of all file rows.
    - **Impact**: Performance degradation at scale.
    - **Where**: `src/components/middle/drive/AssetTable.tsx`, `DriveView.tsx`.

16. **No optimistic or explicit error feedback for destructive/member admin actions**
    - **Issue**: Manage Access uses direct API actions with limited inline failure states.
    - **Impact**: User confusion on partial failures.
    - **Where**: `src/components/left/main/DriveManageAccessModal.tsx`.

17. **Window-native confirms for critical actions**
    - **Issue**: `window.confirm` is used in some flows instead of product-styled confirmation.
    - **Impact**: Inconsistent UX and limited localization/branding control.
    - **Where**: `DriveManageAccessModal.tsx`, `DriveProfileModal.tsx`.

18. **Channel naming leaks usernames in share channels**
    - **Issue**: Share-channel title encodes two usernames.
    - **Impact**: Metadata privacy concern and collision risk.
    - **Where**: `src/components/middle/drive/DriveShareFileModal.tsx`.

## P2 — Completeness/polish gaps

19. **`QuickAccess` component is implemented but not wired**
    - **Issue**: Dead feature surface.
    - **Impact**: Incomplete UX and maintenance overhead.
    - **Where**: `src/components/middle/drive/QuickAccess.tsx`.

20. **Accessibility: action menus and controls need stronger keyboard/ARIA support**
    - **Issue**: Context menus and icon-only buttons rely mostly on title/tooltips.
    - **Impact**: Reduced keyboard/screen-reader usability.
    - **Where**: `DriveSidebar.tsx`, `AssetTable.tsx`, modals.

21. **Hardcoded inline color tokens in file icons**
    - **Issue**: Multiple inline hex colors for file types.
    - **Impact**: Theme inconsistency and weaker design-system compliance.
    - **Where**: `AssetTable.tsx`, `DriveFilePreview.tsx`.

22. **Filter taxonomy mismatch across components**
    - **Issue**: Filter categories are basic and inconsistent with quick stats taxonomy.
    - **Impact**: Discoverability friction for business file types.
    - **Where**: `DriveView.tsx`, `QuickAccess.tsx`.

23. **Notifications signal has no read/unread state**
    - **Issue**: No persistence of handled notifications.
    - **Impact**: Repetitive noise; poor “inbox” behavior.
    - **Where**: `DriveNotifications.tsx` (and corresponding state layer needed).

24. **No dedup/safety guard for repeated share-file forwards**
    - **Issue**: Repeat shares can create duplicate entries without warning.
    - **Impact**: Clutter and confusion in shared channels.
    - **Where**: `DriveShareFileModal.tsx`.

25. **Mobile behavior/compact layout validation is incomplete**
    - **Issue**: Desktop-focused interaction patterns (sidebar collapse, table density, preview pane).
    - **Impact**: Potential breakage/usability issues on smaller viewports.
    - **Where**: Drive view/layout SCSS + related components.

## Suggested implementation order

1. Fix P0 items 1–5 first (data correctness + action routing + canonical section model).
2. Then P0 items 6–7 (invite parsing + localization debt).
3. Implement P1 UX reliability and feedback improvements.
4. Finish P2 completeness and polish pass.

## Notes

- This audit intentionally excludes backend/database architecture changes.
- Existing repo-wide stylelint debt outside Drive scope was not treated as Drive blockers unless directly impacting this flow.
