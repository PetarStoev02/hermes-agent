/**
 * Routines list embedded in the bot details panel (Details tab). Same rows
 * and create/detail dialogs as the Routines pane; scoped to the panel's bot.
 */

import { Button, GlyphSpinner, useI18n } from '@hermes/plugin-sdk'
import { useState } from 'react'

import {
  $lastJobs,
  CreateRoutineDialog,
  routineCreateTarget,
  RoutineDetailDialog,
  routineFilterHint,
  RoutineRow,
  selectRoutineJobs,
  useRoutines
} from './cron'
import { useBots } from './i18n'
import type { RosterRow } from './types'

export function BotDetailsRoutines({ bot }: { bot: RosterRow }) {
  const b = useBots()
  const { t } = useI18n()
  const c = t.cron
  const { data, error, isLoading, refetch } = useRoutines(bot)
  const [createOpen, setCreateOpen] = useState(false)
  const [detailJobId, setDetailJobId] = useState<null | string>(null)

  const view = selectRoutineJobs(data, error, $lastJobs.get(), bot.name)

  if (view.live) {
    $lastJobs.set(view.live)
  }

  const jobs = view.jobs
  const detailJob = detailJobId ? jobs.find(job => job.job_id === detailJobId) || null : null
  const filterHint = routineFilterHint(view.all, jobs)
  const createTarget = routineCreateTarget(bot, bot.name)

  return (
    <div className="grid gap-2" data-slot="bot-details-routines">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[0.6875rem] font-medium uppercase tracking-wider text-(--ui-text-quaternary)">
          {c.title}
        </span>
        <Button onClick={() => setCreateOpen(true)} size="xs" type="button" variant="text">
          + {c.newCron}
        </Button>
      </div>
      {isLoading && !view.all.length ? (
        <div className="flex justify-center py-4">
          <GlyphSpinner className="text-(--ui-text-tertiary)" spinner="breathe" />
        </div>
      ) : error && !view.all.length ? (
        <div className="grid gap-2">
          <p className="text-xs text-(--ui-text-tertiary)">{b.cron.readFailure}</p>
          <Button onClick={() => void refetch()} size="xs" variant="secondary">
            {t.common.retry}
          </Button>
        </div>
      ) : jobs.length === 0 ? (
        <p className="text-xs text-(--ui-text-tertiary)">{filterHint || c.emptyDescNew}</p>
      ) : (
        <div className="grid gap-1.5">
          {jobs.map(job => (
            <RoutineRow job={job} key={job.job_id} onOpen={opened => setDetailJobId(opened.job_id)} owner={bot} />
          ))}
        </div>
      )}
      <RoutineDetailDialog job={detailJob} onClose={() => setDetailJobId(null)} open={Boolean(detailJob)} />
      <CreateRoutineDialog
        bot={createTarget}
        key={bot.name}
        onClose={() => setCreateOpen(false)}
        open={createOpen}
      />
    </div>
  )
}
