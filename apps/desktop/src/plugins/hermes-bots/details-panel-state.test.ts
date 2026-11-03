import { beforeEach, describe, expect, it } from 'vitest'

import {
  $botDetailsOpen,
  $botDetailsTab,
  $botDetailsTargetKey,
  closeBotDetails,
  openBotDetails,
  openBotDetailsFor,
  setBotDetailsTab,
  toggleBotDetails
} from './details-panel-state'
import type { RosterRow } from './types'

beforeEach(() => {
  $botDetailsOpen.set(false)
  $botDetailsTab.set('details')
  $botDetailsTargetKey.set(null)
})

describe('bot details panel state', () => {
  it('opens, toggles, remembers the last tab across close/open', () => {
    openBotDetails('look')
    expect($botDetailsOpen.get()).toBe(true)
    expect($botDetailsTab.get()).toBe('look')

    closeBotDetails()
    expect($botDetailsOpen.get()).toBe(false)
    expect($botDetailsTab.get()).toBe('look')

    toggleBotDetails()
    expect($botDetailsOpen.get()).toBe(true)
    setBotDetailsTab('soul')
    expect($botDetailsTab.get()).toBe('soul')
  })

  it('pins Edit-profile openers to a roster key and clears it on name-pill toggle', () => {
    const bot = { connectionId: 'local', name: 'hermes' } as RosterRow

    openBotDetailsFor(bot, 'capabilities')
    expect($botDetailsOpen.get()).toBe(true)
    expect($botDetailsTab.get()).toBe('capabilities')
    expect($botDetailsTargetKey.get()).toBeTruthy()

    toggleBotDetails()
    expect($botDetailsTargetKey.get()).toBeNull()
  })
})
