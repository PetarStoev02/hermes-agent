/**
 * Right-side bot details panel (replaces Edit Profile dialog). Hero + tabs
 * Details / Look / Capabilities / Soul. Opens from the name pill or an
 * Edit-profile menu action; never from a background event.
 */

import {
  Button,
  cn,
  Codicon,
  host,
  Input,
  queryClient,
  Textarea,
  useI18n,
  useValue
} from '@hermes/plugin-sdk'
import { useState } from 'react'

import { avatarColor, botAppearance, BotFace } from './avatar'
import { AvatarPicker } from './avatar-picker'
import { BotDetailsRoutines } from './bot-details-routines'
import { $botChatFocused, $focusedBotOwner, $selectedRosterKey, focusedRosterOwner } from './bot-state'
import { $botMeta, $lastRoster, botRosterKey, isActiveRosterBot, ROSTER_KEY, saveBotMeta } from './data'
import {
  $botDetailsOpen,
  $botDetailsTab,
  $botDetailsTargetKey,
  type BotDetailsTab,
  closeBotDetails,
  setBotDetailsTab
} from './details-panel-state'
import { labeled } from './dialog-parts'
import { editedLook, type EditProfileLook } from './edit-profile-look'
import { useBots } from './i18n'
import { displayName } from './labels'
import { AdvancedProfileConfig, applyAdvancedConfig, emptyAdvancedState } from './profile-config'
import { botRosterMeta, requestForBot } from './routing'
import type { AvatarAppearance, RosterRow } from './types'

const TABS: { id: BotDetailsTab; label: (b: ReturnType<typeof useBots>) => string }[] = [
  { id: 'details', label: b => b.detailsPanel.details },
  { id: 'look', label: b => b.detailsPanel.look },
  { id: 'capabilities', label: b => b.detailsPanel.capabilities },
  { id: 'soul', label: b => b.detailsPanel.soul }
]

function resolvePanelBot(
  roster: RosterRow[],
  targetKey: null | string,
  selectedKey: null | string,
  focusedOwner: ReturnType<typeof focusedRosterOwner>,
  chatFocused: boolean
): null | RosterRow {
  if (targetKey) {
    return roster.find(row => botRosterKey(row) === targetKey) || null
  }

  if (chatFocused && focusedOwner) {
    const focused = roster.find(row => isActiveRosterBot(row, focusedOwner))

    if (focused) {
      return focused
    }
  }

  return selectedKey ? roster.find(row => botRosterKey(row) === selectedKey) || null : null
}

export function BotDetailsPanel() {
  const open = useValue($botDetailsOpen)
  const tab = useValue($botDetailsTab)
  const targetKey = useValue($botDetailsTargetKey)
  const roster = useValue($lastRoster)
  const selectedKey = useValue($selectedRosterKey)
  const focusedOwner = focusedRosterOwner(useValue($focusedBotOwner))
  const chatFocused = useValue($botChatFocused)
  const bot = resolvePanelBot(roster, targetKey, selectedKey, focusedOwner, chatFocused)

  if (!open || !bot) {
    return null
  }

  return <BotDetailsPanelBody bot={bot} key={botRosterKey(bot)} tab={tab} />
}

