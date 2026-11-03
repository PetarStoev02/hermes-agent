/**
 * Seat a gateway Group Chat in the same `$groupChats` roster the folder
 * GroupRows already read — member cluster, preview, Move to… — without a
 * separate strip above the folders. Bindings stay the authority for open /
 * disband; the room record is the local filing + display cache.
 *
 * Deliberately does not import `canonical-group-registry` (that module calls
 * into here): callers pass the already-registered key / publish the alias.
 */

import type { CanonicalGroupRoute, CanonicalRoom } from './canonical-groups'
import { $groupChats, $groupChatWorkspace, updateGroupChat } from './group-chat'
import type { GroupMember } from './types'

/** Map hosted_rooms members onto the descriptor shape GroupAvatarCluster seats. */
export function groupMembersFromCanonicalRoom(
  route: CanonicalGroupRoute,
  room: CanonicalRoom
): GroupMember[] {
  return (room.members || []).map(member => ({
    name: member.profile,
    handle: member.handle || member.profile,
    ...(member.display_name ? { display_name: member.display_name } : {}),
    connectionId: route.connectionId,
    targetProfile: member.profile,
    route: {
      connectionId: route.connectionId,
      mode: (route.connectionId === 'local' ? 'local' : 'remote') as 'local' | 'remote',
      profile: route.profile,
      targetProfile: member.profile
    }
  }))
}

/** Local `$groupChats` key currently mirroring this gateway room id, if any. */
export function localNameForCanonicalRoomId(roomId: string): string | undefined {
  for (const [name, record] of Object.entries($groupChats.get())) {
    if (!record?.tombstone && record.roomId === roomId) {
      return name
    }
  }

  return undefined
}

/**
 * Write / refresh the local room record so `groupChatNames` / GroupRow pick
 * the gateway room up. Preserves sectionId, pin, log and rosterOrder; refuses
 * to clobber a different local room that already owns the display name.
 * When the gateway renames the room, re-keys the existing local record so the
 * sidebar label follows instead of leaving a stale member-list name behind.
 * Caller registers the binding + name alias first.
 */
export function mirrorCanonicalRoomRecord(route: CanonicalGroupRoute, room: CanonicalRoom): void {
  const members = groupMembersFromCanonicalRoom(route, room)
  const previousName = localNameForCanonicalRoomId(room.room_id)

  if (previousName && previousName !== room.name) {
    const rooms = $groupChats.get()
    const current = rooms[previousName]
    const taken = rooms[room.name]

    // A different local room already owns the new display name — leave both
    // alone; the canonical room stays reachable via its binding key.
    if (taken && !taken.tombstone && taken.roomId && taken.roomId !== room.room_id) {
      return
    }

    if (current && !current.tombstone) {
      const next = { ...rooms }
      delete next[previousName]
      next[room.name] = {
        ...current,
        roomId: room.room_id,
        members: members.length ? members : current.members || []
      }
      $groupChats.set(next)

      if ($groupChatWorkspace.get() === previousName) {
        $groupChatWorkspace.set(room.name)
      }

      // Persist the re-keyed map without a second identity write.
      updateGroupChat(room.name, record => record, { sync: false })

      return
    }
  }

  updateGroupChat(
    room.name,
    current => {
      if (current.tombstone) {
        return current
      }

      // A Desktop-local room already under this name with a different id —
      // leave it alone; the canonical room stays reachable via its key.
      if (current.roomId && current.roomId !== room.room_id) {
        return current
      }

      return {
        ...current,
        roomId: room.room_id,
        members: members.length ? members : current.members || []
      }
    },
    { sync: false }
  )
}

/** Drop the local roster mirror for a gateway room (layout + display only). */
export function dropCanonicalRosterMirror(roomId: string, name: string): void {
  const rooms = $groupChats.get()
  const room = rooms[name]

  if (!room || room.roomId !== roomId || room.tombstone) {
    return
  }

  const next = { ...rooms }
  delete next[name]
  $groupChats.set(next)
}
