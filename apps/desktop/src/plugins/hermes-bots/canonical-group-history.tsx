import * as sdk from '@hermes/plugin-sdk'
import { useEffect, useRef, useState } from 'react'

import { avatarColor, botAppearance, BotFace } from './avatar'
import { type CanonicalGroupAttachment, CanonicalGroupAttachments, fetchCanonicalGroupAttachment } from './canonical-group-attachments'
import { useCanonicalGroupLabels } from './canonical-group-labels'
import type { CanonicalGroupBinding, CanonicalRoomMember } from './canonical-groups'

const MessageTextContent = typeof sdk === 'undefined' ? undefined : sdk.MessageTextContent
const Streamdown = typeof sdk === 'undefined' ? undefined : sdk.Streamdown

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ')
}

export interface CanonicalGroupEvent {
  seq: number
  event_id?: string
  room_id?: string
  kind: string
  payload: { text?: string; content?: string; attachments?: CanonicalGroupAttachment[]; member_id?: string; error?: string; reason?: string; reason_code?: string; status?: string }
  actor?: { kind?: string; id?: string; display_name?: string }
  created_at?: number
}

interface CanonicalGroupHistoryProps {
  binding: CanonicalGroupBinding
  events: CanonicalGroupEvent[]
  members?: CanonicalRoomMember[]
  disabled?: boolean
}

function eventAuthor(event: CanonicalGroupEvent, roster: Map<string, CanonicalRoomMember>, isMessage: boolean) {
  const memberId = isMessage
    ? event.actor?.kind === 'member' ? event.actor.id : undefined
    : event.payload.member_id

  const member = roster.get(memberId ?? '')

  // The log's label preserves who spoke even if the roster has since changed.
  return (isMessage ? event.actor?.display_name : undefined) || member?.display_name || member?.handle ||
    (isMessage ? event.actor?.id : memberId)
}

function eventMember(event: CanonicalGroupEvent, roster: Map<string, CanonicalRoomMember>): CanonicalRoomMember | undefined {
  const memberId = event.actor?.kind === 'member' ? event.actor.id : event.payload.member_id

  return roster.get(memberId ?? '')
}

function EventTime({ timestamp }: { timestamp?: number }) {
  if (typeof timestamp !== 'number') {return null}
  const at = new Date(timestamp * 1000)

  if (!Number.isFinite(at.getTime())) {return null}

  return <time className="text-[0.625rem] text-(--ui-text-quaternary)" dateTime={at.toISOString()}>{sdk.relativeTime(at.getTime())}</time>
}

function EventBody({ event, notice }: { event: CanonicalGroupEvent; notice?: string }) {
  if (notice) {
    // Failures carry a human error/reason. Activity codes like silent_round are
    // already mapped into `notice` — never append the raw code after it.
    const detail = event.payload.error || event.payload.reason

    return <p className="text-xs text-(--ui-text-secondary)" data-selectable-text="true">
      <strong>{notice}</strong>{detail && detail !== notice && !notice.includes(detail) ? <>: {detail}</> : null}
    </p>
  }

  const text = event.payload.text || event.payload.content || ''

  return <div className="min-w-0 text-[length:var(--conversation-text-font-size,0.875rem)] leading-(--dt-line-height,1.45) [&_p]:mb-1 [&_p:last-child]:mb-0 [&_ul]:mb-1 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:mb-1 [&_ol]:list-decimal [&_ol]:pl-4 [&_pre]:whitespace-pre-wrap [&_pre]:wrap-anywhere" data-selectable-text="true">
    {/* The shared renderer (layout and large-message safeguards). media={false}: room text
        may come from another machine, so its MEDIA: paths never resolve against this gateway;
        room files keep their own download path below. */}
    {MessageTextContent ? <MessageTextContent media={false} text={text} />
      : Streamdown ? <Streamdown>{text}</Streamdown> : text}
  </div>
}

