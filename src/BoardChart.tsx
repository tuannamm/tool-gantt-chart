import type { ReactNode, Ref } from 'react'
import { HUES, type Hue, type Project, type TaskStatus } from './types.ts'
import { PALETTE } from './palette.ts'
import logoUrl from '@dgtx/ui-frek/assets/logo-horizontal.svg?inline'
import { addDays, calendarAxis, calendarX, fmtDay, hasBar, STAGE_H, stageBands, today, wrap } from './layout.ts'
import { StageBands } from './StageBands.tsx'

// The reference's phase order (yellow, periwinkle, blue, pink, red), then any other hue.
const ORDER = [...new Set<Hue>(['yellow', 'indigo', 'blue', 'pink', 'red', ...HUES])].map(h => PALETTE[h])
const C = { ink: '#1f2430', muted: '#3f4655', head: '#f3f5fb', grid: '#dde1e8', now: '#5ccf9c', nowTint: '#eefbf5' }
const STATUS: Record<TaskStatus, string> = { '': '', todo: 'Upcoming', doing: 'On-Going', done: 'Done' }
const FONT = 'Poppins, "Segoe UI", Tahoma, Verdana, "DejaVu Sans", sans-serif'
const W = 1280, PAD = 28, LEFT = 300, GAP = 18
const TAG_H = 34, ROW = 40, BAR = 26, LINE = 18, DOT = 6
const month = new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' })

