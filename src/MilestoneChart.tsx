import type { ReactNode, Ref } from 'react'
import { HUES, type Hue, type Project, type TaskStatus } from './types.ts'
import { ICONS } from './icons.ts'
import { PALETTE } from './palette.ts'
import { barSpan, buildAxis, fmtDay, guessIcon, isDate, STAGE_H, stageBands, today, wrap, xClamp, xOfDate } from './layout.ts'
import { StageBands } from './StageBands.tsx'
import logoUrl from '@dgtx/ui-frek/assets/logo-horizontal.svg?inline'

const PHASE_HUES = HUES.map(h => PALETTE[h])
const C = {
  ink: '#111827', grid: '#c7ccd6', cardLine: '#d5dceb', bar: '#3420d8', label: '#3730a3',
  labelTile: '#e3e9fc', red: '#e11d2a', flag: '#0d9488',
}
const STATUS: Record<TaskStatus, string> = { '': '', todo: 'Not started', doing: 'In progress', done: 'Done' }
// Poppins where installed, like the reference; system fonts otherwise, so export needs no embedding.
const FONT = 'Poppins, "Segoe UI", Tahoma, Verdana, "DejaVu Sans", sans-serif'
const TARGET_W = 1280
const PAD = 18, TILE_W = 205, OUT_W = 330, GAP = 18, EDGE = 34 // EDGE: room for the outermost date labels
const LANE = 52, PILL = 18, CAP = 10, ROW_GAP = 10, LINE = 15
const longDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

