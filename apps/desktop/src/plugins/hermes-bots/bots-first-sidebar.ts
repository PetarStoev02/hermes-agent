/**
 * Bots-first sidebar — Sessions stays dockable (⌘K / Show tab can bring it
 * back) but the left chrome opens on Bots alone. Coding lives in T3 Code;
 * this window is for agents.
 */

import { host } from '@hermes/plugin-sdk'

import { ID } from './shared'

export const BOTS_PANE_ID = `${ID}:pane`
export const SESSIONS_PANE_ID = 'sessions'

type StripTabHider = (paneId: string, hidden: boolean) => boolean

interface BotsFirstHost {
  revealPane?: (paneId: string) => void
  setStripTabHidden?: StripTabHider
}

/** Front Bots and hide the Sessions strip tab. Idempotent. */
export function applyBotsFirstSidebar(api: BotsFirstHost = host as BotsFirstHost): boolean {
  api.revealPane?.(BOTS_PANE_ID)

  if (typeof api.setStripTabHidden !== 'function') {
    return false
  }

  return api.setStripTabHidden(SESSIONS_PANE_ID, true)
}

/** Defer one tick so dock enforcement has stacked Bots into the sessions zone. */
export function startBotsFirstSidebar(
  ctx: { onDispose?: (fn: () => void) => void },
  apply: () => void = () => {
    applyBotsFirstSidebar()
  }
) {
  let timer: null | ReturnType<typeof setTimeout> = null
  let disposed = false

  const run = () => {
    timer = null

    if (!disposed) {
      apply()
    }
  }

  try {
    timer = setTimeout(run, 0)
  } catch {
    run()
  }

  if (typeof ctx.onDispose === 'function') {
    ctx.onDispose(() => {
      disposed = true

      if (timer !== null) {
        clearTimeout(timer)
        timer = null
      }
    })
  }
}
