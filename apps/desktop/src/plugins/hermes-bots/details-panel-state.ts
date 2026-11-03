/**
 * Right-side bot details panel: open/closed, remembered tab, and which bot
 * the panel is editing.
 *
 * Renderer-local, scoped per window (nanostore atoms — not persisted). The
 * last tab survives bot switches so clicking another bot's name pill lands
 * on the same tab. `targetKey` pins Edit-profile openers to a specific row;
 * when null the panel follows the focused / selected roster bot. Never open
 * this from a background event — only from an explicit click (name pill,
 * Edit profile menu).
 */

import { atom } from '@hermes/plugin-sdk'

import { botRosterKey } from './data'
import type { RosterRow } from './types'

export type BotDetailsTab = 'capabilities' | 'details' | 'look' | 'soul'

export const $botDetailsOpen = atom(false)
export const $botDetailsTab = atom<BotDetailsTab>('details')
/** `botRosterKey` of the bot the panel is editing, or null to follow focus. */
export const $botDetailsTargetKey = atom<null | string>(null)

export function openBotDetails(tab?: BotDetailsTab): void {
  if (tab) {
    $botDetailsTab.set(tab)
  }

  $botDetailsOpen.set(true)
}

/** Open the panel for a specific roster row (Edit profile menu / configure). */
export function openBotDetailsFor(bot: RosterRow, tab?: BotDetailsTab): void {
  $botDetailsTargetKey.set(botRosterKey(bot))
  openBotDetails(tab)
}

export function closeBotDetails(): void {
  $botDetailsOpen.set(false)
}

export function toggleBotDetails(): void {
  // Name pill toggles for the focused bot — clear any pinned Edit-profile target.
  $botDetailsTargetKey.set(null)
  $botDetailsOpen.set(!$botDetailsOpen.get())
}

export function setBotDetailsTab(tab: BotDetailsTab): void {
  $botDetailsTab.set(tab)
}