// Previews download the whole file over RPC; larger or unsized images keep only Download.
const IMAGE_PREVIEW_MAX_BYTES = 5 * 1024 * 1024

// Automatic previews share a small download budget per connection, in request order; a file already
// downloading is joined rather than requested again. Manual Download stays outside it. The budget is
// per connection because a remote whose dial hangs holds its slots for good, and must not stall others.
type Preview = Awaited<ReturnType<typeof fetchCanonicalGroupAttachment>>
interface PreviewQueue { slots: number; waiters: Array<() => void> }
const previewDownloads = new Map<string, Promise<Preview>>()
const previewQueues = new Map<string, PreviewQueue>()

function releasePreviewSlot(queue: PreviewQueue) {
  const next = queue.waiters.shift()

  if (next) {next()} else {queue.slots++}
}

function queuePreview(connectionId: string, key: string, fetch: () => Promise<Preview>, onPreview: (preview: Preview) => void) {
  const queue = previewQueues.get(connectionId) ?? { slots: 2, waiters: [] }
  previewQueues.set(connectionId, queue)
  let cancelled = false
  const deliver = (download: Promise<Preview>) => void download.then(preview => { if (!cancelled) {onPreview(preview)} }, () => undefined)

  const run = () => {
    let download = previewDownloads.get(key)

    if (download) {releasePreviewSlot(queue)} else {
      download = fetch().finally(() => { previewDownloads.delete(key); releasePreviewSlot(queue) })
      previewDownloads.set(key, download)
    }

    deliver(download)
  }

  const running = previewDownloads.get(key)

  if (running) {deliver(running)} else if (queue.slots > 0) {queue.slots--; run()} else {queue.waiters.push(run)}

  // A preview that leaves before its turn gives up its place without sending a request.
  return () => {
    cancelled = true
    const at = queue.waiters.indexOf(run)

    if (at >= 0) {queue.waiters.splice(at, 1)}
  }
}

function ImagePreview({ binding, eventId, attachment, disabled }: {
  binding: CanonicalGroupBinding; eventId: string; attachment: CanonicalGroupAttachment; disabled: boolean
}) {
  const [src, setSrc] = useState('')
  const [near, setNear] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const { attachment_id: attachmentId, size } = attachment
  const { connectionId, profile, roomId } = binding
  const previewable = !!attachmentId && size !== undefined && size <= IMAGE_PREVIEW_MAX_BYTES

  // History loads the whole room: fetch only near the viewport. Leaving before its turn gives up the queued place;
  // a started download runs to completion and is shared if the preview returns.
  useEffect(() => {
    const el = box.current

    if (src || disabled || !el) {return}
    const observer = new IntersectionObserver(entries => setNear(entries[entries.length - 1].isIntersecting), { rootMargin: '200px' })
    observer.observe(el)

    return () => observer.disconnect()
  }, [src, disabled])

  useEffect(() => {
    if (disabled || !near || !attachmentId || !previewable) {return}
    let url = ''
    const key = JSON.stringify([connectionId, profile, roomId, eventId, attachmentId])

    // A failed preview leaves the Download button as the way to the file.
    const cancel = queuePreview(connectionId, key, () => fetchCanonicalGroupAttachment({ connectionId, profile, roomId }, eventId, attachmentId), ({ bytes, mime }) => {
      url = URL.createObjectURL(new Blob([bytes], { type: mime }))
      setSrc(url)
    })

    // Dropping `near` makes a re-shown room wait on the observer again, not refetch every preview seen so far at once.
    return () => { cancel(); URL.revokeObjectURL(url); setSrc(''); setNear(false) }
  }, [connectionId, profile, roomId, eventId, attachmentId, disabled, near, previewable])

  return previewable ? <div ref={box}>{src && <img alt={attachment.name} className="max-h-64 max-w-full rounded object-contain" src={src} />}</div> : null
}

