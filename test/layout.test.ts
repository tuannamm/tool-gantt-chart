import { test } from 'node:test'
import assert from 'node:assert/strict'
import { barSpan, buildAxis, sortMilestones, stageBands, stageOfTask, xClamp, calendarAxis, calendarX, fmtDate, fmtDay, guessIcon, MIN_BAR, rangeError, stageTotals, totalEstimate, xOfDate } from '../src/layout.ts'
import type { Project } from '../src/types.ts'
import { parseProject } from '../src/useProject.ts'
import { newId, newMilestone, newTask, sampleProject, withTemplate } from '../src/sample.ts'

test('axis = sorted unique event dates with increasing, non-overlapping x', () => {
  const ticks = buildAxis(sampleProject(), 500)
  assert.deepEqual(ticks.map(t => fmtDate(t.date)), ['Nov 1', 'Nov 5', 'Nov 12', 'Nov 17', 'Nov 18', 'Nov 19', 'Nov 23', 'Nov 24'])
  assert.equal(ticks[0].x, 500)
  for (let i = 1; i < ticks.length; i++) {
    assert.ok(ticks[i].x - ticks[i - 1].x >= (ticks[i].need + ticks[i - 1].need) / 2, `labels overlap at ${ticks[i].date}`)
  }
  const nov24 = ticks.at(-1)!
  assert.deepEqual(nov24.markers, ['Release PRO'])
  assert.deepEqual(nov24.milestones, ['★ Milestone 3', 'Deployment', 'Completed'])
})

test('bars: ranges, same-day blocks, invalid input', () => {
  const x = new Map([['2026-11-01', 100], ['2026-11-05', 200]])
  assert.deepEqual(barSpan(x, '2026-11-01', '2026-11-05'), { x: 100, w: 100 })
  assert.deepEqual(barSpan(x, '2026-11-05', '2026-11-05'), { x: 200 - MIN_BAR / 2, w: MIN_BAR })
  assert.equal(barSpan(x, '2026-11-05', '2026-11-01'), null)
  assert.equal(barSpan(x, '', '2026-11-05'), null)
  assert.equal(rangeError('2026-11-05', '2026-11-01'), 'End date is before start date')
  assert.equal(rangeError('2026-11-01', ''), '')
})

test('tasks with bad ranges add no ticks', () => {
  const p = sampleProject()
  p.phases = [{ id: 'x', name: 'x', tasks: [{ id: 't', name: 't', pic: '', estimate: '', start: '2026-12-09', end: '2026-12-01', label: '' }] }]
  p.milestones = []
  assert.deepEqual(buildAxis(p, 0), [])
})

test('total estimate: sums numbers, accepts a decimal comma, skips the rest', () => {
  const p = sampleProject()
  const task = (estimate: string) => ({ id: estimate, name: '', pic: '', estimate, start: '', end: '', label: '' })
  p.phases = [{ id: 'a', name: 'a', tasks: [task('2,5'), task('0.1'), task('0.2'), task('n/a'), task(''), task('3')] }]
  assert.equal(totalEstimate(p), '5.8')
  p.phases = [{ id: 'a', name: 'a', tasks: [task('tbd')] }]
  assert.equal(totalEstimate(p), null)
})

test('ids work without crypto.randomUUID (plain-http pages) and do not repeat', () => {
  const randomUUID = crypto.randomUUID
  Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true })
  try {
    const ids = new Set(Array.from({ length: 1000 }, newId))
    assert.equal(ids.size, 1000)
    assert.match(newId(), /^[0-9a-f]{24}$/)
  } finally {
    Object.defineProperty(crypto, 'randomUUID', { value: randomUUID, configurable: true })
  }
})

test('xOfDate: ticks exactly, days in between proportionally, null outside', () => {
  const ticks = buildAxis(sampleProject(), 100)
  const [a, b] = ticks
  assert.equal(xOfDate(ticks, a.date), a.x)
  assert.equal(xOfDate(ticks, '2026-11-03'), a.x + (b.x - a.x) / 2) // Nov 1 -> Nov 5
  assert.equal(xOfDate(ticks, '2026-10-31'), null)
  assert.equal(xOfDate(ticks, '2026-12-01'), null)
  assert.equal(fmtDay('2026-07-01'), '01 Jul')
})

test('files from before templates still open, with defaults for the new fields', () => {
  const old = { title: 'T', subtitle: 'S', phases: [{ name: 'Testing', tasks: [{ name: 'x', start: '2026-11-01' }] }] }
  const p = parseProject(old)
  assert.equal(p.template, 'timeline')
  assert.equal(p.statusDate, '')
  assert.deepEqual([p.phases[0].icon, p.phases[0].output], ['', ''])
  assert.equal(p.phases[0].tasks[0].status, '')
  const bad = parseProject({ template: 'nope', phases: [{ icon: 'x', tasks: [{ status: 'x' }] }], milestones: [{ color: 'x' }, { color: 'teal' }] })
  assert.deepEqual([bad.template, bad.phases[0].icon, bad.phases[0].tasks[0].status], ['timeline', '', ''])
  assert.deepEqual(bad.milestones.map(m => m.color), ['', 'teal'])
  const s = sampleProject()
  assert.deepEqual(parseProject(JSON.parse(JSON.stringify(s))), s) // round trip keeps everything
})

test('switching template swaps only an untouched default title', () => {
  const p = sampleProject()
  assert.equal(withTemplate(p, 'milestones').title, 'PROJECT MILESTONES')
  assert.equal(withTemplate(withTemplate(p, 'milestones'), 'timeline').title, 'GANTT CHART')
  assert.equal(withTemplate({ ...p, title: 'Mine' }, 'milestones').title, 'Mine')
  assert.deepEqual(['Testing', 'Deploy', 'Dataset prep', 'Kick-off', 'Weird'].map(guessIcon), ['test', 'deploy', 'data', 'team', 'layers'])
})

