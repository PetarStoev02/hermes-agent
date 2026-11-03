/**
 * Right-side bot details panel: open/closed and the remembered tab.
 *
 * Renderer-local, scoped per window (nanostore atoms — not persisted). The
 * last tab survives bot switches so clicking another bot's name pill lands
 * on the same tab. Never open this from a background event — only from an
 * explicit click (name pill, Edit profile menu).
 */

import { atom } from '@hermes/plugin-sdk'

export type BotDetailsTab = 'capabilities' | 'details' | 'look' | 'soul'

export const $botDetailsOpen = atom(false)
export const $botDetailsTab = atom<BotDetailsTab>('details')

export function openBotDetails(tab?: BotDetailsTab): void {
  if (tab) {
    $botDetailsTab.set(tab)
  }

  $botDetailsOpen.set(true)
}

export function closeBotDetails(): void {
  $botDetailsOpen.set(false)
}

export function toggleBotDetails(): void {
  $botDetailsOpen.set(!$botDetailsOpen.get())
}

export function setBotDetailsTab(tab: BotDetailsTab): void {
  $botDetailsTab.set(tab)
}
