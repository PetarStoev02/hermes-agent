'use client'

import type { FormEvent, RefObject } from 'react'

import { MessageQuestion } from '@/lib/icons'
import type { ClarifyQuestion } from '@/store/clarify'

import { ClarifyConfirmBar } from './core/confirm-bar'
import { emptyStage, QuestionBlock } from './core/question-block'
import { CLARIFY_ICON_CLASS, ClarifyShell } from './core/shell'
import type { ClarifyStage } from './pending-stage'
import { handleClarifySubmitShortcut } from './submit-shortcut'
import { UndeliveredNotice } from './undelivered-notice'

export function ClarifyPendingForm({
  answeredCount,
  canConfirm,
  copy,
  cursorRow,
  disabled,
  formRef,
  onActivate,
  onBack,
  onDraft,
  onNext,
  onOtherFocus,
  onPick,
  onSkip,
  onSubmit,
  page,
  paged,
  questions,
  ready,
  staged,
  submitting,
  undelivered,
  visibleQuestion
}: {
  answeredCount: number
  canConfirm: boolean
  copy: {
    loadingQuestion: string
    oneQuestion: string
    questionProgress: (answered: number, total: number) => string
  }
  cursorRow: null | number
  disabled: boolean
  formRef: RefObject<HTMLFormElement | null>
  onActivate: () => void
  onBack: () => void
  onDraft: (value: string) => void
  onNext: () => void
  onOtherFocus: () => void
  onPick: (choiceIndex: number) => void
  onSkip: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  page: number
  paged: boolean
  questions: ClarifyQuestion[]
  ready: boolean
  staged: Record<string, ClarifyStage>
  submitting: boolean
  undelivered: boolean
  visibleQuestion: ClarifyQuestion | undefined
}) {
  return (
    <form
      aria-busy={ready || undelivered ? undefined : 'true'}
      className="my-1.5 grid gap-4"
      data-clarify-batch={questions.length}
      data-clarify-batch-preview={ready ? undefined : ''}
      data-clarify-choices={ready ? visibleQuestion?.choices?.length || undefined : undefined}
      data-clarify-page={paged ? page + 1 : undefined}
      onKeyDownCapture={handleClarifySubmitShortcut}
      onSubmit={onSubmit}
      ref={formRef}
    >
      {ready || undelivered ? null : (
        <span className="sr-only" role="status">
          {copy.loadingQuestion}
        </span>
      )}
      <ClarifyShell className="grid gap-3">
        <div className="flex items-start gap-2">
          <span className="flex-1 text-[0.6875rem] leading-4 text-(--ui-text-tertiary)">
            {questions.length === 1
              ? copy.oneQuestion
              : copy.questionProgress(answeredCount, questions.length)}
          </span>
          <MessageQuestion aria-hidden className={CLARIFY_ICON_CLASS} />
        </div>
        {undelivered ? <UndeliveredNotice /> : null}
        {visibleQuestion ? (
          <QuestionBlock
            cursor={cursorRow}
            disabled={disabled}
            key={visibleQuestion.qid}
            onActivate={onActivate}
            onDraft={onDraft}
            onOtherFocus={onOtherFocus}
            onPick={onPick}
            question={visibleQuestion}
            staged={staged[visibleQuestion.qid] ?? emptyStage}
          />
        ) : null}
      </ClarifyShell>

      {undelivered ? null : (
        <ClarifyConfirmBar
          canConfirm={canConfirm}
          disabled={disabled}
          onBack={onBack}
          onNext={onNext}
          onSkip={onSkip}
          page={paged ? page : undefined}
          pageCount={paged ? questions.length : undefined}
          submitting={submitting}
        />
      )}
    </form>
  )
}
