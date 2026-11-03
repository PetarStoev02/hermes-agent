import type { ComponentProps } from 'react'

import { GroupRow } from './bot-row'
import type { $groupChats, $groupClarify, $groupNeedsYou } from './group-chat'
import { groupHasPendingClarify } from './group-turns'
import type { useBots } from './i18n'
import type { RosterGroupRow } from './roster-pane-derivation'

interface RosterGroupRowViewProps extends Omit<ComponentProps<typeof GroupRow>, 'needsYou'> {
  b: ReturnType<typeof useBots>
  groupClarify: ReturnType<typeof $groupClarify.get>
  groupNeedsYou: ReturnType<typeof $groupNeedsYou.get>
  groupRooms: ReturnType<typeof $groupChats.get>
  sortedGroupRows: RosterGroupRow[]
}

/** Folder peer row for a group chat — same chrome as a bot row (no reorder
 *  chevrons). Pin / Move to… stay on the context menu. */
export function RosterGroupRowView({
  groupClarify,
  groupNeedsYou,
  groupRooms: _groupRooms,
  sortedGroupRows: _sortedGroupRows,
  b: _b,
  ...rowProps
}: RosterGroupRowViewProps) {
  return (
    <GroupRow
      {...rowProps}
      needsYou={Boolean(groupNeedsYou[rowProps.group]) || groupHasPendingClarify(groupClarify, rowProps.group)}
    />
  )
}
