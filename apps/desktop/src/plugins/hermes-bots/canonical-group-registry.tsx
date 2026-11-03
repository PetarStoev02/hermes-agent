import { atom, host, randomUuid, useValue } from '@hermes/plugin-sdk'
import { useEffect, useRef, useState } from 'react'

import { useCanonicalGroupLabels } from './canonical-group-labels'
import { dropCanonicalRosterMirror, groupMembersFromCanonicalRoom, mirrorCanonicalRoomRecord } from './canonical-group-mirror'
import { CanonicalGroupRow } from './canonical-group-row'
import { canonicalGroupRequest, captureCanonicalGroupRoute, discoverCanonicalGroups } from './canonical-groups'
import type { CanonicalGroupBinding, CanonicalGroupRoute, CanonicalRoom } from './canonical-groups'
import { closeGroupChatMainTab } from './group-panes'

export const $canonicalGroupBindings = atom<Record<string, CanonicalGroupBinding>>({})
// Bumped when a room leaves outside the list's own Refresh, so the sidebar re-reads `groups.list`.
const $canonicalGroupListRevision = atom(0)

/** Drop a disbanded room's key and every alias to it, then re-read the sidebar list. */
export function forgetCanonicalGroup({ connectionId, profile, roomId }: CanonicalGroupBinding): void {
  $canonicalGroupBindings.set(Object.fromEntries(Object.entries($canonicalGroupBindings.get()).filter(([, binding]) =>
    binding.connectionId !== connectionId || binding.profile !== profile || binding.roomId !== roomId)))
  $canonicalGroupListRevision.set($canonicalGroupListRevision.get() + 1)
}

export function registerCanonicalGroup(route: CanonicalGroupRoute, room: CanonicalRoom): string {
  const key = `canonical:${encodeURIComponent(route.connectionId)}:${encodeURIComponent(route.profile)}:${room.room_id}`
  $canonicalGroupBindings.set({ ...$canonicalGroupBindings.get(), [key]: { ...route, roomId: room.room_id, roomName: room.name } })

  return key
}

/** Where a group string entered. Room and group names are free text (hosted_rooms
 *  has no pattern), so a name can spell `canonical:<conn>:<profile>:<room>`
 *  exactly; the string alone cannot tell the two apart, the caller can.
 *  - 'key': minted by `registerCanonicalGroup`, or a persisted/restored tab
 *    string. Parsed as main always parsed it, so pre-existing keys keep opening.
 *  - 'name': a user-typed group name, a room record's name, a roster row. Never
 *    parsed: it resolves only through the alias for the current source. */
export type CanonicalGroupOrigin = 'key' | 'name'

/** The route `group` names when it is a key: null for a name, whatever its shape. */
export function canonicalGroupKeyRoute(group: string, origin: CanonicalGroupOrigin): ReturnType<typeof parseCanonicalGroupKey> {
  return origin === 'name' ? null : parseCanonicalGroupKey(group)
}

/** The route a `canonical:<connection>:<profile>:<room_id>` key was minted on, or null for a name.
 *  Format-only: callers holding a possible NAME go through `canonicalGroupKeyRoute`. */
export function parseCanonicalGroupKey(key: string): (CanonicalGroupRoute & { roomId: string }) | null {
  const match = /^canonical:([^:]*):([^:]*):(.+)$/.exec(key)

  if (!match) {return null}

  try {
    return { connectionId: decodeURIComponent(match[1]), profile: decodeURIComponent(match[2]), roomId: match[3] }
  } catch {
    return null
  }
}

/** The binding key for a group opened by name on one (connection, profile).
 *  A bare name is not an identity: two gateways can each hold a "Team", so a
 *  name resolved on one source must never answer for another. */
export function canonicalGroupAliasKey(route: CanonicalGroupRoute, group: string): string {
  return `alias:${encodeURIComponent(route.connectionId)}:${encodeURIComponent(route.profile)}:${group}`
}

/** The binding `group` opens on `route`: a `canonical:` key names its own route;
 *  a name only matches the alias published for the current source. */
export function canonicalGroupBindingFor(
  bindings: Record<string, CanonicalGroupBinding>,
  route: CanonicalGroupRoute,
  group: string,
  origin: CanonicalGroupOrigin
): CanonicalGroupBinding | undefined {
  return canonicalGroupKeyRoute(group, origin) ? bindings[group] : bindings[canonicalGroupAliasKey(route, group)]
}

