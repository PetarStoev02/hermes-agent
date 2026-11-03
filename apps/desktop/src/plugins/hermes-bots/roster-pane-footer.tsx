/**
 * Bots sidebar footer: ⌘ opens Command Center. No profile row — settings stay
 * in the titlebar; this is the Grok-style corner affordance only.
 */

import { Button, host, Tip, useI18n } from '@hermes/plugin-sdk'

const COMMAND_CENTER_ROUTE = '/command-center'

export function RosterPaneFooter() {
  const { t } = useI18n()
  const label = t.statusbar.openCommandCenter

  return (
    <div
      className="flex shrink-0 items-center border-t border-(--ui-stroke-tertiary) px-2 py-1.5"
      data-slot="bots-roster-footer"
    >
      <Tip label={label}>
        <Button
          aria-label={label}
          className="size-7 justify-center px-0 text-(--ui-text-secondary)"
          onClick={() => host.navigate(COMMAND_CENTER_ROUTE)}
          size="icon-sm"
          variant="ghost"
        >
          <span aria-hidden className="text-[0.875rem] leading-none">
            ⌘
          </span>
        </Button>
      </Tip>
    </div>
  )
}
