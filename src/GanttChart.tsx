import type { ReactNode, Ref } from 'react'
import type { Project } from './types.ts'
import { barSpan, buildAxis, fmtDate, STAGE_H, stageBands, stageTotals, totalEstimate, xClamp } from './layout.ts'
import { StageBands } from './StageBands.tsx'
// Inlined as a data URI so the exported image carries the logo (an <img> raster can't fetch URLs).
import logoUrl from '@dgtx/ui-frek/assets/logo-horizontal.svg?inline'

// Colours follow the reference chart; label orange/red darkened to stay readable on white.
const C = {
  navy: '#0b3d91', band: '#d6e9fb', bar: '#0a72c9', red: '#d4141b',
  blue: '#1f3fd1', orange: '#b45309', grid: '#3a63c9',
}
const FONT = 'Tahoma, Verdana, "DejaVu Sans", sans-serif'
const TARGET_W = 1280 // reference chart width; narrower axes are stretched to fill it
const PAD = 20, ROW = 25, BAND = 24, PHASE_GAP = 12, LINE = 12.5, CHAR = 7

export function GanttChart({ project, ref }: { project: Project; ref?: Ref<SVGSVGElement> }) {
  const tasks = project.phases.flatMap(p => p.tasks)
  const nameW = Math.max(190, ...tasks.map(t => t.name.length * CHAR), ...project.phases.map(p => p.name.length * 10.5)) + 24
  const picW = Math.max(100, ...tasks.map(t => t.pic.length * CHAR)) + 24
  const estW = 120
  const nameX = PAD + 10, picX = nameX + nameW, estCx = picX + picW + estW / 2
  const x0 = picX + picW + estW + 24
  const ticks = buildAxis(project, x0)
  const end = ticks.at(-1)
  if (end && end.x > x0) {
    const k = (TARGET_W - PAD - end.need / 2 - 10 - x0) / (end.x - x0)
    if (k > 1) for (const t of ticks) t.x = x0 + (t.x - x0) * k
  }
  const tickX = new Map(ticks.map(t => [t.date, t.x]))
  const last = ticks.at(-1)
  const W = Math.max(TARGET_W, (last ? last.x + last.need / 2 + 10 : picX + picW + estW) + PAD)

  const maxMs = Math.max(0, ...ticks.map(t => t.milestones.length))
  const stages = ticks.length ? stageBands(project) : []
  let y = 116
  const stageY = y
  if (stages.length) y += STAGE_H + 10
  const msTop = y
  if (maxMs) y += maxMs * LINE + 6
  const markerY = y + 12
  if (ticks.some(t => t.markers.length)) y += 18
  const dateY = y + 18
  // Man-day box under the logo: one row per big phase, then the total. It may push the grid down.
  const total = totalEstimate(project)
  const sums = total === null ? [] : [...stageTotals(project), { name: 'Total', total }]
  const boxTop = 76, boxH = sums.length * 18 + 12
  const boxW = Math.max(170, ...sums.map(s => s.name.length * 8 + 70))
  y = Math.max(y + 28, sums.length ? boxTop + boxH + 6 : 0)
  const gridTop = y

  const bands: ReactNode[] = [], rows: ReactNode[] = []
  project.phases.forEach((ph, pi) => {
    bands.push(
      <g key={ph.id} fontWeight="bold" fill={C.navy}>
        <rect x={PAD} y={y} width={W - 2 * PAD} height={BAND} fill={C.band} />
        <text x={nameX} y={y + 17} fontSize={15}>{ph.name.toUpperCase()}</text>
        {pi === 0 && <text x={picX} y={y + 17} fontSize={14}>PIC</text>}
        {pi === 0 && <text x={estCx} y={y + 17} fontSize={14} textAnchor="middle">Estimates (md)</text>}
      </g>,
    )
    y += BAND + 6
    for (const t of ph.tasks) {
      const cy = y + ROW / 2
      // A one-day task is a dot, not a block; keep the label clear of it.
      const bar = barSpan(tickX, t.start, t.end)
      const dot = !!bar && t.start === t.end
      const span = bar && dot ? { x: bar.x + bar.w / 2 - 8, w: 16 } : bar
      let label: ReactNode = null
      if (span && t.label) {
        const right = span.x + span.w + 6
        const fits = right + t.label.length * 6.5 <= W - PAD
        label = (
          <text x={fits ? right : span.x - 6} y={cy + 4} textAnchor={fits ? 'start' : 'end'} fontSize={11} fontWeight="bold" fill={C.orange}>
            {t.label}
          </text>
        )
      }
      rows.push(
        <g key={t.id} fontSize={13} fill={C.navy}>
          <text x={nameX} y={cy + 4.5}>{t.name}</text>
          <text x={picX} y={cy + 4.5}>{t.pic}</text>
          <text x={estCx} y={cy + 4.5} textAnchor="middle">{t.estimate}</text>
          {span && (dot
            ? <circle cx={span.x + 8} cy={cy} r={8} fill={C.bar} />
            : <rect x={span.x} y={cy - 8} width={span.w} height={16} fill={C.bar} />)}
          {label}
        </g>,
      )
      y += ROW
    }
    y += PHASE_GAP
  })
  const gridBottom = Math.max(gridTop, y - PHASE_GAP)

  let footer: ReactNode = null
  if (project.footer.trim()) {
    y += 8
    footer = (
      <g fontWeight="bold" fill={C.navy}>
        <rect x={PAD} y={y} width={W - 2 * PAD} height={32} fill={C.band} />
        <text x={nameX} y={y + 21} fontSize={16}>★ {project.footer}</text>
      </g>
    )
    y += 32
  }
  const H = y + PAD

  return (
    <svg ref={ref} xmlns="http://www.w3.org/2000/svg" width={W} height={H} viewBox={`0 0 ${W} ${H}`}
      fontFamily={FONT} className="chart" role="img" aria-label={`${project.title} ${project.subtitle}`}>
      <rect width={W} height={H} fill="#fff" />
      {/* Official file, never recoloured; 170px keeps it above the kit's 120px floor. */}
      <image href={logoUrl} x={PAD} y={22} width={170} height={170 * 80 / 326} />
      <g fontWeight="bold" fill={C.navy} textAnchor="middle">
        <text x={W / 2} y={62} fontSize={44}>{project.title}</text>
        <text x={W / 2} y={102} fontSize={34}>{project.subtitle}</text>
      </g>
      <StageBands bands={stages.map(s => ({ name: s.name, x1: xClamp(ticks, s.start), x2: xClamp(ticks, s.end) }))}
        y={stageY} fill={C.navy} min={PAD} max={W - PAD} />
      {sums.length > 0 && (
        <g fontSize={13} fill={C.navy}>
          <rect x={PAD} y={boxTop} width={boxW} height={boxH} rx={4} fill="#fff" stroke={C.navy} strokeWidth={1.5} />
          {sums.map((s, i) => (
            <g key={i} fontWeight={i === sums.length - 1 ? 'bold' : undefined}>
              <text x={PAD + 10} y={boxTop + 24 + i * 18 - 6}>{s.name}</text>
              <text x={PAD + boxW - 10} y={boxTop + 24 + i * 18 - 6} textAnchor="end">{s.total} md</text>
            </g>
          ))}
        </g>
      )}
      {ticks.map(t => {
        const ms = t.line
        return (
          <g key={t.date} textAnchor="middle">
            {!ms && <line x1={t.x} x2={t.x} y1={gridTop} y2={gridBottom} stroke={C.grid} strokeWidth={1} strokeDasharray="1.5 2.5" />}
            {t.milestones.map((s, i) => (
              <text key={i} x={t.x} y={msTop + (maxMs - t.milestones.length + i + 1) * LINE - 2} fontSize={10.5} fill={C.red}>{s}</text>
            ))}
            {t.markers.length > 0 && (
              <text x={t.x} y={markerY} fontSize={12} fontWeight="bold" fill={C.blue}>{t.markers.join(' / ')}</text>
            )}
            <text x={t.x} y={dateY} fontSize={15} fontWeight="bold" fill={C.navy}>{fmtDate(t.date)}</text>
          </g>
        )
      })}
      {bands}
      {/* Milestone lines cross the phase bands; bars still paint over them. */}
      {ticks.filter(t => t.line).map(t => (
        <line key={t.date} x1={t.x} x2={t.x} y1={gridTop} y2={gridBottom} stroke={C.red} strokeWidth={1} strokeDasharray="3 3" />
      ))}
      {rows}
      {footer}
    </svg>
  )
}
