/**
 * ⌘ opens Command Center. Lives in the roster toolbar (not a bottom strip) so
 * it does not stack with the app statusbar as a double footer.
 */

import { Button, host, Tip, useI18n } from '@hermes/plugin-sdk'

const COMMAND_CENTER_ROUTE = '/command-center'

export function RosterCommandCenterButton() {
  const { t } = useI18n()
  const label = t.shell.statusbar.openCommandCenter

  return (
    <Tip label={label}>
      <Button
        aria-label={label}
        className="rounded-md text-(--ui-text-tertiary) hover:text-foreground"
        data-slot="bots-command-center"
        onClick={() => host.navigate(COMMAND_CENTER_ROUTE)}
        size="icon-xs"
        variant="ghost"
      >
        <span aria-hidden className="text-[0.8125rem] leading-none">
          ⌘
        </span>
      </Button>
    </Tip>
  )
}
