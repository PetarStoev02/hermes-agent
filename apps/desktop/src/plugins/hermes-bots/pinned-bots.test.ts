/**
 * Pinned grid derivation: which bots leave folders for the tile strip, how
 * the strip lays out at 3 vs 4+, and how drag reorder writes `pinnedOrder`.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const { saveBotMeta } = vi.hoisted(() => ({
  saveBotMeta: vi.fn<(bot: { name: string }, patch: Record<string, unknown>) => Promise<unknown>>()
}))

vi.mock('./data', async () => {
  const { atom } = await import('nanostores')
  const $botMeta = atom<Record<string, Record<string, unknown>>>({})

  saveBotMeta.mockImplementation(async (bot: { name: string }, patch: Record<string, unknown>) => {
    $botMeta.set({ ...$botMeta.get(), [bot.name]: { ...$botMeta.get()[bot.name], ...patch } })

    return { serverOutcome: 'persisted', serverPersisted: true }
  })

  return {
    $botMeta,
    botRosterKey: (bot: { connectionId?: string; name?: string }) =>
      `${bot?.connectionId || 'legacy'}::${bot?.name || 'default'}`,
    saveBotMeta
  }
})

vi.mock('./routing', () => ({
  botRosterMeta: (bot: { name: string }, meta: Record<string, unknown>) => meta[bot.name]
}))

import { $botMeta } from './data'
import { isBotPinned } from './hidden-bots'
import {
  nextPinnedOrder,
  pinnedBotsFromRoster,
  pinnedGridLayout,
  reorderPinnedKeys,
  setBotPinned,
  sortPinnedBots
} from './pinned-bots'
import type { BotMeta, RosterRow } from './types'

const bot = (name: string, extra: Partial<RosterRow> = {}): RosterRow => ({ name, ...extra })

beforeEach(() => {
  $botMeta.set({})
  saveBotMeta.mockClear()
})

describe('pinnedGridLayout', () => {
  it('uses large tiles in 3 columns up to 3 pins, then shrinks to 4 columns', () => {
    expect(pinnedGridLayout(0)).toEqual({ avatarSize: 48, columns: 3 })
    expect(pinnedGridLayout(1)).toEqual({ avatarSize: 48, columns: 3 })
    expect(pinnedGridLayout(3)).toEqual({ avatarSize: 48, columns: 3 })
    expect(pinnedGridLayout(4)).toEqual({ avatarSize: 36, columns: 4 })
    expect(pinnedGridLayout(7)).toEqual({ avatarSize: 36, columns: 4 })
  })
})

describe('sortPinnedBots / pinnedOrder', () => {
  it('orders by pinnedOrder, then activity, and appends the next pin after the densest order', () => {
    const meta: Record<string, BotMeta> = {
      alpha: { pinned: true, pinnedOrder: 2 },
      beta: { pinned: true, pinnedOrder: 0 },
      gamma: { pinned: true }
    }
    const activity = (row: RosterRow) => ({ alpha: 10, beta: 1, gamma: 50 }[row.name] || 0)

    expect(sortPinnedBots([bot('alpha'), bot('gamma'), bot('beta')], meta, activity).map(row => row.name)).toEqual([
      'beta',
      'alpha',
      'gamma'
    ])
    expect(nextPinnedOrder(meta)).toBe(3)
    expect(nextPinnedOrder({})).toBe(0)
  })

  it('reorderPinnedKeys moves a tile onto another and rejects no-ops', () => {
    expect(reorderPinnedKeys(['a', 'b', 'c'], 'c', 'a')).toEqual(['c', 'a', 'b'])
    expect(reorderPinnedKeys(['a', 'b', 'c'], 'a', 'a')).toBeNull()
    expect(reorderPinnedKeys(['a', 'b'], 'missing', 'a')).toBeNull()
  })

  it('setBotPinned assigns and clears pinnedOrder through saveBotMeta', async () => {
    $botMeta.set({ sales: { pinned: true, pinnedOrder: 0 } })
    await setBotPinned(bot('cto'), true, $botMeta.get() as Record<string, BotMeta>)
    expect(saveBotMeta).toHaveBeenCalledWith(bot('cto'), { pinned: true, pinnedOrder: 1 })

    await setBotPinned(bot('sales'), false, $botMeta.get() as Record<string, BotMeta>)
    expect(saveBotMeta).toHaveBeenCalledWith(bot('sales'), { pinned: false, pinnedOrder: undefined })
  })
})

describe('pinned bots leave folders', () => {
  it('pinnedBotsFromRoster lists pins in order, and folder lists exclude every pin', () => {
    const roster = [bot('sales'), bot('cto'), bot('cfo')]
    const allMeta: Record<string, BotMeta> = {
      sales: { pinned: true, pinnedOrder: 1, sectionId: 'team', sectionName: 'Team' },
      cto: { pinned: true, pinnedOrder: 0, sectionId: 'team', sectionName: 'Team' },
      cfo: { sectionId: 'team', sectionName: 'Team' }
    }
    const activityOf = () => 0

    expect(pinnedBotsFromRoster(roster, allMeta, activityOf).map(row => row.name)).toEqual(['cto', 'sales'])
    // Same filter deriveRosterRows uses before building folder rows — a pin
    // keeps sectionId in meta but stops rendering inside the folder.
    expect(roster.filter(row => !isBotPinned(row, allMeta)).map(row => row.name)).toEqual(['cfo'])
  })
})
