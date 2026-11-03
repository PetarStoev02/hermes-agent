'use client'

import { useStore } from '@nanostores/react'
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { Loader } from '@/components/ui/loader'
import { useI18n } from '@/i18n'
import { triggerHaptic } from '@/lib/haptics'
import {
  type ClarifyQuestion,
  type ClarifyRequest,
  clearClarifyRequest,
  skipClarify
} from '@/store/clarify'
import { $gateway } from '@/store/gateway'
import { reconnectAction } from '@/store/gateway-reconnect'
import { notifyError } from '@/store/notifications'
import { forgetServerRequest } from '@/store/server-requests'
import { requestForOwnedSession } from '@/store/session-states'

import { emptyStage } from './core/question-block'
import { ClarifyShell } from './core/shell'
import { useClarifyKeys } from './core/use-clarify-keys'
import type { ClarifyArgs } from './parse'
import { ClarifyPendingForm } from './pending-form'
import { type ClarifyStage, mergeLockedAnswers, stagedAnswerFrom } from './pending-stage'

/** Live batch card: one question at a time (Back/Next pager), staged locally,
 * ONE confirm on the last page. Picks and drafts stay in component state —
 * nothing reaches the server until the user presses "Confirm and continue",
 * which sends the per-question locks back-to-back and completes the batch.
 * Staged answers stay editable up to that moment. The per-question wire
 * protocol is unchanged (the TUI/CLI still lock incrementally); this card
 * just batches its locks at the end. */
