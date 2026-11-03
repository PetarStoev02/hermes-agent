import { cn, Codicon, ConfirmDialog, RowButton } from '@hermes/plugin-sdk'
import { useState } from 'react'

import { CanonicalGroupRoster, type CanonicalMemberPhase } from './canonical-group-activity'
import { useCanonicalGroupLabels } from './canonical-group-labels'
import { groupMembersFromCanonicalRoom } from './canonical-group-mirror'
import type { CanonicalGroupBinding, CanonicalRoom } from './canonical-groups'
import { GroupAvatarCluster } from './group-avatar-cluster'
import { GroupDetailsPanel } from './group-details-panel'

interface CanonicalGroupHeaderProps {
  binding: CanonicalGroupBinding
  busy: boolean
  canStop: boolean
  onBack?: () => void
  onDisband: () => Promise<void>
  onRename: (name: string) => void
  onStop: () => void
  phases: Map<string, CanonicalMemberPhase>
  room?: CanonicalRoom
}

/** Same floating name island as BotNamePill. Stop / Rename / Disband live in
 *  the details panel (Details + Members), not in the chat chrome. */
export function CanonicalGroupHeader({
  binding,
  busy,
  canStop,
  onDisband,
  onRename,
  onStop,
  phases,
  room
}: CanonicalGroupHeaderProps) {
  const labels = useCanonicalGroupLabels()
  const [ending, setEnding] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)

  const members = room && binding?.connectionId
    ? groupMembersFromCanonicalRoom({ connectionId: binding.connectionId, profile: binding.profile }, room)
    : []

  const name = room?.name || labels.loadingGroup
  // Only paint the roster while someone is queued/working — idle it reads as a
  // second title under the island and makes the room look like a stuck 1:1.
  const showActivity = [...phases.values()].some(phase => phase === 'working' || phase === 'queued')

  return (
    <>
      <div
        className="pointer-events-none absolute inset-x-0 top-2 z-20 flex justify-center px-3"
        data-slot="group-name-pill"
      >
        <RowButton
          aria-expanded={detailsOpen}
          aria-label={name}
          className={cn(
            'pointer-events-auto flex max-w-[min(100%,18rem)] items-center gap-2 rounded-full border border-(--stroke-nous)',
            'bg-(--ui-widget-surface-background) px-2.5 py-1 shadow-nous',
            'text-[0.8125rem] font-medium text-(--ui-text-primary)',
            'transition-colors hover:bg-(--chrome-action-hover) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ui-accent)'
          )}
          disabled={!room}
          onClick={() => setDetailsOpen(open => !open)}
          title={name}
        >
          <GroupAvatarCluster members={members} size={22} />
          <span className="min-w-0 truncate">{name}</span>
          <Codicon className="shrink-0 text-[0.625rem] text-(--ui-text-quaternary)" name="chevron-right" />
        </RowButton>
      </div>
      <div className="flex justify-center px-3 pt-11">
        {showActivity ? (
          <CanonicalGroupRoster
            label={labels.members}
            labels={labels}
            members={room?.members}
            phases={phases}
          />
        ) : null}
      </div>
      {detailsOpen && room ? (
        <GroupDetailsPanel
          busy={busy}
          canStop={canStop}
          group={room.name}
          members={members}
          onClose={() => setDetailsOpen(false)}
          onDisband={() => {
            setDetailsOpen(false)
            setEnding(true)
          }}
          onRename={next => {
            onRename(next)
          }}
          onStop={() => {
            onStop()
            setDetailsOpen(false)
          }}
          tab="details"
        />
      ) : null}
      {ending && (
        <ConfirmDialog
          busyLabel={labels.disbanding}
          confirmLabel={labels.disband}
          description={
            <span>
              {labels.disbandDescPrefix}
              <span className="font-medium text-foreground">{room?.name}</span>
              {labels.disbandDescSuffix(room?.members?.length ?? 0)}
            </span>
          }
          destructive
          doneLabel={labels.disbandDone}
          onClose={() => setEnding(false)}
          onConfirm={onDisband}
          open
          title={labels.disbandTitle}
        />
      )}
    </>
  )
}
