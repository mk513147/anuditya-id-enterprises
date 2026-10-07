import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { OrderStatus } from '@/types'
import { buildTimeline, type StageState } from '../timeline'

const STATE_TEXT: Record<StageState, string> = { completed: 'Completed', current: 'Current stage', upcoming: 'Upcoming' }

/**
 * Seven-stage progress. Vertical on phones and tablets, horizontal from lg. State is never colour-only:
 * every stage carries text, completed stages show a tick, and the current stage has aria-current="step".
 */
export function OrderTimeline({ status }: { status: OrderStatus }) {
  const stages = buildTimeline(status)
  return (
    <ol aria-label="Order progress" className="relative lg:grid lg:grid-cols-7">
      {stages.map((stage, i) => {
        const last = i === stages.length - 1
        return (
          <li
            key={stage.label + i}
            aria-current={stage.state === 'current' ? 'step' : undefined}
            data-state={stage.state}
            className="relative flex gap-4 pb-7 last:pb-0 lg:flex-col lg:items-center lg:gap-3 lg:pb-0 lg:text-center"
          >
            {!last && (
              <span
                aria-hidden
                className={cn(
                  'absolute left-[1.0625rem] top-9 h-[calc(100%-1.25rem)] w-0.5 lg:left-1/2 lg:top-[1.0625rem] lg:h-0.5 lg:w-full',
                  stage.state === 'completed' ? 'bg-royal-600' : 'bg-border',
                )}
              />
            )}
            <span
              aria-hidden
              className={cn(
                'relative z-10 grid size-9 shrink-0 place-items-center rounded-full text-sm font-bold',
                stage.state === 'completed' && 'bg-royal-600 text-white',
                stage.state === 'current' && 'bg-gold-500 text-navy-950 ring-4 ring-gold-100 motion-safe:animate-pulse',
                stage.state === 'upcoming' && 'border-2 border-border bg-white text-muted-ink',
              )}
            >
              {stage.state === 'completed' ? <Check className="size-5" /> : i + 1}
            </span>
            <span className="min-w-0 pt-1 lg:pt-0">
              <span className={cn('block text-[15px] font-semibold leading-snug', stage.state === 'upcoming' ? 'text-muted-ink' : 'text-navy-900')}>
                {stage.label}
              </span>
              <span className={cn('block text-xs', stage.state === 'current' ? 'font-semibold text-gold-700' : 'text-muted-ink')}>
                {STATE_TEXT[stage.state]}
              </span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}
