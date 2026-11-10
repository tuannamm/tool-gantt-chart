import type { PhaseIcon, Project, Task } from './types.ts'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAY = 86_400_000
export const PX_PER_DAY = 14
export const MIN_GAP = 36
export const MIN_BAR = 24
// Rough average glyph widths (px) used to keep labels of neighbouring ticks from overlapping.
export const CHAR = { date: 9, marker: 7.5, milestone: 6.2 }

const time = (d: string) => Date.parse(`${d}T00:00:00Z`)
export const isDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(time(d))
export const fmtDate = (d: string) => {
  const t = new Date(time(d))
  return `${MONTHS[t.getUTCMonth()]} ${t.getUTCDate()}`
}
// "05 Nov", as the milestones template labels bar ends.
export const fmtDay = (d: string) => {
  const t = new Date(time(d))
  return `${String(t.getUTCDate()).padStart(2, '0')} ${MONTHS[t.getUTCMonth()]}`
}
export const today = () => {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
}
// Icon for a phase tile when none was picked, from words in its name.
const ICON_WORDS: [RegExp, PhaseIcon][] = [
  [/test|qa|qc|uat|verif/i, 'test'], [/deploy|release|launch|go.?live/i, 'deploy'], [/data/i, 'data'],
  [/design|ux|ui/i, 'design'], [/integrat|workflow|pipeline/i, 'workflow'], [/handover|onboard|user|team|kick/i, 'team'],
  [/\bai\b|model|train/i, 'ai'], [/doc|report|spec/i, 'docs'], [/implement|develop|build|code/i, 'code'],
]
export const guessIcon = (name: string): PhaseIcon => ICON_WORDS.find(([re]) => re.test(name))?.[1] ?? 'layers'
export const rangeError = (start: string, end: string) =>
  isDate(start) && isDate(end) && end < start ? 'End date is before start date' : ''
export const hasBar = (start: string, end: string) => isDate(start) && isDate(end) && end >= start
const iso = (t: number) => new Date(t).toISOString().slice(0, 10)
// Oldest first, undated last (a fresh row stays at the bottom until it gets a date). Stable, so equal dates keep their order.
export const sortMilestones = <T extends { date: string }>(list: T[]) =>
  list.sort((a, b) => (a.date === b.date ? 0 : !a.date ? 1 : !b.date ? -1 : a.date < b.date ? -1 : 1))
// The big phase whose date range holds the whole bar of a task; none for an undated task or one sticking out.
export const stageOfTask = (p: Project, t: Task) =>
  hasBar(t.start, t.end) ? p.stages.find(s => hasBar(s.start, s.end) && s.start <= t.start && t.end <= s.end) : undefined

// Big phases with a usable range; the charts draw each as a band over the dates it covers.
export const stageBands = (p: Project) => p.stages.filter(s => hasBar(s.start, s.end))
export const STAGE_H = 28
// Man-days inside each big phase; a phase with no numeric estimate counts 0.
export const stageTotals = (p: Project) => {
  const tasks = p.phases.flatMap(ph => ph.tasks)
  return stageBands(p).map(s => ({ name: s.name, total: totalEstimate(p, tasks.filter(t => stageOfTask(p, t) === s)) ?? '0' }))
}
export const addDays = (d: string, n: number) => iso(time(d) + n * DAY)

// Greedy word wrap by an average glyph width; good enough for system fonts at these sizes.
export function wrap(text: string, width: number, charW: number) {
  const max = Math.max(4, Math.floor(width / charW)), lines: string[] = []
  for (const para of text.split('\n')) {
    let line = ''
    for (const word of para.split(/\s+/).filter(Boolean)) {
      if (line && (line + ' ' + word).length > max) { lines.push(line); line = word }
      else line = line ? `${line} ${word}` : word
    }
    if (line) lines.push(line)
  }
  return lines
}

// Sum of the task estimates, as the chart prints it. Estimates are free text: "2,5" counts as 2.5,
// and anything that is not a number is left out. Null when no task has a number.
export function totalEstimate(p: Project, tasks = p.phases.flatMap(ph => ph.tasks)): string | null {
  const nums = tasks
    .map(t => t.estimate.trim().replace(',', '.'))
    .filter(e => e !== '' && Number.isFinite(Number(e)))
    .map(Number)
  if (!nums.length) return null
  return new Intl.NumberFormat('en', { maximumFractionDigits: 2, useGrouping: false }).format(nums.reduce((a, b) => a + b, 0))
}

export type Tick = { date: string; x: number; need: number; markers: string[]; milestones: string[]; line: boolean }

