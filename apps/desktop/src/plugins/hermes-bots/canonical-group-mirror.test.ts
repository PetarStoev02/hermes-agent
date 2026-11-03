import { beforeEach, expect, it } from 'vitest'

import { $canonicalGroupBindings, mirrorCanonicalRoom } from './canonical-group-registry'
import { $groupChats } from './group-chat'
import { groupChatNames } from './group-membership'
import { groupChatSectionId, moveGroupChatsToSection } from './user-sections'
import { $botSections } from './user-sections'

const route = { connectionId: 'local', profile: 'default' }

const room = {
  room_id: 'agro-1',
  name: 'Agro Ops team',
  members: [
    { member_id: 'a', profile: 'agro-ops-cto', handle: 'agro-ops-cto' },
    { member_id: 'b', profile: 'agro-ops-cfo', handle: 'agro-ops-cfo' },
    { member_id: 'c', profile: 'agro-ops-lead', handle: 'agro-ops-lead' }
  ]
}

beforeEach(() => {
  $canonicalGroupBindings.set({})
  $groupChats.set({})
  $botSections.set([])
})

it('seats a gateway room into $groupChats so the folder roster lists it with members', () => {
  const key = mirrorCanonicalRoom(route, room)

  expect(key).toMatch(/^canonical:/)
  expect($groupChats.get()['Agro Ops team']).toMatchObject({
    roomId: 'agro-1',
    members: expect.arrayContaining([
      expect.objectContaining({ name: 'agro-ops-cto' }),
      expect.objectContaining({ name: 'agro-ops-cfo' }),
      expect.objectContaining({ name: 'agro-ops-lead' })
    ])
  })
  expect(groupChatNames({}, $groupChats.get())).toContain('Agro Ops team')
  expect($canonicalGroupBindings.get()[`alias:local:default:Agro Ops team`]).toMatchObject({
    roomId: 'agro-1'
  })
})

it('files a mirrored gateway room into a user section like a Desktop group', () => {
  mirrorCanonicalRoom(route, room)
  $botSections.set([{ id: 'sec-team', name: 'Team' }])
  moveGroupChatsToSection(['Agro Ops team'], 'sec-team')

  expect(groupChatSectionId('Agro Ops team', $groupChats.get())).toBe('sec-team')
})

it('does not clobber a different local room that already owns the display name', () => {
  $groupChats.set({
    'Agro Ops team': {
      log: [{ id: '1', at: 1, text: 'local', from: { kind: 'user', name: 'you' } }],
      watermarks: {},
      roomId: 'local-room',
      members: [{ name: 'local-bot' }]
    }
  })
  mirrorCanonicalRoom(route, room)

  expect($groupChats.get()['Agro Ops team']).toMatchObject({
    roomId: 'local-room',
    members: [{ name: 'local-bot' }]
  })
})

it('re-keys the sidebar GroupRow when the gateway room is renamed', () => {
  mirrorCanonicalRoom(route, room)
  $botSections.set([{ id: 'sec-team', name: 'Team' }])
  moveGroupChatsToSection(['Agro Ops team'], 'sec-team')

  const renamed = { ...room, name: 'Team Chat' }
  mirrorCanonicalRoom(route, renamed)

  expect($groupChats.get()['Agro Ops team']).toBeUndefined()
  expect($groupChats.get()['Team Chat']).toMatchObject({
    roomId: 'agro-1',
    members: expect.arrayContaining([expect.objectContaining({ name: 'agro-ops-cto' })])
  })
  expect(groupChatSectionId('Team Chat', $groupChats.get())).toBe('sec-team')
  expect(groupChatNames({}, $groupChats.get())).toContain('Team Chat')
  expect(groupChatNames({}, $groupChats.get())).not.toContain('Agro Ops team')
})
