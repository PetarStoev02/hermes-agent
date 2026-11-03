import type { ToolCallMessagePartProps } from '@assistant-ui/react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { I18nProvider } from '@/i18n'
import { clearClarifyRequest, setClarifyRequest } from '@/store/clarify'
import { $gateway } from '@/store/gateway'
import { rememberServerRequest, resetServerRequestsForTests } from '@/store/server-requests'
import { $activeSessionId } from '@/store/session'

import { ClarifyTool } from './index'

vi.mock('@/store/gateway', async importActual => ({
  ...(await importActual<Record<string, unknown>>()),
  requestGatewayForAgent: vi.fn(async () => ({ ok: true }))
}))

vi.mock('@assistant-ui/react', () => ({ useAuiState: () => true }))

afterEach(() => {
  cleanup()
  clearClarifyRequest()
  resetServerRequestsForTests()
  $activeSessionId.set(null)
  $gateway.set(null)
  vi.clearAllMocks()
})

const QUESTIONS = [
  { choices: ['staging', 'production'], multiSelect: false, qid: 'q0', question: 'Which target?' },
  { choices: ['us', 'eu'], multiSelect: false, qid: 'q1', question: 'Which region?' },
  { choices: null, multiSelect: false, qid: 'q2', question: 'Anything else?' }
]

function renderSet(questions = QUESTIONS) {
  const request = vi.fn().mockResolvedValue({ ok: true, remaining: [] })
  rememberServerRequest({ fail: vi.fn(), id: 'request-set', method: 'clarify', params: {}, respond: vi.fn() })
  $activeSessionId.set('session-1')
  $gateway.set({ request } as never)
  setClarifyRequest({ questions, requestId: 'request-set', sessionId: 'session-1' })
  const args = { questions: questions.map(({ choices, question }) => ({ choices, question })) }

  const props: ToolCallMessagePartProps = {
    addResult: vi.fn(), args, argsText: JSON.stringify(args), isError: false, respondToApproval: vi.fn(),
    result: undefined, resume: vi.fn(), status: { type: 'running' }, toolCallId: 'clarify-set', toolName: 'clarify',
    type: 'tool-call'
  }

  render(
    <I18nProvider configClient={null} initialLocale="en">
      <ClarifyTool {...props} />
    </I18nProvider>
  )

  return request
}

const locks = (request: ReturnType<typeof vi.fn>) =>
  request.mock.calls.filter(call => call[0] === 'clarify.lock').map(call => [call[1].question_id, call[1].answer])

const goNext = () => fireEvent.click(screen.getByRole('button', { name: 'Next' }))
const goBack = () => fireEvent.click(screen.getByRole('button', { name: 'Back' }))

describe('a multi-question clarify set is one paged form', () => {
  it('shows one question at a time with Next, then Confirm on the last page', () => {
    renderSet()

    expect(screen.getByText('Which target?')).toBeTruthy()
    expect(screen.queryByText('Which region?')).toBeNull()
    expect(screen.getByRole('button', { name: 'Next' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Confirm and continue/ })).toBeNull()

    goNext()
    expect(screen.getByText('Which region?')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Back' })).toBeTruthy()

    goNext()
    expect(screen.getByText('Anything else?')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Confirm and continue/ })).toBeTruthy()
  })

  it('picking an answer advances to the next open question', async () => {
    const request = renderSet()

    fireEvent.click(screen.getByRole('button', { name: /staging/ }))
    expect(screen.getByText('Which region?')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /us/ }))
    expect(screen.getByText('Anything else?')).toBeTruthy()

    fireEvent.change(screen.getByPlaceholderText(/Type your answer/), { target: { value: 'after 5pm' } })
    fireEvent.click(screen.getByRole('button', { name: /Confirm and continue/ }))
    await waitFor(() => expect(locks(request)).toHaveLength(3))
    expect(locks(request)).toEqual([['q0', 'staging'], ['q1', 'us'], ['q2', 'after 5pm']])
  })

  it('plain Enter on an answered earlier question moves on instead of sending the set half answered', async () => {
    const request = renderSet()

    fireEvent.click(screen.getByRole('button', { name: /staging/ }))
    expect(screen.getByText('Which region?')).toBeTruthy()

    goBack()
    expect(screen.getByText('Which target?')).toBeTruthy()

    // Enter on that answered row must not submit while two questions are still open: it moves on.
    fireEvent.keyDown(window, { key: 'Enter' })
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(locks(request)).toEqual([])
    expect(screen.getByText('Which region?')).toBeTruthy()

    fireEvent.keyDown(window, { key: 'Enter' })
    expect(screen.getByText('Anything else?')).toBeTruthy()

    fireEvent.change(screen.getByPlaceholderText(/Type your answer/), { target: { value: 'after 5pm' } })
    fireEvent.keyDown(screen.getByPlaceholderText(/Type your answer/), { key: 'Enter', ctrlKey: true })
    await waitFor(() => expect(locks(request)).toHaveLength(3))
    expect(locks(request)).toEqual([['q0', 'staging'], ['q1', 'us'], ['q2', 'after 5pm']])
  })

  it('plain Enter on the last question does not send the set while earlier questions are open', async () => {
    const request = renderSet([...QUESTIONS.slice(0, 2), { ...QUESTIONS[2], choices: ['now', 'later'] }])

    goNext()
    goNext()
    expect(screen.getByText('Anything else?')).toBeTruthy()

    // Picking later auto-jumps to the first open question (target).
    fireEvent.click(screen.getByRole('button', { name: /later/ }))
    expect(screen.getByText('Which target?')).toBeTruthy()

    fireEvent.keyDown(window, { key: 'Enter' })
    expect(screen.getByText('Which region?')).toBeTruthy()
    fireEvent.keyDown(window, { key: 'Enter' })
    // Picking the last open question lands on the final page (later already staged).
    expect(screen.getByText('Anything else?')).toBeTruthy()
    fireEvent.keyDown(window, { key: 'Enter' })
    await waitFor(() => expect(locks(request)).toHaveLength(3))
    expect(locks(request)).toEqual([['q0', 'staging'], ['q1', 'us'], ['q2', 'later']])
  })

  it('plain Enter across a mixed set sends once every required question is closed', async () => {
    const MIXED = [
      { choices: ['staging', 'production'], multiSelect: false, qid: 'q0', question: 'Which target?' },
      { choices: ['lint', 'tests', 'docs'], multiSelect: true, qid: 'q1', question: 'Which checks?' },
      { choices: null, multiSelect: false, qid: 'q2', question: 'Anything else?' },
      { choices: ['now', 'later'], multiSelect: false, qid: 'q3', question: 'When?' }
    ]
    const request = renderSet(MIXED)

    fireEvent.click(screen.getByRole('button', { name: /staging/ }))
    // Multi-select is never "open"; pager lands on free-text.
    expect(screen.getByText('Anything else?')).toBeTruthy()

    fireEvent.change(screen.getByPlaceholderText(/Type your answer/), { target: { value: 'after 5pm' } })
    goNext()
    fireEvent.click(screen.getByRole('button', { name: /later/ }))
    fireEvent.click(screen.getByRole('button', { name: /Confirm and continue/ }))

    await waitFor(() => expect(locks(request)).toHaveLength(4))
    expect(locks(request)).toEqual([['q0', 'staging'], ['q1', null], ['q2', 'after 5pm'], ['q3', 'later']])
  })
})
