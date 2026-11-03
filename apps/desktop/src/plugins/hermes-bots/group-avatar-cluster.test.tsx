import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('./data', async () => {
  const { atom } = await import('nanostores')

  return {
    $botMeta: atom({})
  }
})

vi.mock('./routing', () => ({
  botRosterMeta: () => undefined
}))

import { GroupAvatarCluster } from './group-avatar-cluster'
import type { GroupMember } from './types'

afterEach(() => {
  cleanup()
})

const member = (name: string): GroupMember => ({ name })

describe('GroupAvatarCluster', () => {
  it('renders a 2×2 cluster for four members', () => {
    const { container } = render(
      <GroupAvatarCluster members={[member('a'), member('b'), member('c'), member('d')]} />
    )

    expect(container.querySelector('[data-slot="bots-group-avatar"]')).toBeTruthy()
    expect(container.querySelectorAll('[data-slot="bots-group-avatar"] > span')).toHaveLength(4)
  })

  it('uses a diagonal pair for two members', () => {
    const { container } = render(<GroupAvatarCluster members={[member('a'), member('b')]} />)
    const slots = container.querySelectorAll('[data-slot="bots-group-avatar"] > span')

    expect(slots).toHaveLength(2)
  })

  it('prefers custom room art over the cluster', () => {
    const { container } = render(
      <GroupAvatarCluster image="data:image/png;base64,xx" members={[member('a'), member('b')]} />
    )

    expect(container.querySelector('img')).toBeTruthy()
    expect(container.querySelector('[data-slot="bots-group-avatar"]')).toBeNull()
  })
})
