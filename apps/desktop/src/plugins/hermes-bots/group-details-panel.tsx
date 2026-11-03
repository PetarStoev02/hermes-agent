/**
 * Right-side group details panel — same chrome as BotDetailsPanel (hero +
 * tabs). Details holds rename / stop / disband and a Members section so the
 * panel is never an empty name field; Members tab is the full list.
 */

import { Button, cn, Codicon, Input, useI18n, useValue } from '@hermes/plugin-sdk'
import { useState } from 'react'

import { avatarColor, botAppearance, BotFace } from './avatar'
import { isBackfilledFacePng } from './avatar-image'
import { $botMeta } from './data'
import { labeled } from './dialog-parts'
import { GroupAvatarCluster } from './group-avatar-cluster'
import { useBots } from './i18n'
import { displayName } from './labels'
import { botRosterMeta } from './routing'
import type { GroupMember } from './types'

export type GroupDetailsTab = 'details' | 'members'

interface GroupDetailsPanelProps {
  busy?: boolean
  canStop?: boolean
  group: string
  members: GroupMember[]
  onClose: () => void
  onDisband: () => void
  onManageMembers?: () => void
  onOpenSettings?: () => void
  onRename: (name: string) => void
  onStop?: () => void
  /** Optional room art for the hero. */
  image?: null | string
  tab?: GroupDetailsTab
}

function MemberRows({ members }: { members: GroupMember[] }) {
  const allMeta = useValue($botMeta)
  const b = useBots()

  if (members.length === 0) {
    return <p className="text-xs text-(--ui-text-tertiary)">{b.group.noMembers}</p>
  }

  return (
    <div className="grid gap-0.5" data-slot="group-details-members">
      {members.map(member => {
        const meta = botRosterMeta(member as never, allMeta)
        const { shape, color, image: faceImage } = botAppearance(member.name, meta)
        const photo = Boolean(faceImage && !isBackfilledFacePng(faceImage))
        const label = displayName(member as never, meta)

        return (
          <div
            className="flex items-center gap-2.5 rounded-md px-1.5 py-1.5"
            key={`${member.connectionId || 'local'}::${member.name}`}
          >
            <BotFace
              color={avatarColor(color, member.name)}
              image={photo ? faceImage : null}
              name={member.name}
              shape={shape}
              size={28}
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[0.8125rem] font-medium text-(--ui-text-primary)">{label}</div>
              <div className="truncate font-mono text-[0.65rem] text-(--ui-text-quaternary)">
                @{member.handle || member.name}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function GroupDetailsPanel({
  busy = false,
  canStop = false,
  group,
  members,
  onClose,
  onDisband,
  onManageMembers,
  onOpenSettings,
  onRename,
  onStop,
  image,
  tab: initialTab = 'details'
}: GroupDetailsPanelProps) {
  const { t } = useI18n()
  const b = useBots()
  const [tab, setTab] = useState<GroupDetailsTab>(initialTab)
  const [nameDraft, setNameDraft] = useState(group)

  const tabs: { id: GroupDetailsTab; label: string }[] = [
    { id: 'details', label: b.detailsPanel.details },
    { id: 'members', label: b.group.membersLabel }
  ]

  const canRename = Boolean(nameDraft.trim() && nameDraft.trim() !== group)

  const applyRename = () => {
    if (canRename) {
      onRename(nameDraft.trim())
    }
  }

  return (
    <aside
      aria-label={b.group.settingsLabel(group)}
      className={cn(
        'pointer-events-auto absolute top-0 right-0 bottom-0 z-30 flex w-[min(22rem,100%)] flex-col',
        'border-l border-(--ui-stroke-secondary) bg-(--ui-widget-surface-background) shadow-nous'
      )}
      data-slot="group-details-panel"
    >
      <div className="relative flex flex-col items-center gap-1 px-4 pb-3 pt-3">
        <Button
          aria-label={b.group.closeDetails}
          className="absolute top-2 right-2"
          onClick={onClose}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <Codicon name="close" />
        </Button>
        <GroupAvatarCluster image={image} members={members} size={64} />
        <div className="max-w-full truncate text-sm font-semibold text-(--ui-text-primary)">{group}</div>
        <div className="text-[0.65rem] text-(--ui-text-quaternary)">{b.group.memberCount(members.length)}</div>
      </div>

      <div className="mx-3 flex gap-0.5 overflow-x-auto rounded-lg bg-(--ui-bg-secondary) p-0.5">
        {tabs.map(entry => (
          <button
            className={cn(
              'min-w-0 flex-1 truncate rounded-md px-2 py-1.5 text-[0.6875rem] font-medium transition-colors',
              tab === entry.id
                ? 'bg-(--ui-widget-surface-background) text-(--ui-text-primary) shadow-sm'
                : 'text-(--ui-text-tertiary) hover:text-(--ui-text-secondary)'
            )}
            key={entry.id}
            onClick={() => setTab(entry.id)}
            type="button"
          >
            {entry.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
        {tab === 'details' ? (
          <div className="grid gap-4">
            {labeled(
              b.group.nameLabel,
              <Input
                aria-label={b.group.nameLabel}
                onChange={event => setNameDraft(event.target.value)}
                value={nameDraft}
              />
            )}
            {labeled(b.group.membersLabel, <MemberRows members={members} />)}
            <div className="flex flex-wrap gap-2">
              {onManageMembers ? (
                <Button onClick={onManageMembers} type="button" variant="outline">
                  {b.group.manageMembers}
                </Button>
              ) : null}
              {onOpenSettings ? (
                <Button onClick={onOpenSettings} type="button" variant="outline">
                  {b.group.settingsTitle}
                </Button>
              ) : null}
            </div>
            <div className="grid gap-2 border-t border-(--ui-stroke-secondary) pt-3">
              {onStop ? (
                <Button disabled={busy || !canStop} onClick={onStop} type="button" variant="outline">
                  {b.group.stop}
                </Button>
              ) : null}
              <Button disabled={busy || !canRename} onClick={applyRename} type="button">
                Rename
              </Button>
              <Button disabled={busy} onClick={onDisband} type="button" variant="destructive">
                {b.group.disbandAction}
              </Button>
            </div>
          </div>
        ) : null}

        {tab === 'members' ? (
          <div className="grid gap-3">
            <MemberRows members={members} />
            {onManageMembers ? (
              <Button onClick={onManageMembers} type="button" variant="outline">
                {b.group.manageMembers}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-(--ui-stroke-secondary) px-4 py-2.5">
        <Button disabled={busy} onClick={onClose} type="button" variant="ghost">
          {t.common.cancel}
        </Button>
        <Button disabled={busy || !canRename} onClick={applyRename} type="button">
          {busy ? t.common.saving : t.common.save}
        </Button>
      </div>
    </aside>
  )
}
