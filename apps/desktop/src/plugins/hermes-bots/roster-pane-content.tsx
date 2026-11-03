import { Button, Codicon, DisclosureCaret, GlyphSpinner, PanelEmpty, RowButton } from '@hermes/plugin-sdk'
import type { ReactNode, RefObject } from 'react'

import type { useRoster } from './data'
import { $showHiddenBots } from './hidden-bots'
import type { useBots } from './i18n'
import { PinnedGrid } from './pinned-grid'
import type { deriveRosterPresentation, deriveRosterRows } from './roster-pane-derivation'
import type { rosterSectionRenderers } from './roster-pane-sections'
import type { rosterGatewayOptions } from './roster-sections'
import type { RosterRow } from './types'

interface RosterContentProps {
  b: ReturnType<typeof useBots>
  staleNotice: string | number | null
  isLoading: boolean
  initialRosterLoading: boolean
  roster: RosterRow[]
  error: ReturnType<typeof useRoster>['error']
  gatewayUp: boolean
  refetch: ReturnType<typeof useRoster>['refetch']
  allBotsHidden: boolean
  hiddenExpanded: boolean
  pinnedBots: RosterRow[]
  rosterRows: ReturnType<typeof deriveRosterRows>['rosterRows']
  matchingHiddenBots: RosterRow[]
  query: string
  selectedGateway: ReturnType<typeof rosterGatewayOptions>[number] | undefined
  showGatewaySections: boolean
  sortedGroupRows: ReturnType<typeof deriveRosterRows>['sortedGroupRows']
  gatewaySections: ReturnType<typeof deriveRosterRows>['gatewaySections']
  showHiddenSection: boolean
  hiddenSectionRef: RefObject<HTMLDivElement | null>
  hasRosterConstraint: boolean
  hiddenBots: RosterRow[]
  showHiddenRows: boolean
  hiddenGatewaySections: ReturnType<typeof deriveRosterPresentation>['hiddenGatewaySections']
  onEditPinned: (bot: RosterRow) => void
  renderBotRow: (bot: RosterRow, keyPrefix?: string) => ReactNode
  renderGroupChatSection: ReturnType<typeof rosterSectionRenderers>['renderGroupChatSection']
  renderGatewaySection: ReturnType<typeof rosterSectionRenderers>['renderGatewaySection']
  renderUserSections: ReturnType<typeof rosterSectionRenderers>['renderUserSections']
  renderHiddenGatewaySection: ReturnType<typeof rosterSectionRenderers>['renderHiddenGatewaySection']
}

function rosterNoMatchDescription(
  b: ReturnType<typeof useBots>,
  query: string,
  selectedGateway: ReturnType<typeof rosterGatewayOptions>[number] | undefined
): string {
  const trimmed = query.trim()

  if (trimmed) {
    return selectedGateway
      ? b.roster.noMatchQueryOn(trimmed, String(selectedGateway.label))
      : b.roster.noMatchQuery(trimmed)
  }

  return selectedGateway ? b.roster.noMatchFiltersOn(String(selectedGateway.label)) : b.roster.noMatchFilters
}

function renderHiddenSection({
  b,
  hiddenExpanded,
  matchingHiddenBots,
  hiddenSectionRef,
  hasRosterConstraint,
  hiddenBots,
  showHiddenRows,
  hiddenGatewaySections,
  renderBotRow,
  renderHiddenGatewaySection
}: Pick<
  RosterContentProps,
  | 'b'
  | 'hiddenExpanded'
  | 'matchingHiddenBots'
  | 'hiddenSectionRef'
  | 'hasRosterConstraint'
  | 'hiddenBots'
  | 'showHiddenRows'
  | 'hiddenGatewaySections'
  | 'renderBotRow'
  | 'renderHiddenGatewaySection'
>) {
  return (
    <div className="mt-1 border-t border-(--ui-stroke-tertiary) pt-1" key={'hidden-section'} ref={hiddenSectionRef}>
      {hasRosterConstraint ? (
        <div className="flex w-full items-center gap-1 px-2 py-1.5 text-[0.6875rem] font-medium text-(--ui-text-tertiary)">
          <Codicon name="eye-closed" />
          <span>Hidden</span>
          <span className="text-(--ui-text-quaternary)">{matchingHiddenBots.length}</span>
        </div>
      ) : (
        <RowButton
          aria-expanded={hiddenExpanded}
          className="flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-left text-[0.6875rem] font-medium text-(--ui-text-tertiary) transition-colors hover:bg-(--chrome-action-hover) hover:text-foreground"
          onClick={() => $showHiddenBots.set(!hiddenExpanded)}
        >
          <DisclosureCaret open={hiddenExpanded} />
          <span>Hidden</span>
          <span className="text-(--ui-text-quaternary)">{hiddenBots.length}</span>
        </RowButton>
      )}
      {showHiddenRows ? (
        matchingHiddenBots.length ? (
          hiddenGatewaySections.sectioned ? (
            hiddenGatewaySections.sections.map(renderHiddenGatewaySection)
          ) : (
            matchingHiddenBots.map((bot: RosterRow) => renderBotRow(bot, 'hidden:'))
          )
        ) : (
          <div className="px-2 py-2 text-xs text-(--ui-text-quaternary)">{b.roster.noHiddenMatch}</div>
        )
      ) : null}
    </div>
  )
}