// "Project milestones / executive view": an overall timeline card on top, then one row per phase with
// a tinted tile, task pills on an event-date axis, and the phase output on the right.
export function MilestoneChart({ project, ref }: { project: Project; ref?: Ref<SVGSVGElement> }) {
  // Card labels: the long date, then each milestone's lines in its own colour, at its date.
  // The date, the diamond and the milestone line take the first colour chosen at that date.
  // A date with a 'milestone' (not just markers) also gets a line down through the phase rows.
  const byDate = new Map<string, { hue: Hue | '', line: boolean, lines: { s: string, hue: Hue | '' }[] }>()
  for (const m of project.milestones) {
    if (!isDate(m.date)) continue
    const at = byDate.get(m.date) ?? { hue: '', line: false, lines: [{ s: longDate.format(Date.parse(m.date)), hue: '' }] }
    at.hue ||= m.color
    at.line ||= m.kind === 'milestone'
    at.lines.push(...m.text.split('\n').map(s => s.trim()).filter(Boolean).map(s => ({ s, hue: m.color })))
    byDate.set(m.date, at)
  }
  for (const at of byDate.values()) at.lines[0].hue = at.hue
  const x0 = PAD + TILE_W + GAP + EDGE
  const ticks = buildAxis(project, x0, date => Math.max(0, ...(byDate.get(date)?.lines ?? []).map(l => l.s.length * 7.2)))
  const outX = (w: number) => w - PAD - OUT_W
  const end = ticks.at(-1)
  if (end && end.x > x0) {
    const k = (outX(TARGET_W) - GAP - EDGE - x0) / (end.x - x0)
    if (k > 1) for (const t of ticks) t.x = x0 + (t.x - x0) * k
  }
  const tickX = new Map(ticks.map(t => [t.date, t.x]))
  const W = Math.max(TARGET_W, (ticks.at(-1)?.x ?? x0) + EDGE + GAP + OUT_W + PAD)

  const labels = [...byDate].map(([date, at]) => ({ date, x: tickX.get(date) ?? 0, ...at }))
  const maxLines = Math.max(2, ...labels.map(l => l.lines.length))
  const stages = ticks.length ? stageBands(project) : []
  const stageY = 100, cardTop = stages.length ? stageY + STAGE_H + 12 : stageY
  const barY = cardTop + 14 + maxLines * LINE + 14
  const cardBottom = barY + 34
  const first = ticks[0]

  const statusX = xOfDate(ticks, project.statusDate || today())
  let y = cardBottom + 16
  const rowsTop = y

  const rows: ReactNode[] = [], seps: number[] = []
  project.phases.forEach((ph, pi) => {
    const pal = PHASE_HUES[pi % PHASE_HUES.length]
    const bars = ph.tasks.flatMap(t => {
      const span = barSpan(tickX, t.start, t.end)
      return span ? [{ t, span }] : []
    })
    const name = wrap(ph.name, TILE_W - 70, 9.4)
    // Continuation lines of a wrapped bullet line up with its text, not its dot.
    const bullets = ph.output.split('\n').map(s => s.trim()).filter(Boolean)
      .flatMap(b => wrap(b, OUT_W - 52, 7.4).map((s, i) => ({ s, first: i === 0 })))
    const outH = bullets.length ? 34 + bullets.length * 18 + 8 : 0
    const h = Math.max(88, bars.length * LANE + 22, name.length * 20 + 36, outH + 12)
    const Icon = ICONS[ph.icon || guessIcon(ph.name)]
    const iconY = y + h / 2 - 18
    rows.push(
      <g key={ph.id}>
        <rect x={PAD} y={y} width={TILE_W} height={h} rx={6} fill={pal.tint} filter="url(#ms-lift)" />
        <rect x={PAD + 12} y={iconY} width={36} height={36} rx={7} fill={pal.solid} />
        <Icon x={PAD + 19} y={iconY + 7} width={22} height={22} color={pal.ink} strokeWidth={2} />
        <g fill={pal.text} fontSize={16} fontWeight="bold">
          {name.map((s, i) => <text key={i} x={PAD + 58} y={y + h / 2 - (name.length - 1) * 10 + i * 20 + 6}>{s}</text>)}
        </g>
        {bars.map(({ t, span }, i) => {
          const cy = y + 14 + i * LANE + LANE - CAP - 8
          const x1 = span.x, x2 = span.x + span.w
          const fill = t.status === 'done' ? pal.solid : t.status === 'doing' ? pal.mid : pal.pale
          // The reference shows the status in the pill; a task without one shows its name instead.
          const text = STATUS[t.status] || t.name
          // Shrinks a little to stay inside a short pill, like the reference; past that it goes beside it.
          const room = span.w - 2 * CAP - 4
          const size = Math.max(8.5, Math.min(11, room / (text.length * 0.62)))
          const inside = text.length * size * 0.62 <= room
          const short = span.w < 64
          // A one-day task is a single dot at its date, with its text beside it.
          const one = t.start === t.end, cx = (x1 + x2) / 2
          return (
            <g key={t.id}>
              {one
                ? <circle cx={cx} cy={cy} r={CAP} fill={pal.solid} />
                : <>
                  <rect x={x1} y={cy - PILL / 2} width={span.w} height={PILL} rx={PILL / 2} fill={fill} />
                  {[x1, x2].map((x, k) => <circle key={k} cx={x} cy={cy} r={CAP} fill={pal.solid} />)}
                </>}
              {/* White halo: milestone and status lines run under these labels. */}
              <g fontSize={13} fontWeight="bold" fill={pal.text} stroke="#fff" strokeWidth={3} paintOrder="stroke">
                {one
                  ? <text x={cx} y={cy - CAP - 7} textAnchor="middle">{fmtDay(t.start)}</text>
                  : <>
                    <text x={x1} y={cy - CAP - 7} textAnchor={short ? 'end' : 'middle'}>{fmtDay(t.start)}</text>
                    <text x={x2} y={cy - CAP - 7} textAnchor={short ? 'start' : 'middle'}>{fmtDay(t.end)}</text>
                  </>}
              </g>
              {text && (inside && !one
                ? <text x={(x1 + x2) / 2} y={cy + size * 0.36} fontSize={size} fontWeight="bold" textAnchor="middle"
                  fill={t.status === 'done' ? pal.ink : C.ink}>{text}</text>
                : <text x={(one ? cx : x2) + CAP + 6} y={cy + 4} fontSize={11} fontWeight="bold" fill={pal.text} stroke="#fff" strokeWidth={3} paintOrder="stroke">{text}</text>)}
            </g>
          )
        })}
        {bullets.length > 0 && (
          <g>
            <rect x={outX(W)} y={y + 6} width={OUT_W} height={outH} rx={8} fill={pal.tint} stroke={pal.solid} strokeWidth={1.5} />
            <text x={outX(W) + 14} y={y + 30} fontSize={15} fontWeight="bold" fill={pal.text}>Output:</text>
            <g fontSize={13.5} fill={C.ink}>
              {bullets.map(({ s, first }, i) => (
                <g key={i}>
                  {first && <text x={outX(W) + 22} y={y + 52 + i * 18}>•</text>}
                  <text x={outX(W) + 36} y={y + 52 + i * 18}>{s}</text>
                </g>
              ))}
            </g>
          </g>
        )}
      </g>,
    )
    y += h + ROW_GAP
    seps.push(y - ROW_GAP / 2)
  })
  const rowsBottom = Math.max(rowsTop, y - ROW_GAP)
  y = rowsBottom + 14

  let footer: ReactNode = null
  if (project.footer.trim()) {
    footer = <text x={PAD} y={y + 16} fontSize={13} fill={C.ink}>{project.footer}</text>
    y += 28
  }
  const H = y + PAD
  // "1266_ACT_French| PROJECT MILESTONES", as the reference writes it.
  const title = [project.subtitle.trim(), project.title.trim()].filter(Boolean).join('| ')

  return (
    <svg ref={ref} xmlns="http://www.w3.org/2000/svg" width={W} height={H} viewBox={`0 0 ${W} ${H}`}
      fontFamily={FONT} className="chart" role="img" aria-label={title}>
      <defs>
        <filter id="ms-lift" x="-10%" y="-10%" width="120%" height="130%">
          <feDropShadow dx={0} dy={2} stdDeviation={2.5} floodColor="#0f172a" floodOpacity={0.12} />
        </filter>
      </defs>
      <rect width={W} height={H} fill="#fff" />
      <text x={PAD} y={52} fontSize={40} fontWeight="bold" fill={C.ink}>{title}</text>
      <text x={PAD + 2} y={80} fontSize={14} fontWeight="bold" fill={C.ink}>EXECUTIVE VIEW</text>
      <image href={logoUrl} x={W - PAD - 150} y={22} width={150} height={150 * 80 / 326} />

      <StageBands bands={stages.map(s => ({ name: s.name, x1: xClamp(ticks, s.start), x2: xClamp(ticks, s.end) }))}
        y={stageY} fill={C.ink} min={PAD} max={W - PAD} />
      <rect x={PAD} y={cardTop} width={W - 2 * PAD} height={cardBottom - cardTop} rx={12} fill="#fff" stroke={C.cardLine} filter="url(#ms-lift)" />
      <rect x={PAD + 12} y={cardTop + 10} width={TILE_W - 24} height={cardBottom - cardTop - 20} rx={8} fill={C.labelTile} />
      <g fontSize={15.5} fontWeight="bold" fill={C.label} textAnchor="middle">
        <text x={PAD + TILE_W / 2} y={(cardTop + cardBottom) / 2 - 4}>Overall Project</text>
        <text x={PAD + TILE_W / 2} y={(cardTop + cardBottom) / 2 + 15}>Timeline</text>
      </g>

      {ticks.map(t => <line key={t.date} x1={t.x} x2={t.x} y1={barY + 14} y2={rowsBottom} stroke={C.grid} strokeDasharray="5 4" />)}
      {seps.slice(0, -1).map((sy, i) => <line key={i} x1={PAD + TILE_W} x2={W - PAD} y1={sy} y2={sy} stroke={C.grid} strokeDasharray="5 4" />)}
      {/* Under the rows, so pills and labels paint over the milestone and status lines. */}
      {labels.filter(l => l.line).map(l => <line key={l.date} x1={l.x} x2={l.x} y1={barY} y2={rowsBottom}
        stroke={l.hue ? PALETTE[l.hue].solid : C.red} strokeWidth={2} />)}
      {statusX !== null && <line x1={statusX} x2={statusX} y1={barY} y2={rowsBottom} stroke={C.red} strokeWidth={2} />}

      {first && <line x1={first.x} x2={Math.max(first.x, ticks.at(-1)!.x)} y1={barY} y2={barY}
        stroke={C.bar} strokeWidth={9} strokeLinecap="round" />}
      {/* Kick-off: the bar starts at a flag. */}
      {first && (
        <g fill={C.flag} stroke={C.flag} strokeWidth={2} strokeLinejoin="round">
          <line x1={first.x - 16} x2={first.x - 16} y1={barY + 9} y2={barY - 9} />
          <path d={`M${first.x - 16} ${barY - 9}h12l-3 4l3 4h-12z`} />
        </g>
      )}
      {labels.map(l => (
        <g key={l.date} textAnchor="middle" fontSize={12} fontWeight="bold">
          {l.lines.map(({ s, hue }, i) => (
            <text key={i} fill={hue ? PALETTE[hue].text : C.label} x={l.x} y={barY - 16 - (l.lines.length - 1 - i) * LINE}>{s}</text>
          ))}
          {l.date !== first?.date && <path d={`M${l.x} ${barY - 10}l10 10l-10 10l-10 -10z`} fill={l.hue ? PALETTE[l.hue].solid : C.red} stroke="#fff" strokeWidth={2} />}
        </g>
      ))}
      {rows}
      {footer}
    </svg>
  )
}