export function ClarifyToolPending({
  fromArgs,
  onAnswered,
  request,
  undelivered
}: {
  fromArgs?: ClarifyArgs
  onAnswered: () => void
  request: ClarifyRequest | null
  undelivered: boolean
}) {
  const { t } = useI18n()
  const copy = t.assistant.clarify
  const gateway = useStore($gateway)

  // qids only exist on the gateway request — args are a hydration-race
  // fallback for display, never answerable (no ids to respond with).
  const liveQuestions = request?.questions ?? []
  const ready = Boolean(request?.requestId) && liveQuestions.length > 0

  // Preview items from the tool args: same question text/choices, synthetic
  // qids, shown disabled until the live request lands (or indefinitely when
  // the caller has no gateway request at all — e.g. an external tool call —
  // so the user sees the question instead of an endless spinner). ONE form
  // renders both states: every control is disabled while !ready, so nothing
  // is ever staged under a synthetic qid and the swap to live qids is clean.
  const previewQuestions: ClarifyQuestion[] = useMemo(
    () =>
      (fromArgs?.questions ?? []).map((entry, index) => ({
        choices: entry.choices ?? null,
        multiSelect: entry.multiSelect ?? false,
        qid: `args-${index}`,
        question: entry.question
      })),
    [fromArgs]
  )

  const questions = ready ? liveQuestions : previewQuestions

  const [staged, setStaged] = useState<Record<string, ClarifyStage>>({})
  const [submitting, setSubmitting] = useState(false)

  // Locked answers (a reconnect replay, or text typed in the composer) stage
  // their questions. A newly locked answer replaces what the card staged, so
  // Confirm never re-sends an older pick; an answer seen before is left alone,
  // so a later edit on the card stands.
  const [seenLocks, setSeenLocks] = useState<Record<string, null | string>>({})

  // A canonical gateway answers a batch one card at a time through the SAME
  // mounted tool row: a new live request is a new card, so the previous card's
  // submit latch, staged picks and seen locks must not carry over (that left
  // question 2 disabled behind question 1's spinner).
  const [cardRequestId, setCardRequestId] = useState(request?.requestId)

  if (request?.requestId !== cardRequestId) {
    setCardRequestId(request?.requestId)

    if (request?.requestId) {
      setSubmitting(false)
      setStaged({})
      setSeenLocks({})
    }
  }

  useEffect(() => {
    const lockedAnswers = request?.lockedAnswers

    if (!lockedAnswers) {
      return
    }

    setSeenLocks(lockedAnswers)
    setStaged(current => mergeLockedAnswers(current, questions, lockedAnswers, seenLocks))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by the replay map only
  }, [request?.lockedAnswers])

  const stagedAnswer = useCallback(
    (question: ClarifyQuestion) => stagedAnswerFrom(question, staged),
    [staged]
  )

  const answeredCount = questions.filter(q => stagedAnswer(q) !== null).length
  const canConfirm = answeredCount > 0

  const confirmAll = useCallback(async () => {
    if (!request || !gateway) {
      notifyError(
        new Error(request ? copy.gatewayDisconnected : copy.notReady),
        copy.sendFailed,
        request ? { action: reconnectAction() } : {}
      )

      return
    }

    setSubmitting(true)

    try {
      // Sequential, not Promise.all: the LAST lock resolves the blocked
      // server request, so every earlier lock must already be accepted when
      // it lands — a reordered burst could complete the batch with a missing
      // answer. `clarify.lock` is a normal RPC; it rides the session's OWNER
      // socket (a profile / Bot Chat switch re-points ambient elsewhere).
      for (const question of questions) {
        const answer = stagedAnswer(question)

        await requestForOwnedSession<{ remaining?: string[]; status?: string }>(
          request.sessionId,
          gateway.request.bind(gateway) as typeof gateway.request,
          'clarify.lock',
          {
            answer,
            question_id: question.qid,
            request_id: request.requestId
          }
        )
      }

      forgetServerRequest(request.requestId)

      triggerHaptic('submit')
      onAnswered()
      // tool.complete lands next → ClarifyToolSettled.
      clearClarifyRequest(request.requestId, request.sessionId)
    } catch (error) {
      notifyError(error, copy.sendFailed)
      setSubmitting(false)
    }
  }, [copy, gateway, onAnswered, questions, request, stagedAnswer])

  const toggleChoice = useCallback((question: ClarifyQuestion, choice: string) => {
    setStaged(current => {
      const stage = current[question.qid] ?? emptyStage

      const next = question.multiSelect
        ? stage.choices.includes(choice)
          ? stage.choices.filter(value => value !== choice)
          : [...stage.choices, choice]
        : [choice]

      // Multi-select keeps the typed text alongside the toggled choices;
      // single-select stays mutually exclusive.
      return { ...current, [question.qid]: { choices: next, draft: question.multiSelect ? stage.draft : '' } }
    })
  }, [])

  const draftFor = useCallback((question: ClarifyQuestion, value: string) => {
    setStaged(current => {
      const stage = current[question.qid] ?? emptyStage

      // Multi-select keeps the staged choices while the free-text field is
      // edited; single-select stays mutually exclusive.
      return { ...current, [question.qid]: { choices: question.multiSelect ? stage.choices : [], draft: value } }
    })
  }, [])

  const cancelAll = useCallback(async () => {
    if (!request) {
      return
    }

    onAnswered()
    // A response with no `answers` is the cancel-all (the plain Esc path).
    skipClarify(request)
  }, [onAnswered, request])

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()

      if (ready && canConfirm) {
        void confirmAll()
      }
    },
    [canConfirm, confirmAll, ready]
  )

  const clearStage = useCallback((question: ClarifyQuestion) => {
    setStaged(current => ({ ...current, [question.qid]: emptyStage }))
  }, [])

  const isStaged = useCallback((question: ClarifyQuestion) => stagedAnswer(question) !== null, [stagedAnswer])

  const formRef = useRef<HTMLFormElement | null>(null)

  const keys = useClarifyKeys({
    enabled: ready && !submitting,
    formRef,
    isStaged,
    onClear: clearStage,
    onConfirm: () => void confirmAll(),
    onToggle: toggleChoice,
    questions
  })

  const disabled = submitting || !ready
  // Keyboard cursor owns the pager page so a pick that advances to the next
  // open question also flips the visible card (Back/Next call focusQuestion).
  const page = Math.min(Math.max(keys.activeQuestion, 0), Math.max(questions.length - 1, 0))
  const visibleQuestion = questions[page]
  const paged = questions.length > 1

  // New live request: start the pager on question 0 (cursor survives remounts
  // of the same tool row across one-card-per-question gateway prompts).
  useEffect(() => {
    if (request?.requestId) {
      keys.focusQuestion(0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the live request id changes
  }, [request?.requestId])

  if (questions.length === 0 || !visibleQuestion) {
    return (
      <ClarifyShell aria-label={copy.loadingQuestion} className="my-1.5 grid min-h-12 place-items-center" role="status">
        <Loader aria-hidden="true" className="size-6 text-(--ui-text-tertiary)" role="presentation" type="rose-curve" />
      </ClarifyShell>
    )
  }

  const active = visibleQuestion

  return (
    <ClarifyPendingForm
      answeredCount={answeredCount}
      canConfirm={canConfirm}
      copy={copy}
      cursorRow={ready ? keys.cursorRow : null}
      disabled={disabled}
      formRef={formRef}
      onActivate={() => keys.focusQuestion(page)}
      onBack={() => keys.focusQuestion(Math.max(0, page - 1))}
      onDraft={value => draftFor(active, value)}
      onNext={() => keys.focusQuestion(Math.min(questions.length - 1, page + 1))}
      onOtherFocus={() => keys.onOtherFocus(page)}
      onPick={choiceIndex => keys.pick(page, choiceIndex)}
      onSkip={() => void cancelAll()}
      onSubmit={handleSubmit}
      page={page}
      paged={paged}
      questions={questions}
      ready={ready}
      staged={staged}
      submitting={submitting}
      undelivered={undelivered}
      visibleQuestion={active}
    />
  )
}
