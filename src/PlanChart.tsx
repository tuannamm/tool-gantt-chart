import type { ReactNode, Ref } from 'react'
import type { Priority, Project } from './types.ts'
import logoUrl from '@dgtx/ui-frek/assets/logo-horizontal.svg?inline'
import { addDays, calendarAxis, calendarX, fmtDate, hasBar, STAGE_H, stageBands, wrap } from './layout.ts'
import { StageBands } from './StageBands.tsx'

// Phase colours after the reference (orange, green, navy, then more). The band takes white text,
// the task bar dark text; both darker than the reference so the text keeps 4.5:1.
const HUES = [
  { band: '#c2410c', bar: '#fbab8f' }, { band: '#15803d', bar: '#6fdf8a' }, { band: '#0c4a6e', bar: '#7dd3f0' },
  { band: '#7e22ce', bar: '#d6b4f8' }, { band: '#0f766e', bar: '#80dccf' }, { band: '#b91c1c', bar: '#fca5a5' },
]
const C = { ink: '#14183a', muted: '#3f4655', head: '#62666e', grid: '#d3d7de', frame: '#8a909a' }
// The level is in the shape as well as the colour. Yellow alone is too faint on white, so it is outlined.
const PRIORITY: Record<Exclude<Priority, ''>, { label: string, fill: string, stroke: string }> = {
  high: { label: 'High Priority', fill: '#dc2626', stroke: '#fff' },
  medium: { label: 'Medium Priority', fill: '#f5b700', stroke: '#8a5300' },
  low: { label: 'Low Priority', fill: '#16a34a', stroke: '#fff' },
}
const FONT = 'Poppins, "Segoe UI", Tahoma, Verdana, "DejaVu Sans", sans-serif'
const W = 1280, PAD = 28, GUT = 200, RIGHT = 112 // GUT: room for names left of the earliest bars; RIGHT: for date labels
const GAP = 12, BAND = 28, LINE = 18, PILL = 120 // bars narrower than PILL take their text beside them
const month = new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' })

const mark = (p: Exclude<Priority, ''>, x: number, y: number, r = 9) => {
  const { fill, stroke } = PRIORITY[p]
  return p === 'medium'
    ? <circle cx={x} cy={y} r={r} fill={fill} stroke={stroke} strokeWidth={2} />
    : <path d={p === 'high' ? `M${x} ${y - r}L${x + r} ${y + r * 0.75}H${x - r}Z` : `M${x} ${y + r}L${x + r} ${y - r * 0.75}H${x - r}Z`}
      fill={fill} stroke={stroke} strokeWidth={2} strokeLinejoin="round" />
}

