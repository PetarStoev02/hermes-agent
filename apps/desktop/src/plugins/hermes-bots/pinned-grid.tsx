/**
 * Tile grid of pinned bots above the roster folders. Click opens the bot's
 * chat (same path as a row). Drag reorders pins via `pinnedOrder`. Context
 * menu covers unpin — pinned bots are absent from folder rows.
 */

import {
  cn,
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  GlyphSpinner,
  host,
  RowButton,
  Tip,
  useValue
} from '@hermes/plugin-sdk'
import type { DragEvent } from 'react'

import { avatarColor, botAppearance, BotFace } from './avatar'
import { isBackfilledFacePng } from './avatar-image'
import {
  $botChatFocused,
  $focusedBotOwner,
  $pendingBotOpen,
  $selectedRosterKey,
  focusedRosterOwner
} from './bot-state'
import { ensureBotMetadata } from './canonical-chat'
import { $botMeta, botRosterKey } from './data'
import { $groupChatWorkspace } from './group-chat'
import { useBots } from './i18n'
import { displayName } from './labels'
import {
  persistPinnedOrder,
  PINNED_BOT_DRAG_MIME,
  pinnedGridLayout,
  reorderPinnedKeys,
  setBotPinned
} from './pinned-bots'
import { openRosterBot } from './roster-actions'
import { botRosterMeta } from './routing'
import { botRowOwnsWorkspace, botWorkingMood, useTurnBusy } from './row-helpers'
import type { RosterRow } from './types'
import { $draggingBot } from './user-sections'

interface PinnedGridProps {
  bots: RosterRow[]
  onEdit: (bot: RosterRow) => void
}

export function PinnedGrid({ bots, onEdit }: PinnedGridProps) {
  const b = useBots()
  const allMeta = useValue($botMeta)
  const dragging = useValue($draggingBot)
  const layout = pinnedGridLayout(bots.length)

  if (!bots.length) {
    return null
  }

  const botsByKey = new Map(bots.map(bot => [botRosterKey(bot), bot]))
  const orderKeys = bots.map(botRosterKey)

  const dropOn = (targetKey: string) => {
    if (!dragging || !dragging.startsWith('pin:')) {
      return
    }

    const fromKey = dragging.slice('pin:'.length)
    const next = reorderPinnedKeys(orderKeys, fromKey, targetKey)

    if (!next) {
      return
    }

    void persistPinnedOrder(botsByKey, next)
  }

  return (
    <div
      aria-label={b.roster.pinned}
      className="grid gap-1 px-1.5 pb-2 pt-1"
      data-slot="bots-pinned-grid"
      style={{ gridTemplateColumns: `repeat(${layout.columns}, minmax(0, 1fr))` }}
    >
      {bots.map(bot => (
        <PinnedTile
          avatarSize={layout.avatarSize}
          bot={bot}
          dragging={dragging === `pin:${botRosterKey(bot)}`}
          key={botRosterKey(bot)}
          onDropPin={() => dropOn(botRosterKey(bot))}
          onEdit={onEdit}
          onUnpin={() => {
            void ensureBotMetadata(bot)
              .then(current => {
                void setBotPinned(bot, false, allMeta)
                host.notify({
                  kind: 'info',
                  message: b.bot.unpinnedToast(displayName(bot, current))
                })
              })
              .catch(error => host.notifyError?.(error, b.bot.metadataLoadFailed))
          }}
        />
      ))}
    </div>
  )
}

interface PinnedTileProps {
  avatarSize: number
  bot: RosterRow
  dragging: boolean
  onDropPin: () => void
  onEdit: (bot: RosterRow) => void
  onUnpin: () => void
}

function PinnedTile({ avatarSize, bot, dragging, onDropPin, onEdit, onUnpin }: PinnedTileProps) {
  const b = useBots()
  const allMeta = useValue($botMeta)
  const meta = botRosterMeta(bot, allMeta)
  const focusedOwner = focusedRosterOwner(useValue($focusedBotOwner))
  const selectedRosterKey = useValue($selectedRosterKey)
  const pendingOpenKey = useValue($pendingBotOpen)?.key
  const isOpening = pendingOpenKey === botRosterKey(bot)
  const botChatFocused = useValue($botChatFocused)
  const activeGroup = useValue($groupChatWorkspace)
  const turnBusy = useTurnBusy()
  const isActive = botRowOwnsWorkspace(bot, activeGroup, botChatFocused, focusedOwner, selectedRosterKey)
  const { shape, color, image } = botAppearance(bot.name, meta)
  const photo = Boolean(image && !isBackfilledFacePng(image))
  const mood = botWorkingMood(bot, focusedOwner, turnBusy, String(host.state.connectionId?.get?.() || 'local').trim(), Date.now())
  const label = displayName(bot, meta)
  const rosterKey = botRosterKey(bot)

  const onDragOver = (event: DragEvent) => {
    if (!event.dataTransfer.types.includes(PINNED_BOT_DRAG_MIME)) {
      return
    }

    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }

  const tile = (
    <RowButton
      aria-busy={isOpening || undefined}
      aria-label={label}
      className={cn(
        'flex w-full min-w-0 flex-col items-center gap-1 rounded-md px-1 py-1.5 text-center transition-colors',
        'hover:bg-(--chrome-action-hover)',
        isActive && 'bg-(--ui-row-active-background)',
        dragging && 'opacity-40'
      )}
      data-roster-key={rosterKey}
      draggable
      onClick={() => void openRosterBot(bot)}
      onDragEnd={() => $draggingBot.set(null)}
      onDragOver={onDragOver}
      onDragStart={event => {
        event.dataTransfer.setData(PINNED_BOT_DRAG_MIME, rosterKey)
        event.dataTransfer.effectAllowed = 'move'
        $draggingBot.set(`pin:${rosterKey}`)
      }}
      onDrop={event => {
        if (!event.dataTransfer.types.includes(PINNED_BOT_DRAG_MIME)) {
          return
        }

        event.preventDefault()
        onDropPin()
        $draggingBot.set(null)
      }}
    >
      <div className="relative shrink-0">
        <BotFace
          color={avatarColor(color, bot.name)}
          image={photo ? image : null}
          mood={mood}
          name={bot.name}
          shape={shape}
          size={avatarSize}
        />
        {isOpening ? (
          <GlyphSpinner
            ariaLabel={b.bot.openingChat}
            className="absolute inset-0 m-auto text-xs text-(--ui-text-secondary)"
          />
        ) : null}
      </div>
      <Tip label={label}>
        <span className="w-full truncate text-[0.6875rem] font-medium text-(--ui-text-primary)">{label}</span>
      </Tip>
    </RowButton>
  )

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{tile}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={() => void openRosterBot(bot)}>{b.bot.openBotChat}</ContextMenuItem>
        <ContextMenuItem onSelect={() => void openRosterBot(bot, { intent: 'tab' })}>
          {b.bot.openBotChatInNewTab}
        </ContextMenuItem>
        <ContextMenuItem onSelect={onUnpin}>{b.bot.unpin}</ContextMenuItem>
        <ContextMenuItem
          onSelect={() => {
            void ensureBotMetadata(bot)
              .then(() => onEdit(bot))
              .catch(error => host.notifyError?.(error, b.bot.metadataLoadFailed))
          }}
        >
          {b.bot.editMenu}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
