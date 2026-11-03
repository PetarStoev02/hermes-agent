import {
  Button,
  cn,
  Codicon,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  SearchField,
  Tip
} from '@hermes/plugin-sdk'

import { seatableGroupBots, useGroupCapability } from './canonical-group-capabilities'
import type { useBots } from './i18n'
import type { rosterGatewayOptions } from './roster-sections'
import type { RosterActivityFilter, RosterKindFilter, RosterRow } from './types'

interface NewGroupChatItemProps {
  label: string
  onSelect: () => void
  roster: RosterRow[]
}

/** Mounted only while the menu is open, so the capability read happens on
 *  demand. Offered only when the dialog it opens can seat two bots: the same
 *  predicate the dialog's picker uses, or it opened to a dead Create button. */
function NewGroupChatItem({ label, onSelect, roster }: NewGroupChatItemProps) {
  const { connectionId, mode, seatable } = useGroupCapability(true)

  return (
    <DropdownMenuItem disabled={seatableGroupBots(roster, { connectionId, mode, seatable }).length < 2} onSelect={onSelect}>
      <Codicon className="mr-1.5" name="organization" />
      {label}
    </DropdownMenuItem>
  )
}

interface renderRosterToolbarProps {
  b: ReturnType<typeof useBots>
  /** Kept for call-site stability; activity toasts moved out of this chrome. */
  activityToasts?: boolean
  activeSourceRoster?: RosterRow[]
  /** Full roster; New Group Chat seats only `seatableGroupBots` of it. */
  roster: RosterRow[]
  setCreateOpen: (value: boolean) => void
  setGroupCreateOpen: (value: boolean) => void
  setSectionDialog: (
    value: null | { bot?: RosterRow; mode: 'create' } | { id: string; mode: 'rename'; name: string }
  ) => void
  showRosterTools?: boolean
  showRosterSearch: boolean
  showRosterFilters?: boolean
  query: string
  setQuery: (value: string) => void
  activeFilterCount?: number
  gatewayOptions?: ReturnType<typeof rosterGatewayOptions>
  rowKindFilter?: RosterKindFilter
  setRowKindFilter?: (value: RosterKindFilter) => void
  activityFilter?: RosterActivityFilter
  setActivityFilter?: (value: RosterActivityFilter) => void
  gatewayFilter?: string
  setGatewayFilter?: (value: string) => void
}

/** Grok-minimal chrome: search + New… only. ⌘ / bell / filter lived here and
 *  cluttered the strip; Command Center stays on the app statusbar / ⌘K. */
export function renderRosterToolbar({
  b,
  roster,
  setCreateOpen,
  setGroupCreateOpen,
  setSectionDialog,
  showRosterSearch,
  query,
  setQuery
}: renderRosterToolbarProps) {
  return (
    <div className="flex min-w-0 items-center gap-1 px-2.5 pt-2 pb-1.5" data-slot="bots-roster-toolbar">
      {showRosterSearch ? (
        <SearchField
          aria-label={b.roster.search}
          containerClassName={cn('min-w-0 flex-1', query ? 'opacity-100!' : 'opacity-50 focus-within:opacity-100')}
          inputClassName="w-full text-[0.75rem] placeholder:text-(--ui-text-tertiary)"
          key={'roster-search'}
          onChange={setQuery}
          placeholder={b.roster.searchPlaceholder}
          value={query}
        />
      ) : (
        <span className="min-w-0 flex-1" key={'roster-search-spacer'} />
      )}
      <DropdownMenu>
        <Tip label="New…">
          <DropdownMenuTrigger asChild>
            <Button
              aria-label={b.roster.newBotOrGroup}
              className="rounded-md text-(--ui-text-tertiary) hover:text-foreground"
              size="icon-xs"
              variant="ghost"
            >
              <Codicon name="add" />
            </Button>
          </DropdownMenuTrigger>
        </Tip>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setCreateOpen(true)}>
            <Codicon className="mr-1.5" name="hubot" />
            {b.bot.newTitle}
          </DropdownMenuItem>
          <NewGroupChatItem label={b.group.newTitle} onSelect={() => setGroupCreateOpen(true)} roster={roster} />
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setSectionDialog({ mode: 'create' })}>
            <Codicon className="mr-1.5" name="new-folder" />
            {b.sections.newSection}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
