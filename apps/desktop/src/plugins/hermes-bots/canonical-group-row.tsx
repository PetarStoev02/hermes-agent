import {
  cn,
  ConfirmDialog,
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  RowButton
} from '@hermes/plugin-sdk'
import { useState } from 'react'

import { useCanonicalGroupLabels } from './canonical-group-labels'
import { GroupAvatarCluster } from './group-avatar-cluster'
import { useBots } from './i18n'
import type { GroupMember } from './types'

interface CanonicalGroupRowProps {
  members: GroupMember[]
  name: string
  /** Rejects with the gateway's refusal so the confirm stays open and shows it. */
  onDelete: () => Promise<void>
  onOpen: () => void
}

/** Grok-style gateway Group Chat row for surfaces that still mount
 *  `CanonicalGroupList` (tests). The Bots pane seats the same rooms into
 *  `$groupChats` and renders folder `GroupRow`s — cluster, preview, Move to…
 *  — so this row only needs open + delete (#143571). */
export function CanonicalGroupRow({ members, name, onDelete, onOpen }: CanonicalGroupRowProps) {
  const labels = useCanonicalGroupLabels()
  const { group } = useBots()
  const [confirming, setConfirming] = useState(false)
  const preview = group.memberCount(members.length)

  const row = (
    <RowButton
      aria-label={name}
      className={cn(
        'flex w-full min-w-0 max-w-full items-center gap-2.5 overflow-hidden rounded-md px-2 py-2 text-left transition-colors',
        'hover:bg-(--chrome-action-hover)'
      )}
      onClick={onOpen}
    >
      <div className="relative flex w-[34px] shrink-0 items-center justify-center">
        <GroupAvatarCluster members={members} size={32} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-medium">{name}</span>
        </div>
        <div className="min-w-0 truncate text-xs text-(--ui-text-tertiary)">{preview}</div>
      </div>
    </RowButton>
  )

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{row}</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onSelect={onOpen}>{labels.openGroup}</ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={() => setConfirming(true)} variant="destructive">
            {group.deleteAction}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      {confirming && (
        <ConfirmDialog
          busyLabel={labels.disbanding}
          confirmLabel={labels.disband}
          description={
            <span>
              {labels.disbandDescPrefix}
              <span className="font-medium text-foreground">{name}</span>
              {labels.disbandDescSuffix(members.length)}
            </span>
          }
          destructive
          doneLabel={labels.disbandDone}
          onClose={() => setConfirming(false)}
          onConfirm={onDelete}
          open
          title={labels.disbandTitle}
        />
      )}
    </>
  )
}