function renderRosterList({
  pinnedBots,
  onEditPinned,
  showGatewaySections,
  sortedGroupRows,
  gatewaySections,
  rosterRows,
  showHiddenSection,
  renderGroupChatSection,
  renderGatewaySection,
  renderUserSections,
  ...hidden
}: Pick<
  RosterContentProps,
  | 'pinnedBots'
  | 'onEditPinned'
  | 'showGatewaySections'
  | 'sortedGroupRows'
  | 'gatewaySections'
  | 'rosterRows'
  | 'showHiddenSection'
  | 'renderGroupChatSection'
  | 'renderGatewaySection'
  | 'renderUserSections'
  | 'b'
  | 'hiddenExpanded'
  | 'matchingHiddenBots'
  | 'hiddenSectionRef'
  | 'hasRosterConstraint'
  | 'hiddenBots'
  | 'showHiddenRows'
  | 'hiddenGatewaySections'
  | 'renderBotRow'
  | 'renderHiddenGatewaySection'
>) {
  const sections = showGatewaySections
    ? [sortedGroupRows.length ? renderGroupChatSection() : null, ...gatewaySections.sections.map(renderGatewaySection)].filter(
        Boolean
      )
    : renderUserSections(rosterRows)

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" data-slot="bots-roster">
      <PinnedGrid bots={pinnedBots} onEdit={onEditPinned} />
      <div className="grid w-full min-w-0 gap-0.5 px-1.5 pb-2">
        {sections}
        {showHiddenSection ? renderHiddenSection(hidden) : null}
      </div>
    </div>
  )
}

export function renderRosterContent(props: RosterContentProps) {
  const {
    b,
    staleNotice,
    isLoading,
    initialRosterLoading,
    roster,
    error,
    gatewayUp,
    refetch,
    allBotsHidden,
    hiddenExpanded,
    pinnedBots,
    rosterRows,
    matchingHiddenBots,
    query,
    selectedGateway
  } = props

  const loading = (isLoading || initialRosterLoading) && !roster.length
  const errored = Boolean(error && !roster.length)
  const empty = roster.length === 0
  const allHidden = allBotsHidden && !hiddenExpanded
  const noMatch = rosterRows.length === 0 && matchingHiddenBots.length === 0 && pinnedBots.length === 0

  let body: ReactNode

  if (loading) {
    body = (
      <div className="flex flex-1 items-center justify-center">
        <GlyphSpinner className="text-(--ui-text-tertiary)" spinner="breathe" />
      </div>
    )
  } else if (errored) {
    body = (
      <div className="grid gap-2 px-3 py-4 text-xs text-(--ui-text-tertiary)">
        <div>
          {gatewayUp
            ? b.roster.rosterUnavailable(error instanceof Error ? error.message : 'gateway error')
            : b.roster.waitingForGateway}
        </div>
        <Button className="justify-self-start" onClick={() => void refetch()} size="sm" variant="secondary">
          {b.roster.retryNow}
        </Button>
      </div>
    )
  } else if (empty) {
    body = <PanelEmpty description={b.roster.emptyDesc} icon="hubot" title={b.roster.emptyTitle} />
  } else if (allHidden) {
    body = (
      <div className="grid content-start gap-2 px-3 py-4 text-xs text-(--ui-text-tertiary)">
        <div className="flex items-center gap-1.5 font-medium text-(--ui-text-secondary)">
          <Codicon className="text-(--ui-text-quaternary)" name="eye-closed" />
          {b.roster.allHidden}
        </div>
        <p className="leading-relaxed">{b.roster.allHiddenDesc}</p>
        <Button
          className="justify-self-start"
          onClick={() => $showHiddenBots.set(true)}
          size="sm"
          variant="secondary"
        >
          {b.roster.showHidden}
        </Button>
      </div>
    )
  } else if (noMatch) {
    body = (
      <div aria-live="polite" className="flex min-h-0 flex-1 flex-col" role="status">
        <PanelEmpty description={rosterNoMatchDescription(b, query, selectedGateway)} icon="search" />
      </div>
    )
  } else {
    body = renderRosterList(props)
  }

  return (
    <>
      {staleNotice ? (
        <div className="mx-2.5 mb-1 rounded-md bg-(--chrome-action-hover) px-2 py-1.5 text-[0.6875rem] text-(--ui-text-tertiary)">
          {staleNotice}
        </div>
      ) : null}
      {body}
    </>
  )
}