// Ticks are only the dates something happens on (task start/end, milestones), like the reference chart.
// Gap between ticks grows with the day count, but never below what their labels need.
// `need` lets a template whose labels differ say how wide its own label at a date is.
export function buildAxis(p: Project, x0: number, need?: (date: string) => number): Tick[] {
  const byDate = new Map<string, Tick>()
  const at = (date: string) => {
    let t = byDate.get(date)
    if (!t) byDate.set(date, (t = { date, x: 0, need: 0, markers: [], milestones: [], line: false }))
    return t
  }
  for (const t of p.phases.flatMap(ph => ph.tasks)) {
    if (hasBar(t.start, t.end)) { at(t.start); at(t.end) }
  }
  for (const m of p.milestones) {
    if (!isDate(m.date)) continue
    const lines = m.text.split('\n').map(s => s.trim()).filter(Boolean)
    const tick = at(m.date)
    if (m.kind === 'milestone') tick.line = true
    if (!lines.length) continue // no text: the date line still draws, nothing is labelled
    if (m.kind === 'marker') tick.markers.push(lines.join(' '))
    else tick.milestones.push(`★ ${lines[0]}`, ...lines.slice(1))
  }
  const ticks = [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1))
  ticks.forEach((t, i) => {
    t.need = Math.max(
      fmtDate(t.date).length * CHAR.date,
      t.markers.join(' / ').length * CHAR.marker,
      ...t.milestones.map(s => s.length * CHAR.milestone),
      need?.(t.date) ?? 0,
    )
    const prev = ticks[i - 1]
    t.x = prev
      ? prev.x + Math.max((prev.need + t.need) / 2 + 8, MIN_GAP + ((time(t.date) - time(prev.date)) / DAY) * PX_PER_DAY)
      : x0
  })
  return ticks
}

// x of any date inside the axis, between the ticks around it by day count. Null outside the axis.
export function xOfDate(ticks: Tick[], date: string): number | null {
  if (!isDate(date) || !ticks.length || date < ticks[0].date || date > ticks.at(-1)!.date) return null
  const i = ticks.findIndex(t => t.date >= date)
  const b = ticks[i], a = ticks[i - 1]
  if (b.date === date || !a) return b.x
  return a.x + (b.x - a.x) * (time(date) - time(a.date)) / (time(b.date) - time(a.date))
}

// Same-day tasks get a small centred block so they stay visible.
export function barSpan(tickX: Map<string, number>, start: string, end: string) {
  if (!hasBar(start, end)) return null
  const x1 = tickX.get(start), x2 = tickX.get(end)
  if (x1 === undefined || x2 === undefined) return null
  return x2 - x1 >= MIN_BAR ? { x: x1, w: x2 - x1 } : { x: (x1 + x2) / 2 - MIN_BAR / 2, w: MIN_BAR }
}

// Column edges of a calendar axis; the last edge is exclusive.
export type Calendar = { dates: string[], unit: 'day' | 'month' }

// Equal-width columns of a whole number of days, or of months for long projects: the smallest step
// that fits every bar into `max` columns. Null when no task has a valid range.
export function calendarAxis(p: Project, max = 10): Calendar | null {
  const tasks = p.phases.flatMap(ph => ph.tasks).filter(t => hasBar(t.start, t.end))
  if (!tasks.length) return null
  const from = tasks.reduce((m, t) => (t.start < m ? t.start : m), tasks[0].start)
  const to = addDays(tasks.reduce((m, t) => (t.end > m ? t.end : m), tasks[0].end), 1)
  const edges = (n: number, at: (i: number) => string) => Array.from({ length: n + 1 }, (_, i) => at(i))
  const days = (time(to) - time(from)) / DAY
  if (p.scale !== 'month') {
    // Day columns: the smallest round step that fits; when asked for days on a long project, any whole step.
    const step = [1, 2, 3, 4, 7, 14].find(s => Math.ceil(days / s) <= max) ?? (p.scale === 'day' ? Math.ceil(days / max) : 0)
    if (step) return { unit: 'day', dates: edges(Math.ceil(days / step), i => addDays(from, i * step)) }
  }
  const a = new Date(time(from)), b = new Date(time(to))
  const months = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + b.getUTCMonth() - a.getUTCMonth() + (b.getUTCDate() > 1 ? 1 : 0)
  const step = [1, 2, 3, 6].find(s => Math.ceil(months / s) <= max) ?? Math.ceil(months / max / 12) * 12
  return { unit: 'month', dates: edges(Math.ceil(months / step), i => iso(Date.UTC(a.getUTCFullYear(), a.getUTCMonth() + i * step, 1))) }
}

// x of the start of a date on a calendar axis with columns colW wide from x0, clamped to the axis.
export function calendarX(c: Calendar, x0: number, colW: number, date: string) {
  const d = c.dates, i = d.findIndex(e => e > date)
  if (i === 0) return x0
  if (i < 0) return x0 + (d.length - 1) * colW
  return x0 + (i - 1 + (time(date) - time(d[i - 1])) / (time(d[i]) - time(d[i - 1]))) * colW
}

// Axis x of a date on a tick axis, held to its ends so a big phase may start or end off the drawn dates.
export const xClamp = (ticks: Tick[], date: string) =>
  xOfDate(ticks, date) ?? (date < ticks[0].date ? ticks[0].x : ticks[ticks.length - 1].x)