// "Status board": phase tags and task names on the left, equal calendar columns on the right.
// A bar is solid up to the status date for 'doing', solid for 'done', pale for 'todo'; the column
// holding the status date is highlighted.
export function BoardChart({ project, ref }: { project: Project; ref?: Ref<SVGSVGElement> }) {
  const cal = calendarAxis(project)
  const x0 = PAD + LEFT + GAP, x1 = W - PAD
  const cols = cal ? cal.dates.length - 1 : 0
  const colW = cols ? (x1 - x0) / cols : 0
  const xAt = (d: string) => (cal ? calendarX(cal, x0, colW, d) : x0)
  const sd = project.statusDate || today()
  const now = cal ? cal.dates.findIndex((d, i) => i < cols && d <= sd && sd < cal.dates[i + 1]) : -1
  const split = xAt(sd)

  const title = [project.subtitle.trim(), project.title.trim()].filter(Boolean).join(' ')
  // 0.64em: a wide bold fallback face, so the dots never touch the title.
  // Symmetric room for the dots, and for the logo at the right.
  const titleSize = Math.min(34, (W - 2 * (PAD + 150 + 16) - 112) / Math.max(1, title.length * 0.64))
  const titleW = title.length * titleSize * 0.64
  const stages = cal ? stageBands(project) : []
  const stageY = 92, headTop = stages.length ? stageY + STAGE_H + 10 : stageY, headH = 56, top = headTop + headH + 22

  let y = top
  const rows: ReactNode[] = [], seps: number[] = []
  project.phases.forEach((ph, pi) => {
    const pal = ORDER[pi % ORDER.length]
    const tag = wrap(ph.name, LEFT - 32, 8.8)
    const tagH = TAG_H + Math.max(0, tag.length - 1) * LINE
    y += 10
    rows.push(
      <g key={ph.id}>
        <rect x={PAD} y={y} width={LEFT - 12} height={tagH} fill={pal.solid} />
        <g fill={pal.ink} fontSize={15} fontWeight="bold">
          {tag.map((s, i) => <text key={i} x={PAD + 14} y={y + 22 + i * LINE}>{s}</text>)}
        </g>
      </g>,
    )
    y += tagH + 4
    for (const task of ph.tasks) {
      const name = wrap(task.name, LEFT - 4, 8)
      const h = Math.max(ROW, name.length * LINE + 14)
      const cy = y + h / 2
      let bar: ReactNode = null
      if (cal && hasBar(task.start, task.end)) {
        const bx1 = xAt(task.start), bx2 = xAt(addDays(task.end, 1)), w = bx2 - bx1
        const solidTo = task.status === 'done' ? bx2 : task.status === 'doing' ? Math.min(bx2, Math.max(bx1, split)) : bx1
        const text = STATUS[task.status]
        const room = 2 * DOT + 16
        const textW = text.length * 8.4
        const inside = textW + 10 + room <= w
        // Beside the bar: right of it, or left when that would run off the chart.
        const after = bx2 + 8 + textW <= W - 4
        const cx = bx2 - DOT - 9
        const clip = `bd-${task.id}`
        bar = (
          <g>
            <clipPath id={clip}><rect x={bx1} y={cy - BAR / 2} width={solidTo - bx1} height={BAR} /></clipPath>
            <rect x={bx1} y={cy - BAR / 2} width={w} height={BAR} fill={pal.pale} />
            <rect x={bx1} y={cy - BAR / 2} width={solidTo - bx1} height={BAR} fill={pal.solid} />
            <line x1={bx1} x2={bx2} y1={cy + BAR / 2 + 3} y2={cy + BAR / 2 + 3} stroke={pal.mid} strokeWidth={2} />
            {/* Pale-tone text, then the solid-tone copy clipped to the solid part: readable across the split. */}
            {text && inside && <g fontSize={14} fontWeight="bold">
              <text x={bx1 + 10} y={cy + 5} fill={pal.text}>{text}</text>
              <text x={bx1 + 10} y={cy + 5} fill={pal.ink} clipPath={`url(#${clip})`}>{text}</text>
            </g>}
            {text && !inside && <text x={after ? bx2 + 8 : bx1 - 8} y={cy + 5} fontSize={13} fontWeight="bold" fill={pal.text}
              textAnchor={after ? 'start' : 'end'}>{text}</text>}
            {w >= room && <circle cx={cx} cy={cy} r={DOT} fill={cx + DOT <= solidTo ? pal.ink : pal.text} />}
          </g>
        )
      }
      rows.push(
        <g key={task.id}>
          <g fontSize={15} fill={C.ink}>
            {name.map((s, i) => <text key={i} x={PAD} y={cy + 5 - (name.length - 1) * LINE / 2 + i * LINE}>{s}</text>)}
          </g>
          {bar}
        </g>,
      )
      y += h
    }
    y += 10
    seps.push(y)
  })
  const bottom = Math.max(y, top + 60)
  let footer: ReactNode = null
  if (project.footer.trim()) {
    footer = <text x={PAD} y={bottom + 30} fontSize={13} fill={C.muted}>{project.footer}</text>
    y = bottom + 30
  } else y = bottom
  const H = y + PAD
  const edges = Array.from({ length: cols + 1 }, (_, i) => x0 + i * colW)
  const label = (d: string) => (cal?.unit === 'month' ? month.format(Date.parse(d)) : fmtDay(d))

  return (
    <svg ref={ref} xmlns="http://www.w3.org/2000/svg" width={W} height={H} viewBox={`0 0 ${W} ${H}`}
      fontFamily={FONT} className="chart" role="img" aria-label={title}>
      <rect width={W} height={H} fill="#fff" />
      <image href={logoUrl} x={W - PAD - 150} y={22} width={150} height={150 * 80 / 326} />
      <text x={W / 2} y={58} fontSize={titleSize} fontWeight="bold" fill={C.ink} textAnchor="middle">{title}</text>
      {title && [-1, 1].map(s => <circle key={s} cx={W / 2 + s * (titleW / 2 + 44)} cy={46} r={12} fill={C.now} />)}

      <StageBands bands={stages.map(s => ({ name: s.name, x1: xAt(s.start), x2: xAt(addDays(s.end, 1)) }))}
        y={stageY} fill={C.ink} min={PAD} max={W - PAD} />
      <rect x={0} y={headTop} width={W} height={headH} fill={C.head} />
      <text x={PAD + 14} y={headTop + headH / 2 + 7} fontSize={19} fontWeight="bold" fill={C.ink}>Timeline</text>
      {now >= 0 && <>
        <rect x={edges[now]} y={headTop} width={colW} height={headH} fill={C.now} />
        <rect x={edges[now]} y={top} width={colW} height={bottom - top} fill={C.nowTint} />
      </>}
      {cal?.dates.slice(0, -1).map((d, i) => (
        <g key={d}>
          {i > 0 && i !== now && i !== now + 1 && <line x1={edges[i]} x2={edges[i]} y1={headTop + 16} y2={headTop + headH - 16} stroke={C.grid} />}
          <text x={edges[i] + colW / 2} y={headTop + headH / 2 + 6} fontSize={16} fill={C.ink} textAnchor="middle">{label(d)}</text>
        </g>
      ))}

      {edges.map((x, i) => <line key={i} x1={x} x2={x} y1={top} y2={bottom} stroke={C.grid} />)}
      {[top, ...seps.slice(0, -1), bottom].map((sy, i) => <line key={i} x1={x0} x2={x1} y1={sy} y2={sy} stroke={C.grid} />)}
      {rows}
      {footer}
    </svg>
  )
}
