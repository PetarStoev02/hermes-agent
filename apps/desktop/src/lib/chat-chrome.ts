/**
 * Floating chrome that plugins can pin over a live chat (e.g. Bot Mode's
 * name pill). Mounted for every thread, not only empty ones — contributors
 * decide whether to render based on the session on screen.
 */

export const CHAT_CHROME_AREA = 'chat.chrome'

export interface ChatChromeProps {
  sessionId: string
}

export interface ChatChromeContribution {
  render: (props: ChatChromeProps) => React.ReactNode
}
