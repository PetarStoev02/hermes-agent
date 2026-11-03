/**
 * Pinned-bot grid: which bots leave their folders for the tile strip, how
 * the strip lays out, and how drag reorder writes `pinnedOrder` on bot meta.
 *
 * Pinning is a Desktop presentation preference (`bot-meta.pinned`). The bot
 * keeps its section membership; it just stops rendering inside the folder
 * while pinned, so unpinning restores its place without a separate move.
 */

import { botRosterKey, saveBotMeta } from './data'
import { isBotPinned } from './hidden-bots'
import { botRosterMeta } from './routing'
import type { BotMeta, RosterRow } from './types'

/** MIME for reordering tiles inside the pinned grid. Pin drags ALSO set
 *  `BOT_DRAG_MIME` so a folder drop can unpin and file the bot. */
export const PINNED_BOT_DRAG_MIME = 'application/x-hermes-pinned-bot-key'

export interface PinnedGridLayout {
  /** Avatar edge length in CSS pixels. */
  avatarSize: number
  /** Columns in the CSS grid. */
  columns: number
}

/** ≤3 pins: large tiles, 3 across. ≥4: smaller tiles, 4 across, wrapping. */
export function pinnedGridLayout(count: number): PinnedGridLayout {
  if (count <= 3) {
    return { avatarSize: 48, columns: 3 }
  }

  return { avatarSize: 36, columns: 4 }
}

/** Sort pinned bots by explicit order, then activity, then roster key. */
export function sortPinnedBots(
  bots: RosterRow[],
  allMeta: Record<string, BotMeta>,
  activityOf: (bot: RosterRow) => number
): RosterRow[] {
  return bots.slice().sort((a, b) => {
    const orderA = botRosterMeta(a, allMeta)?.pinnedOrder
    const orderB = botRosterMeta(b, allMeta)?.pinnedOrder
    const hasA = typeof orderA === 'number' && Number.isFinite(orderA)
    const hasB = typeof orderB === 'number' && Number.isFinite(orderB)

    if (hasA && hasB && orderA !== orderB) {
      return (orderA as number) - (orderB as number)
    }

    if (hasA !== hasB) {
      return hasA ? -1 : 1
    }

    const activity = activityOf(b) - activityOf(a)

    if (activity !== 0) {
      return activity
    }

    return botRosterKey(a).localeCompare(botRosterKey(b))
  })
}

/** Next `pinnedOrder` when pinning a bot — append after every current pin. */
export function nextPinnedOrder(allMeta: Record<string, BotMeta>): number {
  let max = -1

  for (const meta of Object.values(allMeta)) {
    if (!meta?.pinned) {
      continue
    }

    const order = meta.pinnedOrder

    if (typeof order === 'number' && Number.isFinite(order) && order > max) {
      max = order
    }
  }

  return max + 1
}

/**
 * Move `fromKey` to sit where `toKey` is. Returns the new key order, or null
 * when the drop is a no-op / unknown key. Hidden/filtered pins stay out of
 * `keys` and keep their existing `pinnedOrder` until a later full rewrite.
 */
export function reorderPinnedKeys(keys: string[], fromKey: string, toKey: string): string[] | null {
  if (fromKey === toKey) {
    return null
  }

  const from = keys.indexOf(fromKey)
  const to = keys.indexOf(toKey)

  if (from < 0 || to < 0) {
    return null
  }

  const next = keys.slice()
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)

  return next
}

/** Write dense `pinnedOrder` values for the visible pin order. */
export async function persistPinnedOrder(botsByKey: Map<string, RosterRow>, order: string[]): Promise<void> {
  await Promise.all(
    order.map((key, pinnedOrder) => {
      const bot = botsByKey.get(key)

      if (!bot) {
        return Promise.resolve()
      }

      return saveBotMeta(bot, { pinned: true, pinnedOrder })
    })
  )
}

/** Pin or unpin, assigning / clearing `pinnedOrder` so the grid stays ordered. */
export async function setBotPinned(bot: RosterRow, pinned: boolean, allMeta: Record<string, BotMeta>): Promise<void> {
  if (pinned) {
    await saveBotMeta(bot, { pinned: true, pinnedOrder: nextPinnedOrder(allMeta) })

    return
  }

  await saveBotMeta(bot, { pinned: false, pinnedOrder: undefined })
}

/**
 * Pin `bot` into the visible grid order. `atKey` null appends; otherwise the
 * new pin lands where that tile is (pushing it right). Already-pinned bots
 * just move. Writes dense `pinnedOrder` for every key in the resulting list.
 */
export async function pinBotIntoOrder(
  bot: RosterRow,
  botsByKey: Map<string, RosterRow>,
  orderKeys: string[],
  atKey: null | string
): Promise<void> {
  const key = botRosterKey(bot)
  const next = orderKeys.filter(existing => existing !== key)

  if (atKey && next.includes(atKey)) {
    next.splice(next.indexOf(atKey), 0, key)
  } else {
    next.push(key)
  }

  botsByKey.set(key, bot)
  await persistPinnedOrder(botsByKey, next)
}

/** True when the in-flight roster drag is a bot row (not a pin/group/folder). */
export function isRosterBotDrag(dragging: null | string): boolean {
  if (!dragging) {
    return false
  }

  if (dragging.startsWith('pin:')) {
    return false
  }

  // Group and section payloads share BOT_DRAG_MIME but use these prefixes.
  if (dragging.startsWith('group:') || dragging.startsWith('section:')) {
    return false
  }

  return true
}

export function pinnedBotsFromRoster(
  bots: RosterRow[],
  allMeta: Record<string, BotMeta>,
  activityOf: (bot: RosterRow) => number
): RosterRow[] {
  return sortPinnedBots(
    bots.filter(bot => isBotPinned(bot, allMeta)),
    allMeta,
    activityOf
  )
}