export function CanonicalGroupHistory({ binding, events, members = [], disabled = false }: CanonicalGroupHistoryProps) {
  const labels = useCanonicalGroupLabels()
  const roster = new Map(members.map(member => [member.member_id, member]))

  const notices = new Map([
    ['turn.failed', labels.turnFailed],
    ['turn.cancelled', labels.turnCancelled],
    ['turn.deferred', labels.turnDeferred],
    ['member.unavailable', labels.memberUnavailable],
    ['room.stop_requested', labels.roomStopped],
    ['room.disbanded', labels.roomDisbanded],
    ['authority.lost', labels.authorityLost]
  ])

  return <>{events.map(event => {
    // Bounded (max_rounds / max_messages) is a quiet driver stop — a new user
    // send starts a fresh discussion. Do not paint a "work limit" banner for it.
    if (event.kind === 'room.activity' && event.payload.status === 'bounded') {return null}

    const silentRound = event.kind === 'room.activity' && event.payload.status === 'settled' &&
      event.payload.reason_code === 'silent_round'

    const notice = silentRound ? labels.silentRound : notices.get(event.kind)

    const isMessage = event.kind === 'message' || event.kind === 'message.user' || event.kind === 'message.member'

    if (!notice && !isMessage) {return null}
    const isUser = isMessage && (event.kind === 'message.user' || event.actor?.kind === 'user')
    const author = isUser ? labels.you : eventAuthor(event, roster, isMessage)
    const member = !isUser && isMessage ? eventMember(event, roster) : undefined
    const faceName = member?.profile || member?.handle || author || 'agent'
    const appearance = !isUser && isMessage ? botAppearance(faceName, null) : null
    const previewEventId = event.room_id === binding.roomId ? event.event_id : undefined

    if (notice) {
      return <div className="flex justify-center px-3 py-2" key={event.seq}>
        <div className="max-w-[min(100%,28rem)] rounded-full bg-(--ui-bg-tertiary) px-3 py-1 text-center text-[0.7rem] text-(--ui-text-secondary)">
          <EventBody event={event} notice={notice} />
        </div>
      </div>
    }

    return <div
      className={cn('flex w-full gap-2 px-2 py-1.5', isUser ? 'justify-end' : 'justify-start')}
      key={event.seq}
    >
      {appearance ? (
        <div className="mt-0.5 shrink-0">
          <BotFace
            color={avatarColor(appearance.color, faceName)}
            image={null}
            name={faceName}
            shape={appearance.shape}
            size={24}
          />
        </div>
      ) : null}
      <div className={cn('flex min-w-0 max-w-[min(92%,32rem)] flex-col gap-1', isUser && 'items-end')}>
        <div className={cn('flex items-center gap-2', isUser && 'flex-row-reverse')}>
          {author && <strong className={cn('text-[0.7rem] font-semibold', isUser ? 'text-foreground' : 'text-(--ui-accent)')}>{author}</strong>}
          <EventTime timestamp={event.created_at} />
        </div>
        <div
          className={cn(
            isUser
              ? 'bot-mode-user-bubble composer-human-message rounded-[1.25rem] px-3.5 py-2 text-[color:var(--background)]'
              : 'bot-mode-assistant-bubble rounded-[1.125rem] px-3.5 py-2'
          )}
          data-slot={isUser ? undefined : 'bot-assistant-bubble'}
        >
          <EventBody event={event} />
          {previewEventId && event.payload.attachments?.filter(a => a.kind === 'image').map(a =>
            <ImagePreview attachment={a} binding={binding} disabled={disabled} eventId={previewEventId} key={a.attachment_id ?? a.name} />)}
          {!!event.payload.attachments?.length && <CanonicalGroupAttachments
            attachments={event.payload.attachments.map(attachment => ({ ...attachment, event_id: event.event_id }))}
            binding={binding} disabled={disabled || !event.event_id || event.room_id !== binding.roomId} readOnly />}
        </div>
      </div>
    </div>
  })}</>
}
