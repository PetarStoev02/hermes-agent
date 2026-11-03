/**
 * Tile grid of pinned bots above the roster folders. Click opens the bot's
 * chat (same path as a row). Drag reorders pins via `pinnedOrder`. Drop a
 * roster bot here to pin it (empty zone when there are no pins yet). Context
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
import { type DragEvent, useEffect, useState } from 'react'

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
import { $botMeta, $lastRoster, botRosterKey } from './data'
import { $groupChatWorkspace } from './group-chat'
import { useBots } from './i18n'
import { displayName } from './labels'
import {
  isRosterBotDrag,
  persistPinnedOrder,
  pinBotIntoOrder,
  PINNED_BOT_DRAG_MIME,
  pinnedGridLayout,
  reorderPinnedKeys,
  setBotPinned
} from './pinned-bots'
import { openRosterBot } from './roster-actions'
import { botRosterMeta } from './routing'
import { botRowOwnsWorkspace, botWorkingMood, useTurnBusy } from './row-helpers'
import type { RosterRow } from './types'
import { $draggingBot, BOT_DRAG_MIME } from './user-sections'

interface PinnedGridProps {
  bots: RosterRow[]
  onEdit: (bot: RosterRow) => void
}

export function PinnedGrid({ bots, onEdit }: PinnedGridProps) {
  const b = useBots()
  const allMeta = useValue($botMeta)
  const roster = useValue($lastRoster)
  const dragging = useValue($draggingBot)
  const layout = pinnedGridLayout(bots.length)
  const acceptingBot = isRosterBotDrag(dragging)
  const [over, setOver] = useState(false)

  useEffect(() => {
    if (!dragging) {
      setOver(false)
    }
  }, [dragging])

  // No pins and nothing in flight: stay out of the way. While a bot is
  // dragged, keep an empty drop strip so the first pin has a target.
  if (!bots.length && !acceptingBot) {
    return null
  }

  const botsByKey = new Map(bots.map(bot => [botRosterKey(bot), bot]))
  const orderKeys = bots.map(botRosterKey)

  const dropReorder = (targetKey: string) => {
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

  const dropPinBot = (atKey: null | string) => {
    if (!dragging || !isRosterBotDrag(dragging)) {
      return
    }

    const bot = roster.find(row => botRosterKey(row) === dragging)

    if (!bot) {
      return
    }

    void ensureBotMetadata(bot)
      .then(current => {
        void pinBotIntoOrder(bot, botsByKey, orderKeys, atKey).then(() => {
          host.notify({
            kind: 'info',
            message: b.bot.pinnedToast(displayName(bot, current))
          })
        })
      })
      .catch(error => host.notifyError?.(error, b.bot.metadataLoadFailed))
  }

  const acceptsBot = (event: DragEvent) =>
    acceptingBot && event.dataTransfer.types.includes(BOT_DRAG_MIME)

  const acceptsPinReorder = (event: DragEvent) =>
    event.dataTransfer.types.includes(PINNED_BOT_DRAG_MIME)

  return (
    <div
      aria-label={b.roster.pinned}
      className={cn(
        'mx-1.5 mb-1 rounded-md transition-[background-color,box-shadow] duration-100',
        acceptingBot && 'ring-1 ring-inset ring-(--ui-stroke-secondary)',
        acceptingBot && over && 'bg-(--ui-accent)/10 ring-(--ui-accent)'
      )}
      data-drop-over={acceptingBot && over ? 'true' : undefined}
      data-slot="bots-pinned-grid"
      onDragEnter={event => {
        if (acceptsBot(event)) {
          event.preventDefault()
          setOver(true)
        }
      }}
      onDragLeave={event => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOver(false)
        }
      }}
      onDragOver={event => {
        if (!acceptsBot(event) && !acceptsPinReorder(event)) {
          return
        }

        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'

        if (acceptsBot(event) && !over) {
          setOver(true)
        }
      }}
      onDrop={event => {
        setOver(false)
        $draggingBot.set(null)

        if (acceptsBot(event)) {
          event.preventDefault()
          dropPinBot(null)

          return
        }

        // Tile-level drop handlers own pin reorder; ignore here.
      }}
    >
      {bots.length === 0 ? (
        <div className="flex items-center justify-center px-2 py-3 text-[0.6875rem] text-(--ui-text-quaternary)">
          {b.bot.pinToTop}
        </div>
      ) : (
        // Flex + justify-center so a short last row (2 of 4, 1 of 3, …) sits
        // in the middle of the strip instead of hugging the left edge. Tile
        // width stays 1/columns so a full row still fills the roster.
        <div className="flex flex-wrap justify-center gap-1 px-0 pb-1 pt-1">
          {bots.map(bot => (
            <div
              className="min-w-0"
              key={botRosterKey(bot)}
              style={{
                width: `calc((100% - ${(layout.columns - 1) * 0.25}rem) / ${layout.columns})`
              }}
            >
              <PinnedTile
                avatarSize={layout.avatarSize}
                bot={bot}
                dragging={dragging === `pin:${botRosterKey(bot)}`}
                onDropBot={() => dropPinBot(botRosterKey(bot))}
                onDropPin={() => dropReorder(botRosterKey(bot))}
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
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

interface PinnedTileProps {
  avatarSize: number
  bot: RosterRow
  dragging: boolean
  onDropBot: () => void
  onDropPin: () => void
  onEdit: (bot: RosterRow) => void
  onUnpin: () => void
}

function PinnedTile({ avatarSize, bot, dragging, onDropBot, onDropPin, onEdit, onUnpin }: PinnedTileProps) {
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
    const types = event.dataTransfer.types

    if (!types.includes(PINNED_BOT_DRAG_MIME) && !types.includes(BOT_DRAG_MIME)) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
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
        // PINNED mime → reorder inside the grid. BOT mime → drop on a folder
        // to unpin and file there (same payload folders already accept).
        event.dataTransfer.setData(PINNED_BOT_DRAG_MIME, rosterKey)
        event.dataTransfer.setData(BOT_DRAG_MIME, rosterKey)
        event.dataTransfer.effectAllowed = 'move'
        $draggingBot.set(`pin:${rosterKey}`)
      }}
      onDrop={event => {
        const types = event.dataTransfer.types

        // Pin-tile drag carries both mimes; prefer reorder over re-pin.
        if (types.includes(PINNED_BOT_DRAG_MIME)) {
          event.preventDefault()
          event.stopPropagation()
          onDropPin()
          $draggingBot.set(null)

          return
        }

        if (types.includes(BOT_DRAG_MIME)) {
          event.preventDefault()
          event.stopPropagation()
          onDropBot()
          $draggingBot.set(null)
        }
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
