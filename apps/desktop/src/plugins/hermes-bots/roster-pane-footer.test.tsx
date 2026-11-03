import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const hostMocks = vi.hoisted(() => ({
  navigate: vi.fn()
}))

vi.mock('@hermes/plugin-sdk', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@hermes/plugin-sdk')

  return {
    ...actual,
    host: { ...(actual.host as object), navigate: hostMocks.navigate },
    useI18n: () => ({ t: { statusbar: { openCommandCenter: 'Open Command Center' } } })
  }
})

import { RosterPaneFooter } from './roster-pane-footer'

afterEach(() => {
  cleanup()
  hostMocks.navigate.mockClear()
})

describe('RosterPaneFooter', () => {
  it('opens Command Center from the ⌘ button', () => {
    render(<RosterPaneFooter />)

    fireEvent.click(screen.getByRole('button', { name: 'Open Command Center' }))
    expect(hostMocks.navigate).toHaveBeenCalledWith('/command-center')
  })
})
