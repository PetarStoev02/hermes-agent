import {
  Button,
  Codicon,
  Contribute,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
  SearchField,
  Tip
} from '@hermes/plugin-sdk'
import { useEffect, useRef, useState } from 'react'

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

interface RosterPaneToolbarProps {
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

/** Search + New… on the left sidebar's traffic-light row, at the end. */
export function RosterPaneToolbar({
  b,
  roster,
  setCreateOpen,
  setGroupCreateOpen,
  setSectionDialog,
  showRosterSearch,
  query,
  setQuery
}: RosterPaneToolbarProps) {
  const [searchOpen, setSearchOpen] = useState(Boolean(query))
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const popoverOpen = searchOpen || Boolean(query)

  useEffect(() => {
    if (!popoverOpen) {
      return
    }

    const frame = requestAnimationFrame(() => searchInputRef.current?.focus())

    return () => cancelAnimationFrame(frame)
  }, [popoverOpen])

  return (
    <Contribute area="titleBar.sidebarEnd" id="hermes-bots:roster-tools" order={10}>
      <div className="flex flex-row items-center pr-1" data-slot="bots-titlebar-tools">
        {showRosterSearch ? (
          <Popover onOpenChange={setSearchOpen} open={popoverOpen}>
            <Tip label={b.roster.search}>
              <PopoverTrigger asChild>
                <Button
                  aria-label={b.roster.search}
                  className="rounded-md text-(--ui-text-tertiary) hover:text-foreground"
                  size="icon-xs"
                  type="button"
                  variant="ghost"
                >
                  <Codicon name="search" />
                </Button>
              </PopoverTrigger>
            </Tip>
            <PopoverContent align="end" className="w-56 p-2" side="bottom" sideOffset={6}>
              <SearchField
                aria-label={b.roster.search}
                inputClassName="w-full text-[0.75rem] placeholder:text-(--ui-text-tertiary)"
                inputRef={searchInputRef}
                onChange={setQuery}
                placeholder={b.roster.searchPlaceholder}
                value={query}
              />
            </PopoverContent>
          </Popover>
        ) : null}
        <DropdownMenu>
          <Tip label="New…">
            <DropdownMenuTrigger asChild>
              <Button
                aria-label={b.roster.newBotOrGroup}
                className="rounded-md text-(--ui-text-tertiary) hover:text-foreground"
                size="icon-xs"
                type="button"
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
    </Contribute>
  )
}
