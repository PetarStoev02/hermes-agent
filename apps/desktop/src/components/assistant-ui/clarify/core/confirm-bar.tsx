'use client'

import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'
import { Loader2 } from '@/lib/icons'
import { cn } from '@/lib/utils'

export function ClarifyConfirmBar({
  canConfirm,
  disabled,
  onBack,
  onNext,
  onSkip,
  page,
  pageCount,
  submitting
}: {
  canConfirm: boolean
  disabled: boolean
  /** Multi-question pager: go to the previous question. */
  onBack?: () => void
  /** Multi-question pager: advance (Confirm on the last page is type=submit). */
  onNext?: () => void
  onSkip: () => void
  page?: number
  pageCount?: number
  submitting: boolean
}) {
  const { t } = useI18n()
  const copy = t.assistant.clarify
  const paged = typeof page === 'number' && typeof pageCount === 'number' && pageCount > 1
  const lastPage = paged && page === pageCount - 1
  // Preview (!ready) still lets the user page through questions to read them;
  // only answering / Skip / Confirm stay gated on `disabled`.
  const pagingLocked = submitting

  return (
    <div className="flex items-center gap-2">
      {paged ? (
        <div aria-hidden className="flex items-center gap-1.5">
          {Array.from({ length: pageCount }, (_, index) => (
            <span
              className={cn(
                'size-1.5 rounded-full transition-colors',
                index === page ? 'bg-(--ui-text-primary)' : 'bg-(--ui-stroke-secondary)'
              )}
              key={index}
            />
          ))}
        </div>
      ) : null}
      <div className="ml-auto flex items-center gap-1">
        {paged && page > 0 ? (
          <Button disabled={pagingLocked} onClick={onBack} size="xs" type="button" variant="secondary">
            {copy.back}
          </Button>
        ) : (
          <Button disabled={disabled} onClick={onSkip} size="xs" type="button" variant="text">
            {copy.skip}
          </Button>
        )}
        {paged && !lastPage ? (
          <Button disabled={pagingLocked} onClick={onNext} size="xs" type="button">
            {copy.next}
          </Button>
        ) : (
          <Button disabled={disabled || !canConfirm} size="xs" type="submit">
            {submitting ? (
              <Loader2 className="animate-spin" />
            ) : (
              <>
                {copy.confirmAndContinueLabel}
                <span aria-hidden className="ml-0.5 text-[0.625rem] opacity-70">
                  ⏎
                </span>
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  )
}
