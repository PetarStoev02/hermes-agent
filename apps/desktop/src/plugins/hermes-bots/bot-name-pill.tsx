/**
 * Floating name pill at the top center of a Bot Mode chat. Avatar + display
 * name + ›; click toggles the details panel. Only mounts while Bot Mode has a
 * resolvable roster owner on screen.
 */

import { cn, Codicon, RowButton, Tip, useValue } from '@hermes/plugin-sdk'

import { avatarColor, botAppearance, BotFace } from './avatar'
import { isBackfilledFacePng } from './avatar-image'
import { $botChatFocused, $focusedBotOwner, $selectedRosterKey, focusedRosterOwner } from './bot-state'
import { $botMeta, $lastRoster, botRosterKey, isActiveRosterBot } from './data'
import { $botDetailsOpen, toggleBotDetails } from './details-panel-state'
import { useBots } from './i18n'
import { displayName } from './labels'
import { botRosterMeta } from './routing'

export function BotNamePill() {
  const b = useBots()
  const roster = useValue($lastRoster)
  const allMeta = useValue($botMeta)
  const selectedKey = useValue($selectedRosterKey)
  const focusedOwner = focusedRosterOwner(useValue($focusedBotOwner))
  const chatFocused = useValue($botChatFocused)
  const open = useValue($botDetailsOpen)

  const bot =
    (chatFocused && focusedOwner && roster.find(row => isActiveRosterBot(row, focusedOwner))) ||
    (selectedKey ? roster.find(row => botRosterKey(row) === selectedKey) : null) ||
    null

  if (!bot) {
    return null
  }

  const meta = botRosterMeta(bot, allMeta)
  const label = displayName(bot, meta)
  const { shape, color, image } = botAppearance(bot.name, meta)
  const photo = Boolean(image && !isBackfilledFacePng(image))

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-2 z-20 flex justify-center px-3"
      data-slot="bot-name-pill"
    >
      <Tip label={label}>
        <RowButton
          aria-expanded={open}
          aria-label={b.bot.editMenu}
          className={cn(
            'pointer-events-auto flex max-w-full items-center gap-2 rounded-full border border-(--stroke-nous)',
            'bg-(--ui-widget-surface-background) px-2.5 py-1 shadow-nous',
            'text-[0.8125rem] font-medium text-(--ui-text-primary)',
            'transition-colors hover:bg-(--chrome-action-hover) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ui-accent)'
          )}
          onClick={() => toggleBotDetails()}
        >
          <BotFace
            color={avatarColor(color, bot.name)}
            image={photo ? image : null}
            mood="idle"
            name={bot.name}
            shape={shape}
            size={22}
          />
          <span className="min-w-0 truncate">{label}</span>
          <Codicon className="shrink-0 text-[0.625rem] text-(--ui-text-quaternary)" name="chevron-right" />
        </RowButton>
      </Tip>
    </div>
  )
}
