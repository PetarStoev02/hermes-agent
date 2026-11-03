import { beforeEach, describe, expect, it } from 'vitest'

import {
  $botDetailsOpen,
  $botDetailsTab,
  closeBotDetails,
  openBotDetails,
  setBotDetailsTab,
  toggleBotDetails
} from './details-panel-state'

beforeEach(() => {
  $botDetailsOpen.set(false)
  $botDetailsTab.set('details')
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
})
