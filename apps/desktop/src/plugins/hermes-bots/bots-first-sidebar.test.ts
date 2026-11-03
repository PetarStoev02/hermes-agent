import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  applyBotsFirstSidebar,
  BOTS_PANE_ID,
  SESSIONS_PANE_ID,
  startBotsFirstSidebar,
  TERMINAL_PANE_ID
} from './bots-first-sidebar'

describe('applyBotsFirstSidebar', () => {
  it('fronts Bots then hides the Sessions and Terminal strip tabs', () => {
    const revealPane = vi.fn()
    const setStripTabHidden = vi.fn(() => true)

    expect(applyBotsFirstSidebar({ revealPane, setStripTabHidden })).toBe(true)
    expect(revealPane).toHaveBeenCalledWith(BOTS_PANE_ID)
    expect(setStripTabHidden).toHaveBeenCalledWith(SESSIONS_PANE_ID, true)
    expect(setStripTabHidden).toHaveBeenCalledWith(TERMINAL_PANE_ID, true)
  })

  it('still fronts Bots when the host cannot hide strip tabs', () => {
    const revealPane = vi.fn()

    expect(applyBotsFirstSidebar({ revealPane })).toBe(false)
    expect(revealPane).toHaveBeenCalledWith(BOTS_PANE_ID)
  })
})

describe('startBotsFirstSidebar', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('runs after one tick and skips the apply when disposed first', () => {
    vi.useFakeTimers()
    const apply = vi.fn()
    const disposers: Array<() => void> = []

    startBotsFirstSidebar(
      {
        onDispose: fn => {
          disposers.push(fn)
        }
      },
      apply
    )

    for (const dispose of disposers) {
      dispose()
    }

    vi.runAllTimers()
    expect(apply).not.toHaveBeenCalled()

    startBotsFirstSidebar({}, apply)
    vi.runAllTimers()
    expect(apply).toHaveBeenCalledTimes(1)
  })
})