function BotDetailsPanelBody({ bot, tab }: { bot: RosterRow; tab: BotDetailsTab }) {
  const { t } = useI18n()
  const b = useBots()
  const metaAll = useValue($botMeta)
  const meta = botRosterMeta(bot, metaAll)
  const appearance: AvatarAppearance = botAppearance(bot.name, meta)
  const openingTitle = meta?.title || bot.title || ''

  const opening: EditProfileLook = {
    shape: appearance.shape,
    color: appearance.color,
    image: appearance.image ?? null,
    title: openingTitle
  }

  const [shape, setShape] = useState(appearance.shape)
  const [color, setColor] = useState<null | string>(appearance.color)
  const [image, setImage] = useState<null | string>(appearance.image ?? null)
  const [opened, setOpened] = useState(opening)
  const [title, setTitle] = useState(openingTitle)
  const [description, setDescription] = useState(bot.description || '')
  const [busy, setBusy] = useState(false)
  const [adv, setAdv] = useState(emptyAdvancedState())

  // Re-seed when the bot identity changes (keyed remount covers most cases;
  // this catches meta hydration on the same key).
  const [seedKey, setSeedKey] = useState(botRosterKey(bot))
  const currentKey = botRosterKey(bot)

  if (currentKey !== seedKey) {
    setSeedKey(currentKey)
    setShape(appearance.shape)
    setColor(appearance.color)
    setImage(appearance.image ?? null)
    setTitle(openingTitle)
    setOpened(opening)
    setDescription(bot.description || '')
    setBusy(false)
    setAdv(emptyAdvancedState())
  }

  const label = displayName(bot, { title })
  const profileHint = bot.name

  const submit = async () => {
    if (busy) {
      return
    }

    setBusy(true)
    let advancedFailed = false

    const look = editedLook(opened, { shape, color, image, title })
    const persistence = look ? await saveBotMeta(bot, look) : null
    const lookFailed = persistence?.serverOutcome === 'failed'

    if (lookFailed) {
      host.notify({ kind: 'error', message: b.avatar.savedLocally })
    }

    if (persistence?.serverOutcome === 'persisted') {
      queryClient.invalidateQueries({ queryKey: ROSTER_KEY })
    }

    const desc = description.trim()

    if (desc !== (bot.description || '').trim()) {
      try {
        await requestForBot(bot, 'cli.exec', {
          argv: ['profile', 'describe', bot.name, '--text', desc]
        })
        queryClient.invalidateQueries({ queryKey: ROSTER_KEY })
      } catch (err) {
        host.notifyError(err, b.avatar.savedLocallyDescriptionFailed)
      }
    }

    if (adv.loaded && (adv.dirtyModel || adv.dirtySoul || adv.dirtySkills || adv.dirtyToolsets || adv.dirtyMcp)) {
      try {
        const res = await applyAdvancedConfig(bot, adv)
        const failed = Object.entries(res?.applied || {}).filter(([, ok]) => !ok)

        if (failed.length) {
          advancedFailed = true
          host.notify({
            kind: 'error',
            message: b.editor.sectionsFailed(failed.map(([k]) => k).join(', '))
          })
        }
      } catch (err) {
        advancedFailed = true
        host.notifyError(err, b.bot.advancedFailed)
      }
    }

    if (!advancedFailed && !lookFailed) {
      host.notify({ kind: 'success', message: b.editor.updated(label) })
    }

    setBusy(false)
    closeBotDetails()
  }

  return (
    <aside
      aria-label={b.bot.editTitle}
      className={cn(
        'pointer-events-auto absolute inset-y-0 right-0 z-30 flex w-[min(22rem,100%)] flex-col',
        'border-l border-(--ui-stroke-secondary) bg-(--ui-widget-surface-background) shadow-nous'
      )}
      data-slot="bot-details-panel"
    >
      <div className="flex items-center justify-end gap-1 px-2 pt-2">
        <Button
          aria-label={t.common.close}
          disabled={busy}
          onClick={() => closeBotDetails()}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <Codicon name="close" />
        </Button>
      </div>

      <div className="flex flex-col items-center gap-1 px-4 pb-3">
        <BotFace color={avatarColor(color, bot.name)} image={image} name={bot.name} shape={shape} size={64} />
        <div className="text-sm font-semibold text-(--ui-text-primary)">{label}</div>
        <div className="font-mono text-[0.65rem] text-(--ui-text-quaternary)">{profileHint}</div>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-(--ui-stroke-secondary) px-2">
        {TABS.map(entry => (
          <button
            className={cn(
              'shrink-0 px-2.5 py-1.5 text-[0.75rem] font-medium transition-colors',
              tab === entry.id
                ? 'border-b-2 border-(--ui-text-primary) text-(--ui-text-primary)'
                : 'text-(--ui-text-tertiary) hover:text-(--ui-text-secondary)'
            )}
            key={entry.id}
            onClick={() => setBotDetailsTab(entry.id)}
            type="button"
          >
            {entry.label(b)}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
        {tab === 'details' ? (
          <div className="grid gap-4">
            {labeled(
              b.editor.title,
              <Input
                onChange={event => setTitle(event.target.value)}
                placeholder={displayName(bot, null)}
                value={title}
              />
            )}
            {labeled(
              b.editor.description,
              <Textarea
                className="min-h-16"
                onChange={event => setDescription(event.target.value)}
                placeholder={b.bot.helpPromptPlaceholder}
                value={description}
              />
            )}
            <AdvancedProfileConfig
              bot={bot}
              sections={{ capabilities: false, model: true, soul: false }}
              setState={setAdv}
              state={adv}
            />
            <BotDetailsRoutines bot={bot} />
          </div>
        ) : null}

        {tab === 'look' ? (
          <AvatarPicker
            color={color}
            generateSeed={{ name: bot.name, title, description }}
            image={image}
            onColor={setColor}
            onImage={setImage}
            onShape={setShape}
            shape={shape}
          />
        ) : null}

        {tab === 'capabilities' ? (
          <AdvancedProfileConfig
            bot={bot}
            sections={{ capabilities: true, model: false, soul: false }}
            setState={setAdv}
            state={adv}
          />
        ) : null}

        {tab === 'soul' ? (
          <AdvancedProfileConfig
            bot={bot}
            sections={{ capabilities: false, model: false, soul: true }}
            setState={setAdv}
            state={adv}
          />
        ) : null}
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-(--ui-stroke-secondary) px-4 py-2.5">
        <Button disabled={busy} onClick={() => closeBotDetails()} type="button" variant="ghost">
          {t.common.cancel}
        </Button>
        <Button disabled={busy} onClick={() => void submit()} type="button">
          {busy ? t.common.saving : t.common.save}
        </Button>
      </div>
    </aside>
  )
}