// "High-level project plan": month pills on top, a coloured band per phase over its date range, then one
// row per task with its name left of the bar, its bar text inside, its dates right and its priority on the corner.
export function PlanChart({ project, ref }: { project: Project; ref?: Ref<SVGSVGElement> }) {
  const cal = calendarAxis(project)
  const x0 = PAD + GUT, x1 = W - PAD - RIGHT
  const cols = cal ? cal.dates.length - 1 : 0
  const colW = cols ? (x1 - x0) / cols : 0
  const xAt = (d: string) => (cal ? calendarX(cal, x0, colW, d) : x0)
  const edges = Array.from({ length: cols + 1 }, (_, i) => x0 + i * colW)
  const years = cal && cal.dates[0].slice(0, 4) !== cal.dates[cols - 1].slice(0, 4)
  const head = (d: string) => (cal?.unit === 'month'
    ? `${month.format(Date.parse(d))}${years ? ` '${d.slice(2, 4)}` : ''}`
    : fmtDate(d)).toUpperCase()

  const title = [project.subtitle.trim(), project.title.trim()].filter(Boolean).join(' ')
  const titleSize = Math.min(40, (W - 2 * PAD - 150 - 20) / Math.max(1, title.length * 0.62))
  const stages = cal ? stageBands(project) : []
  const stageY = 84, headTop = stages.length ? stageY + STAGE_H + 8 : stageY, headH = 44, top = headTop + headH + 16

  let y = top
  const rows: ReactNode[] = []
  const used = new Set<Exclude<Priority, ''>>()
  project.phases.forEach((ph, pi) => {
    const hue = HUES[pi % HUES.length]
    const dated = ph.tasks.filter(t => hasBar(t.start, t.end))
    const from = dated.length ? xAt(dated.reduce((m, t) => (t.start < m ? t.start : m), dated[0].start)) : x0
    const to = dated.length ? xAt(addDays(dated.reduce((m, t) => (t.end > m ? t.end : m), dated[0].end), 1)) : x0
    const name = (ph.name || `Phase ${pi + 1}`).toUpperCase()
    // A short phase widens its band to fit the name, shifted left to stay on the chart.
    const bw = Math.max(to - from, name.length * 9.6 + 28)
    const bx = Math.min(from, W - PAD - bw)
    rows.push(
      <g key={ph.id}>
        <rect x={bx} y={y} width={bw} height={BAND} rx={3} fill={hue.band} />
        <text x={bx + 14} y={y + 19} fontSize={15} fontWeight="bold" fill="#fff">{name}</text>
      </g>,
    )
    y += BAND + 12

    for (const task of ph.tasks) {
      const has = hasBar(task.start, task.end)
      const bx1 = has ? xAt(task.start) : x0, bx2 = has ? xAt(addDays(task.end, 1)) : x0
      const w = bx2 - bx1
      const text = task.label.trim()
      const inLines = has && text && w >= PILL ? wrap(text, w - 28, 7.4) : []
      const outLines = text && !inLines.length ? wrap(text, Math.min(260, W - PAD - bx2 - GAP), 7.4) : []
      const dates = has ? (task.start === task.end ? fmtDate(task.start) : `${fmtDate(task.start)}-${fmtDate(task.end)}`) : ''
      const beside = [...outLines.map(s => ({ s, date: false })), ...(dates ? [{ s: dates, date: true }] : [])]
      const names = wrap(task.name, Math.min(240, bx1 - GAP - PAD), 8.2)
      const barH = has ? Math.max(30, inLines.length * LINE + 16) : 0
      const h = Math.max(barH, names.length * LINE, beside.length * LINE)
      const cy = y + h / 2
      const lineY = (n: number, i: number) => cy + 5 - (n - 1) * LINE / 2 + i * LINE
      if (has && task.priority) used.add(task.priority)
      rows.push(
        <g key={task.id}>
          {/* White halo: grid lines run under the text beside the bars. */}
          <g fontSize={15} fill={C.ink} textAnchor="end" stroke="#fff" strokeWidth={4} paintOrder="stroke">
            {names.map((s, i) => <text key={i} x={bx1 - GAP} y={lineY(names.length, i)}>{s}</text>)}
          </g>
          {has && <rect x={bx1} y={cy - barH / 2} width={w} height={barH} rx={6} fill={hue.bar} />}
          <g fontSize={13.5} fill={C.ink}>
            {inLines.map((s, i) => <text key={i} x={bx1 + 14} y={lineY(inLines.length, i)}>{s}</text>)}
          </g>
          <g fontSize={13.5} stroke="#fff" strokeWidth={4} paintOrder="stroke">
            {beside.map(({ s, date }, i) => (
              <text key={i} x={bx2 + GAP} y={lineY(beside.length, i)} fill={date ? C.muted : C.ink}
                fontStyle={date ? 'italic' : undefined} fontSize={date ? 13 : undefined}>{s}</text>
            ))}
          </g>
          {has && task.priority && mark(task.priority, w >= 40 ? bx2 - 16 : bx1 + w / 2, cy - barH / 2)}
        </g>,
      )
      y += h + 16
    }
    y += 8
  })
  const bottom = Math.max(y, top + 40)
  y = bottom

  let legend: ReactNode = null
  if (used.size) {
    const items = (['high', 'medium', 'low'] as const).filter(p => used.has(p))
    const lh = 44 + items.length * 30
    legend = (
      <g>
        <rect x={PAD} y={y} width={200} height={lh} rx={6} fill="#fff" stroke={C.frame} strokeWidth={1.5} />
        <text x={PAD + 16} y={y + 28} fontSize={16} fontWeight="bold" fill={C.ink}>Legend</text>
        {items.map((p, i) => (
          <g key={p}>
            {mark(p, PAD + 27, y + 54 + i * 30)}
            <text x={PAD + 46} y={y + 59 + i * 30} fontSize={14} fill={C.ink}>{PRIORITY[p].label}</text>
          </g>
        ))}
      </g>
    )
    y += lh + 12
  }
  let footer: ReactNode = null
  if (project.footer.trim()) {
    footer = <text x={PAD} y={y + 18} fontSize={13} fill={C.muted}>{project.footer}</text>
    y += 30
  }
  const H = y + PAD

  return (
    <svg ref={ref} xmlns="http://www.w3.org/2000/svg" width={W} height={H} viewBox={`0 0 ${W} ${H}`}
      fontFamily={FONT} className="chart" role="img" aria-label={title}>
      <rect width={W} height={H} fill="#fff" />
      <image href={logoUrl} x={W - PAD - 150} y={22} width={150} height={150 * 80 / 326} />
      <text x={PAD} y={56} fontSize={titleSize} fontWeight="bold" fill={C.ink}>{title}</text>
      <StageBands bands={stages.map(s => ({ name: s.name, x1: xAt(s.start), x2: xAt(addDays(s.end, 1)) }))}
        y={stageY} fill={C.ink} min={PAD} max={W - PAD} />
      {cal?.dates.slice(0, -1).map((d, i) => (
        <g key={d}>
          <rect x={edges[i] + 5} y={headTop} width={colW - 10} height={headH} rx={6} fill={C.head} />
          <text x={edges[i] + colW / 2} y={headTop + headH / 2 + 6} fontSize={16} fontWeight="bold" fill="#fff" textAnchor="middle">{head(d)}</text>
        </g>
      ))}
      {edges.slice(1, -1).map((x, i) => <line key={i} x1={x} x2={x} y1={headTop + headH + 8} y2={bottom - 8} stroke={C.grid} />)}
      {rows}
      {legend}
      {footer}
    </svg>
  )
}