/** #140805: bindings live in memory, so after a restart a group opened by name
 *  (roster row) or by a restored `canonical:` tab key misses. Look it up in the
 *  gateway's `groups.list`. Read-only: the caller publishes the result with
 *  `publishCanonicalGroup` only if its lookup is still current, so a superseded
 *  source's late answer never opens its room. Returns null only when the
 *  authority answered and holds no such room; a failed lookup THROWS, so the
 *  caller fails closed (retry, never mint). Same-name forks resolve to the most
 *  recently updated room (list order). */
export async function resolveCanonicalGroup(
  route: CanonicalGroupRoute,
  group: string,
  origin: CanonicalGroupOrigin
): Promise<{ authority: CanonicalGroupRoute; room: CanonicalRoom } | null> {
  const parsed = canonicalGroupKeyRoute(group, origin)
  const authority = parsed ? { connectionId: parsed.connectionId, profile: parsed.profile } : route
  const { rooms } = await discoverCanonicalGroups(authority)
  const room = parsed ? rooms.find(r => r.room_id === parsed.roomId) : rooms.find(r => r.name === group)

  return room ? { authority, room } : null
}

/** Publish a resolved room under its `canonical:` key and, for a name, under
 *  the alias scoped to the route it was resolved on. */
export function publishCanonicalGroup(
  route: CanonicalGroupRoute,
  group: string,
  resolved: { authority: CanonicalGroupRoute; room: CanonicalRoom },
  origin: CanonicalGroupOrigin
): void {
  const key = registerCanonicalGroup(resolved.authority, resolved.room)

  if (origin === 'key' && key === group) {return}
  const binding = { ...resolved.authority, roomId: resolved.room.room_id, roomName: resolved.room.name }
  const alias = canonicalGroupKeyRoute(group, origin) ? group : canonicalGroupAliasKey(route, group)
  $canonicalGroupBindings.set({ ...$canonicalGroupBindings.get(), [alias]: binding })
}

/** Register + name-alias + local roster mirror so the room files into folders
 *  as a GroupRow peer. */
export function mirrorCanonicalRoom(route: CanonicalGroupRoute, room: CanonicalRoom): string {
  const key = registerCanonicalGroup(route, room)
  publishCanonicalGroup(route, room.name, { authority: route, room }, 'name')
  mirrorCanonicalRoomRecord(route, room)

  return key
}

/** After `groups.rename`: re-key the folder GroupRow, swap the name alias, and
 *  bump discovery so every surface converges on the new display name. */
export function remirrorCanonicalRoomRename(
  route: CanonicalGroupRoute,
  room: CanonicalRoom,
  previousName?: string
): string {
  const prior = previousName && previousName !== room.name ? previousName : undefined
  const key = mirrorCanonicalRoom(route, room)

  if (prior) {
    const oldAlias = canonicalGroupAliasKey(route, prior)
    const bindings = { ...$canonicalGroupBindings.get() }
    delete bindings[oldAlias]
    $canonicalGroupBindings.set(bindings)
  }

  $canonicalGroupListRevision.set($canonicalGroupListRevision.get() + 1)

  return key
}

/** Every view string showing this room: its `canonical:` keys, and the name a
 *  name-opened tab and selection are recorded under (from its route-scoped alias). */
function canonicalGroupViews({ connectionId, profile, roomId }: CanonicalGroupBinding): Set<string> {
  const aliasPrefix = canonicalGroupAliasKey({ connectionId, profile }, '')
  const views = new Set<string>()

  for (const [key, binding] of Object.entries($canonicalGroupBindings.get())) {
    if (binding.connectionId === connectionId && binding.profile === profile && binding.roomId === roomId) {
      views.add(key.startsWith(aliasPrefix) ? key.slice(aliasPrefix.length) : key)
    }
  }

  return views
}

interface ListedRoom {
  binding: CanonicalGroupBinding
  key: string
  members: ReturnType<typeof groupMembersFromCanonicalRoom>
  name: string
}

/** Disband on the room's own gateway, then retire it everywhere this window shows it.
 *  A refusal rejects before anything is dropped, so the row stays and the confirm shows why. */