test('calendar axis: equal columns of days, months for long spans, x clamped', () => {
  const p = sampleProject() // bars Nov 1 – Nov 24
  const c = calendarAxis(p)!
  assert.equal(c.unit, 'day')
  assert.deepEqual([c.dates.length - 1, c.dates[0], c.dates[1], c.dates.at(-1)], [8, '2026-11-01', '2026-11-04', '2026-11-25'])
  assert.equal(calendarX(c, 0, 30, '2026-11-02'), 10)
  assert.equal(calendarX(c, 0, 30, '2026-10-01'), 0)
  assert.equal(calendarX(c, 0, 30, '2027-01-01'), 240)
  p.phases = [{ ...p.phases[0], tasks: [newTask({ start: '2026-11-05', end: '2027-06-10' }), newTask({ start: '2026-12-09', end: '2026-12-01' })] }]
  const m = calendarAxis(p)!
  assert.deepEqual([m.unit, m.dates.length - 1, m.dates[0], m.dates.at(-1)], ['month', 8, '2026-11-01', '2027-07-01'])
  assert.equal(calendarX(m, 0, 30, '2026-11-16'), 15)
  p.phases = [{ ...p.phases[0], tasks: [newTask()] }]
  assert.equal(calendarAxis(p), null)
  p.phases = [{ ...p.phases[0], tasks: [newTask({ start: '2026-11-05', end: '2026-11-24' })] }]
  const forced = (scale: Project['scale']) => calendarAxis({ ...p, scale })!
  assert.deepEqual([forced('auto').unit, forced('month').unit, forced('month').dates.length - 1], ['day', 'month', 1])
  p.phases[0].tasks[0].end = '2027-06-10'
  assert.equal(forced('auto').unit, 'month')
  const fd = forced('day')
  assert.deepEqual([fd.unit, fd.dates.length - 1 <= 10, fd.dates[0]], ['day', true, '2026-11-05'])
  assert.equal(parseProject({ scale: 'x', phases: [] }).scale, 'auto')
  assert.equal(parseProject({ template: 'board', phases: [] }).template, 'board')
  const pl = parseProject({ template: 'plan', phases: [{ tasks: [{ priority: 'high' }, { priority: 'x' }, {}] }] })
  assert.deepEqual([pl.template, ...pl.phases[0].tasks.map(t => t.priority)], ['plan', 'high', '', ''])
})

test('milestone and marker without text add no label', () => {
  const p = { ...sampleProject(), milestones: [newMilestone({ date: '2026-11-30' }), newMilestone({ date: '2026-11-30', kind: 'marker' })] }
  const t = buildAxis(p, 0).find(x => x.date === '2026-11-30')
  assert.deepEqual([t?.milestones, t?.markers, t?.line], [[], [], true])
})

test('milestones sort by date: stable, undated last, also on import', () => {
  const m = (date: string, text: string) => newMilestone({ date, text })
  const out = sortMilestones([m('', 'new'), m('2026-11-24', 'b'), m('2026-11-01', 'a'), m('2026-11-24', 'c')])
  assert.deepEqual(out.map(x => x.text), ['a', 'b', 'c', 'new'])
  const p = parseProject({ phases: [], milestones: [m('2026-12-01', 'late'), m('2026-11-01', 'early')] })
  assert.deepEqual(p.milestones.map(x => x.text), ['early', 'late'])
  assert.deepEqual(sampleProject().milestones.map(x => x.date), sampleProject().milestones.map(x => x.date).sort())
})

test('big phases: usable ranges only, tasks must sit inside one, band x held to the axis ends', () => {
  const p = sampleProject()
  p.stages = [
    { id: 's1', name: 'Phase 1', start: '2026-11-03', end: '2026-11-12' },
    { id: 's2', name: 'Phase 2', start: '2026-12-07', end: '2026-12-11' },
    { id: 's3', name: 'no dates', start: '', end: '' },
  ]
  assert.deepEqual(stageBands(p).map(s => s.id), ['s1', 's2'])
  const at = (start: string, end: string) => stageOfTask(p, newTask({ start, end }))?.id
  assert.deepEqual([at('2026-11-03', '2026-11-12'), at('2026-12-08', '2026-12-09'), at('2026-11-10', '2026-12-08'), at('2026-10-01', '2026-10-02'), at('', '')],
    ['s1', 's2', undefined, undefined, undefined])
  const ticks = buildAxis(p, 100)
  assert.equal(xClamp(ticks, '2000-01-01'), ticks[0].x)
  assert.equal(xClamp(ticks, '2999-01-01'), ticks.at(-1)?.x)
  const q = parseProject(JSON.parse(JSON.stringify(p)))
  assert.deepEqual(q.stages, p.stages)
  const t = (id: string, estimate: string, start: string, end: string) => newTask({ id, estimate, start, end })
  p.phases = [{ id: 'a', name: 'a', tasks: [t('1', '2', '2026-11-03', '2026-11-04'), t('2', '1.5', '2026-11-05', '2026-11-06'), t('3', '4', '2026-12-08', '2026-12-09'), t('4', '9', '2027-01-01', '2027-01-02')] }]
  assert.deepEqual(stageTotals(p), [{ name: 'Phase 1', total: '3.5' }, { name: 'Phase 2', total: '4' }])
  assert.deepEqual(parseProject({ phases: [], stages: [{ name: 'x' }] }).stages.map(s => [s.start, s.end]), [['', '']])
})
