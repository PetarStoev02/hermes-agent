import { bareChoice, type ClarifyQuestion } from '@/store/clarify'

import { emptyStage } from './core/question-block'

export type ClarifyStage = { choices: string[]; draft: string }

/** Collapse a per-question stage into the wire answer (or null if unanswered). */
export function stagedAnswerFrom(
  question: ClarifyQuestion,
  staged: Record<string, ClarifyStage>
): string | null {
  const stage = staged[question.qid] ?? emptyStage
  const draft = stage.draft.trim()

  if (question.multiSelect) {
    // The typed text is an additional answer, not a replacement for the
    // staged choices.
    const combined = [...stage.choices.map(bareChoice), ...(draft ? [draft] : [])]

    return combined.length > 0 ? JSON.stringify(combined) : null
  }

  if (stage.choices.length > 0) {
    return bareChoice(stage.choices[0])
  }

  return draft ? draft : null
}

/** Merge reconnect / composer locked answers into the local stage map. */
export function mergeLockedAnswers(
  current: Record<string, ClarifyStage>,
  questions: ClarifyQuestion[],
  lockedAnswers: Record<string, null | string>,
  seenLocks: Record<string, null | string>
): Record<string, ClarifyStage> {
  const next = { ...current }

  for (const question of questions) {
    const answer = lockedAnswers[question.qid]

    if (answer === undefined || answer === null || seenLocks[question.qid] === answer) {
      continue
    }

    const options = question.choices ?? []
    let replayedAnswers = [answer]

    if (question.multiSelect) {
      try {
        const parsed = JSON.parse(answer)

        if (Array.isArray(parsed) && parsed.every(value => typeof value === 'string')) {
          replayedAnswers = parsed
        }
      } catch {
        // Older/non-JSON replies remain a one-value replay below.
      }
    }

    const matchedChoices = options.filter(choice => replayedAnswers.includes(bareChoice(choice)))
    // Words that name no choice (typed in the composer) go to the free-text field as words, not JSON.
    const draft = replayedAnswers.filter(value => !options.some(choice => bareChoice(choice) === value)).join(', ')
    next[question.qid] = { choices: matchedChoices, draft }
  }

  return next
}