async function disbandListedRoom(room: ListedRoom, doneMessage: string): Promise<void> {
  await canonicalGroupRequest(room.binding, 'groups.disband', { room_id: room.binding.roomId, cancel_id: randomUuid() })
  // Collect before forgetting: the bindings are the only record of which views alias this room.
  canonicalGroupViews(room.binding).add(room.key).forEach(closeGroupChatMainTab)
  dropCanonicalRosterMirror(room.binding.roomId, room.name)
  forgetCanonicalGroup(room.binding)
  host.notify({ kind: 'success', message: doneMessage })
}

/** Discover gateway rooms, seat each as a folder GroupRow via `$groupChats`,
 *  and prune mirrors for rooms that left the list on this route. */
function useCanonicalGroupDiscovery(onRooms?: (rooms: ListedRoom[]) => void): void {
  const connectionId = useValue(host.state.connectionId)
  const profile = useValue(host.state.profile)
  const revision = useValue($canonicalGroupListRevision)
  const onRoomsRef = useRef(onRooms)
  onRoomsRef.current = onRooms

  useEffect(() => {
    let cancelled = false
    onRoomsRef.current?.([])
    void (async () => {
      const route = captureCanonicalGroupRoute()
      const result = await discoverCanonicalGroups(route)

      if (cancelled) {return}

      const listed: ListedRoom[] = result.rooms.map(room => {
        const key = mirrorCanonicalRoom(route, room)

        return {
          binding: { ...route, roomId: room.room_id, roomName: room.name },
          key,
          members: groupMembersFromCanonicalRoom(route, room),
          name: room.name
        }
      })

      // Rooms that left this gateway's list: drop their local mirrors + bindings
      // so a disband on another surface doesn't leave a stale GroupRow behind.
      const listedIds = new Set(listed.map(room => room.binding.roomId))
      let pruned = false

      for (const binding of Object.values($canonicalGroupBindings.get())) {
        if (binding.connectionId !== route.connectionId || binding.profile !== route.profile) {
          continue
        }

        if (listedIds.has(binding.roomId) || !binding.roomName) {
          continue
        }

        pruned = true
        dropCanonicalRosterMirror(binding.roomId, binding.roomName)
      }

      if (pruned) {
        // Drop every key/alias for rooms no longer listed on this route —
        // without bumping the revision (we are already the discoverer).
        $canonicalGroupBindings.set(Object.fromEntries(
          Object.entries($canonicalGroupBindings.get()).filter(([, binding]) =>
            binding.connectionId !== route.connectionId
            || binding.profile !== route.profile
            || listedIds.has(binding.roomId)
          )
        ))
      }

      onRoomsRef.current?.(listed)
    })().catch(() => {
      // Quiet: gateway health already lives in the statusbar. Do not paint a
      // "Refresh gateway groups" / error strip above the roster.
      if (!cancelled) {onRoomsRef.current?.([])}
    })

    return () => { cancelled = true }
  }, [connectionId, profile, revision])
}

/** Headless: seats gateway rooms into the folder roster. Mount once in the pane. */
export function CanonicalGroupRosterSync() {
  useCanonicalGroupDiscovery()

  return null
}

/** Standalone list (tests / rare surfaces): Grok-style rows that also mirror
 *  into `$groupChats`. The Bots pane uses `CanonicalGroupRosterSync` instead
 *  so rooms appear once — as folder peers, not a strip above Unassigned. */
export function CanonicalGroupList({ onOpen }: { onOpen: (key: string, origin: CanonicalGroupOrigin) => void }) {
  const labels = useCanonicalGroupLabels()
  const [rooms, setRooms] = useState<ListedRoom[]>([])
  useCanonicalGroupDiscovery(setRooms)

  // Rooms only — no always-on refresh chrome when empty or offline.
  if (rooms.length === 0) {return null}

  return <div className="grid gap-1 px-2 pb-1" data-slot="canonical-group-list">
    {rooms.map(room => <CanonicalGroupRow key={room.key} members={room.members} name={room.name}
      onDelete={() => disbandListedRoom(room, labels.disbanded(room.name))} onOpen={() => onOpen(room.key, 'key')} />)}
  </div>
}
