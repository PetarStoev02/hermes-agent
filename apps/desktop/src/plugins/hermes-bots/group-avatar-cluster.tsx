/**
 * Grok-style group avatar: up to four member faces in a tight 2×2 cluster.
 * Custom room art still wins when the room has an `image`.
 */

import { cn, Codicon, useValue } from '@hermes/plugin-sdk'

import { avatarColor, botAppearance, BotFace } from './avatar'
import { isBackfilledFacePng } from './avatar-image'
import { $botMeta } from './data'
import { botRosterMeta } from './routing'
import type { GroupMember } from './types'

const SLOT: Array<{ bottom?: number; left?: number; right?: number; top?: number }> = [
  { left: 0, top: 0 },
  { right: 0, top: 0 },
  { bottom: 0, left: 0 },
  { bottom: 0, right: 0 }
]

interface GroupAvatarClusterProps {
  className?: string
  dimmed?: boolean
  image?: null | string
  members: GroupMember[]
  /** Outer edge length in CSS pixels (matches a bot row lead). */
  size?: number
}

export function GroupAvatarCluster({
  className,
  dimmed = false,
  image,
  members,
  size = 32
}: GroupAvatarClusterProps) {
  const allMeta = useValue($botMeta)

  if (image) {
    return (
      <img
        alt=""
        className={cn(
          'rounded-md object-cover ring-1 ring-(--ui-stroke-tertiary)',
          dimmed && 'opacity-60 grayscale',
          className
        )}
        height={size}
        src={image}
        style={{ height: size, width: size }}
        width={size}
      />
    )
  }

  const faces = members.filter(member => Boolean(member?.name)).slice(0, 4)

  if (faces.length === 0) {
    return (
      <span
        className={cn(
          'flex items-center justify-center rounded-md bg-(--chrome-action-hover) text-(--ui-text-tertiary)',
          dimmed && 'opacity-60',
          className
        )}
        style={{ height: size, width: size }}
      >
        <Codicon name="organization" />
      </span>
    )
  }

  if (faces.length === 1) {
    const member = faces[0]!
    const meta = botRosterMeta(member as never, allMeta)
    const { shape, color, image: faceImage } = botAppearance(member.name, meta)
    const photo = Boolean(faceImage && !isBackfilledFacePng(faceImage))

    return (
      <span className={cn(dimmed && 'opacity-60', className)} style={{ height: size, width: size }}>
        <BotFace
          color={avatarColor(color, member.name)}
          image={photo ? faceImage : null}
          name={member.name}
          shape={shape}
          size={size}
        />
      </span>
    )
  }

  // Two members: diagonal (TL + BR) reads as a pair. Three+: fill the 2×2.
  const slots =
    faces.length === 2
      ? [
          { member: faces[0]!, style: SLOT[0]! },
          { member: faces[1]!, style: SLOT[3]! }
        ]
      : faces.map((member, index) => ({ member, style: SLOT[index]! }))

  const faceSize = Math.max(14, Math.round(size * 0.58))

  return (
    <div
      aria-hidden
      className={cn('relative shrink-0', dimmed && 'opacity-60', className)}
      data-slot="bots-group-avatar"
      style={{ height: size, width: size }}
    >
      {slots.map(({ member, style }) => {
        const meta = botRosterMeta(member as never, allMeta)
        const { shape, color, image: faceImage } = botAppearance(member.name, meta)
        const photo = Boolean(faceImage && !isBackfilledFacePng(faceImage))

        return (
          <span
            className="absolute overflow-hidden rounded-full bg-(--ui-bg-chrome) ring-2 ring-(--ui-bg-chrome)"
            key={`${member.connectionId || 'local'}::${member.name}`}
            style={{ ...style, height: faceSize, width: faceSize }}
          >
            <BotFace
              color={avatarColor(color, member.name)}
              image={photo ? faceImage : null}
              name={member.name}
              shape={shape}
              size={faceSize}
            />
          </span>
        )
      })}
    </div>
  )
}
