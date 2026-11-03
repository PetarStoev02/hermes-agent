import type { FC } from 'react'
import { useMemo } from 'react'

import { useContributions } from '@/contrib'
import { ContribBoundary, ContribRender } from '@/contrib/react/boundary'
import { CHAT_CHROME_AREA, type ChatChromeContribution } from '@/lib/chat-chrome'

const ChatChromeEntry: FC<{ id: string; render: ChatChromeContribution['render']; sessionId: string }> = ({
  id,
  render,
  sessionId
}) => {
  const renderChrome = useMemo(() => () => render({ sessionId }), [render, sessionId])

  return (
    <ContribBoundary id={id}>
      <ContribRender render={renderChrome} />
    </ContribBoundary>
  )
}

/** Floating chrome plugins pin over a live chat (Bot Mode name pill, etc.). */
export const ChatChromeSlot: FC<{ sessionId: string }> = ({ sessionId }) => {
  const contributions = useContributions(CHAT_CHROME_AREA)

  return (
    <>
      {contributions.map(contribution => {
        const render = (contribution.data as ChatChromeContribution | undefined)?.render

        return render ? (
          <ChatChromeEntry id={contribution.id} key={contribution.id} render={render} sessionId={sessionId} />
        ) : null
      })}
    </>
  )
}
