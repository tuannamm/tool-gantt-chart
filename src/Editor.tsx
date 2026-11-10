import { useLayoutEffect, useRef, useState, type ComponentProps, type MouseEvent } from 'react'
import { CalendarRange, ChevronsDownUp, ChevronsUpDown, Flag, Plus, Trash2 } from 'lucide-react'
import { Button, Card, CardBody, CardHeader, Collapse, DatePicker, DateRangePicker, EmptyState, Field, Icon, Input, Select, Textarea } from '@dgtx/ui-frek'
import { HUES, PHASE_ICONS, type Hue, type Phase, type PhaseIcon, type Priority, PRIORITIES, type Project, SCALES, type Scale, type Task, type TaskStatus } from './types.ts'
import { fmtDate, hasBar, isDate, rangeError, sortMilestones, stageOfTask } from './layout.ts'
import { ICONS } from './icons.ts'
import { PALETTE } from './palette.ts'
import { newId, newMilestone, newPhase, newTask } from './sample.ts'
import { type Strings, useT } from './i18n.tsx'
import { isNoop, transfer } from './reorder.ts'
import { useRowGestures } from './useRowGestures.ts'

export type ConfirmRequest = { title: string; description: string; confirmLabel: string; run: () => void }

// ui-frek's Select treats '' as no value and shows its own placeholder. Here '' is a real option
// (Auto, None, Default), so it shows that option's label instead.
function OptionSelect(p: ComponentProps<typeof Select> & { items: { value: string, label: string }[] }) {
  return <Select {...p} placeholder={p.items.find(o => o.value === '')?.label} />
}

type Drag = { kind: 'phase', pi: number } | { kind: 'task', pi: number, ti: number }
// Where a drop lands: phase insert index (phase drag) or target phase + task insert index (task drag),
// plus the indicator line position relative to the phase list.
type Drop = { to: number, ti: number, top: number, left: number }

const FOCUSABLE = 'input, textarea, button, [tabindex]:not([tabindex="-1"])'

// Moving a row reorders or remounts it, which drops focus; put it back on the same control.
const focusTask = (id: string, i: number) => requestAnimationFrame(() =>
  document.querySelector(`.task[data-id="${CSS.escape(id)}"]`)?.querySelectorAll<HTMLElement>(FOCUSABLE)[Math.max(i, 0)]?.focus())
const focusPhase = (id: string) => requestAnimationFrame(() =>
  document.querySelector(`.phase-title[data-id="${CSS.escape(id)}"]`)?.closest<HTMLElement>('.dtx-collapse__trigger')?.focus())

// Collapsed header line: task count, date span, and date errors so they are not hidden by the fold.
function phaseSummary(ph: Phase, t: Strings) {
  const dates = ph.tasks.flatMap(task => [task.start, task.end]).filter(isDate).sort()
  const errors = ph.tasks.filter(task => rangeError(task.start, task.end)).length
  return (
    <>
      {t.taskCount(ph.tasks.length)}{dates.length > 0 && ` · ${fmtDate(dates[0])} – ${fmtDate(dates[dates.length - 1])}`}
      {errors > 0 && <span className="err-text"> · {t.dateErrors(errors)}</span>}
    </>
  )
}

export function Editor({ project, onChange, confirm }: {
  project: Project; onChange: (p: Project) => void; confirm: (r: ConfirmRequest) => void
}) {
  const t = useT()
  // Fields a template does not draw are hidden while it is chosen; the data is kept either way.
  const ms = project.template === 'milestones', tl = project.template === 'timeline', plan = project.template === 'plan'
  const st = ms || project.template === 'board' // templates that draw the task status
  // Editor-only view state: ids of folded phases. Phases on load start folded; ones added later start open.
  const [closed, setClosed] = useState<Set<string>>(() => new Set(project.phases.map(p => p.id)))
  const allClosed = project.phases.every(p => closed.has(p.id))
  const edit = (fn: (d: Project) => void) => {
    const d = structuredClone(project)
    fn(d)
    sortMilestones(d.milestones)
    onChange(d)
  }
  // Folded state from before a drag, restored when it ends.
  const closedBeforeDrag = useRef(closed)
  const openPhase = (id: string) => setClosed(c => { const n = new Set(c); n.delete(id); return n })

  // Alt+ArrowUp/Down: the keyboard way to do what press-and-hold drag does.
  const moveTask = (pi: number, ti: number, dir: number, focusIndex: number) => {
    const n = project.phases[pi].tasks.length
    const inside = dir < 0 ? ti > 0 : ti < n - 1
    if (!inside && !project.phases[pi + dir]) return
    // Past either end of its phase, a task steps into the neighbouring phase.
    edit(d => {
      const src = d.phases[pi].tasks
      if (inside) return transfer(src, ti, src, dir < 0 ? ti - 1 : ti + 2)
      const dst = d.phases[pi + dir].tasks
      transfer(src, ti, dst, dir < 0 ? dst.length : 0)
    })
    if (!inside) openPhase(project.phases[pi + dir].id)
    focusTask(project.phases[pi].tasks[ti].id, focusIndex)
  }
  // Swipe left, or Alt+Delete. A phase that still has tasks asks first.
  const deletePhase = (pi: number) => {
    const ph = project.phases[pi]
    const run = () => edit(d => { d.phases.splice(pi, 1) })
    if (!ph.tasks.length) return run()
    confirm({
      title: t.deletePhaseTitle(t.phaseRef(ph.name || String(pi + 1))),
      description: t.deletePhaseDesc(ph.tasks.length),
      confirmLabel: t.deletePhaseConfirm,
      run,
    })
  }
  const deleteTask = (pi: number, ti: number) => edit(d => { d.phases[pi].tasks.splice(ti, 1) })
  const deleteMilestone = (mi: number) => edit(d => { d.milestones.splice(mi, 1) })
  // Keyboard deletes leave focus on the neighbouring row, or the phase the task was in.
  const deleteTaskByKey = (pi: number, ti: number, focusIndex: number) => {
    const tasks = project.phases[pi].tasks, next = tasks[ti + 1] ?? tasks[ti - 1]
    deleteTask(pi, ti)
    if (next) focusTask(next.id, focusIndex)
    else focusPhase(project.phases[pi].id)
  }
  const deletePhaseByKey = (pi: number) => {
    const next = project.phases[pi + 1] ?? project.phases[pi - 1]
    deletePhase(pi)
    if (next && !project.phases[pi].tasks.length) focusPhase(next.id)
  }

  const movePhase = (pi: number, dir: number) => {
    if (!project.phases[pi + dir]) return
    edit(d => transfer(d.phases, pi, d.phases, dir < 0 ? pi - 1 : pi + 2))
    focusPhase(project.phases[pi].id)
  }

  const listRef = useRef<HTMLDivElement>(null)
  const triggerAt = (pi: number) => listRef.current?.querySelectorAll<HTMLElement>('.dtx-collapse__trigger')[pi]

  // Rename in place. The kit's phase title sits inside its toggle <button>, which cannot hold an
  // input, so the input is laid over the title instead. Double-click or F2 opens it.
  const [renaming, setRenaming] = useState<string | null>(null)
  const renamingRef = useRef<string | null>(null) // read by blur, which can fire after Enter already finished
  const [renameBox, setRenameBox] = useState<{ top: number, left: number, width: number } | null>(null)
  const startRename = (id: string) => { renamingRef.current = id; setRenaming(id) }
  // A click on the name waits out a possible double-click before toggling, so renaming never
  // folds the phase. Clicks elsewhere on the header (chevron, summary) still toggle at once.
  const clickTimer = useRef(0)
  const DOUBLE_CLICK_MS = 250
  const onTitleClick = (id: string) => (e: MouseEvent) => {
    e.stopPropagation() // keep the kit's trigger from toggling on its own
    clearTimeout(clickTimer.current)
    if (e.detail > 1) return startRename(id)
    clickTimer.current = window.setTimeout(() => setClosed(c => {
      const n = new Set(c)
      if (!n.delete(id)) n.add(id)
      return n
    }), DOUBLE_CLICK_MS)
  }
  const finishRename = (value: string | null, refocusTrigger: boolean) => {
    const id = renamingRef.current
    if (!id) return
    renamingRef.current = null
    setRenaming(null)
    const pi = project.phases.findIndex(p => p.id === id)
    const name = value?.trim()
    // An empty name keeps the old one: the chart needs a band title.
    if (pi >= 0 && name && name !== project.phases[pi].name) edit(d => { d.phases[pi].name = name })
    if (refocusTrigger) requestAnimationFrame(() => triggerAt(pi)?.focus())
  }
  useLayoutEffect(() => {
    const list = listRef.current
    const pi = project.phases.findIndex(p => p.id === renaming)
    const title = pi < 0 ? null : list?.querySelectorAll('.dtx-collapse__item')[pi]?.querySelector('.phase-title')
    const trigger = pi < 0 ? null : triggerAt(pi)
    if (!list || !title || !trigger) return setRenameBox(null)
    const box = list.getBoundingClientRect(), r = title.getBoundingClientRect(), tr = trigger.getBoundingClientRect()
    setRenameBox({ top: r.top + r.height / 2 - box.top, left: r.left - box.left - 9, width: tr.right - r.left + 9 })
  }, [renaming, project.phases])
  // A new phase joins the big phase of the one before it.
  const addPhase = (ph: ReturnType<typeof newPhase>) => { edit(d => { d.phases.push(ph) }); startRename(ph.id) }
  const deleteStage = (si: number) => edit(d => { d.stages.splice(si, 1) })
  const items = () => [...(listRef.current?.querySelectorAll('.dtx-collapse__item') ?? [])]

  // Drop target from the element under the pointer. Phase rows are the kit's Collapse items,
  // which take no props on their root, so they are found by class; task rows carry data-ti.
  const locate = (drag: Drag, el: Element, y: number): Drop | null => {
    const list = listRef.current
    const item = el.closest('.dtx-collapse__item')
    if (!list || !item || !list.contains(item)) return null
    const pi = items().indexOf(item)
    const box = list.getBoundingClientRect(), r = item.getBoundingClientRect()
    if (drag.kind === 'phase') {
      const before = y < r.top + r.height / 2 ? pi : pi + 1
      if (isNoop(true, drag.pi, before)) return null
      return { to: before, ti: 0, top: (before === pi ? r.top : r.bottom) - box.top, left: 0 }
    }
    const row = el.closest<HTMLElement>('[data-ti]')
    if (row) {
      const rr = row.getBoundingClientRect(), ti = Number(row.dataset.ti)
      const before = y < rr.top + rr.height / 2 ? ti : ti + 1
      if (isNoop(drag.pi === pi, drag.ti, before)) return null
      return { to: pi, ti: before, top: (before === ti ? rr.top : rr.bottom) - box.top, left: rr.left - box.left }
    }
    // Over a phase but not a task (its header, or an empty or folded body): append to that phase.
    const n = project.phases[pi].tasks.length
    if (isNoop(drag.pi === pi, drag.ti, n)) return null
    const last = [...item.querySelectorAll('[data-ti]')].at(-1)
    const a = (last?.checkVisibility() ? last : item.querySelector('.dtx-collapse__header') ?? item).getBoundingClientRect()
    return { to: pi, ti: n, top: a.bottom - box.top, left: a.left - box.left }
  }
  // Spells out where a drop lands, as the 1-based position the row will have once moved.
  const dropLabel = (drag: Drag, d: Drop) => {
    if (drag.kind === 'phase') return t.dropPhase(d.to > drag.pi ? d.to : d.to + 1)
    const ph = project.phases[d.to]
    return t.dropTask(ph.name || t.phaseFallback(d.to + 1), drag.pi === d.to && d.ti > drag.ti ? d.ti : d.ti + 1)
  }
  const swipeLabels = { swipe: t.swipeDelete, release: t.swipeRelease }
  const { drag, target: drop, onPointerDown } = useRowGestures<Drag, Drop>({
    pick: el => {
      const item = el.closest('.dtx-collapse__item')
      if (renamingRef.current || !item) return null
      const pi = items().indexOf(item)
      const row = el.closest<HTMLElement>('[data-ti]')
      if (row) return { data: { kind: 'task', pi, ti: Number(row.dataset.ti) }, node: row }
      const header = el.closest<HTMLElement>('.dtx-collapse__header')
      return header ? { data: { kind: 'phase', pi }, node: header, swipe: item as HTMLElement } : null
    },
    locate,
    // While dragging, fold every phase but the one a task comes from, so drop targets are close together.
    onDrag: d => {
      if (!d) return setClosed(closedBeforeDrag.current)
      closedBeforeDrag.current = closed
      setClosed(new Set(project.phases.filter((_, i) => d.kind === 'phase' || i !== d.pi).map(p => p.id)))
    },
    commit: (drag, d) => {
      if (drag.kind === 'phase') return edit(p => transfer(p.phases, drag.pi, p.phases, d.to))
      edit(p => transfer(p.phases[drag.pi].tasks, drag.ti, p.phases[d.to].tasks, d.ti))
      openPhase(project.phases[d.to].id)
    },
    remove: d => d.kind === 'phase' ? deletePhase(d.pi) : deleteTask(d.pi, d.ti),
    labels: swipeLabels,
  })
  const milestoneGestures = useRowGestures<number, never>({
    pick: el => {
      const row = el.closest<HTMLElement>('[data-mi]')
      return row ? { data: Number(row.dataset.mi), node: row } : null
    },
    remove: deleteMilestone,
    labels: swipeLabels,
  })
  const [milestonesOpen, setMilestonesOpen] = useState(true)
  return (
    <div className="editor">
      <Card>
        <CardHeader title={t.general} />
        <CardBody className="stack inline-edit">
          <div className="row">
            <Field label={t.title} className="grow"><Input value={project.title} placeholder="—" onChange={e => edit(d => { d.title = e.target.value })} /></Field>
            <Field label={t.projectName} className="grow"><Input value={project.subtitle} placeholder="—" onChange={e => edit(d => { d.subtitle = e.target.value })} /></Field>
            {!tl && !ms && (
              <Field label={t.timeScale} className="kind">
                <Select size="sm" value={project.scale} items={SCALES.map(s => ({ value: s, label: t.scales[s] }))}
                  onValueChange={v => v && edit(d => { d.scale = v as Scale })} />
              </Field>
            )}
            {st && (
              <Field label={t.statusDate} className="date">
                <DatePicker size="sm" value={project.statusDate || null} placeholder={t.today}
                  onValueChange={v => edit(d => { d.statusDate = v ?? '' })} />
              </Field>
            )}
          </div>
          <Field label={t.footer}>
            <Input value={project.footer} placeholder="—" onChange={e => edit(d => { d.footer = e.target.value })} />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t.bigPhases} />
        <CardBody className="stack inline-edit">
          {project.stages.length === 0 && <p className="muted">{t.bigPhasesHint}</p>}
          {project.stages.map((s, si) => (
            <div className="row" key={s.id}>
              <Field label={t.bigPhase} className="grow">
                <Input value={s.name} placeholder="—" onChange={e => edit(d => { d.stages[si].name = e.target.value })} />
              </Field>
              <DateRangePicker className="range" size="sm" label={t.dates} placeholder={t.pickDates}
                value={{ from: s.start || null, to: s.end || null }}
                onValueChange={r => edit(d => { Object.assign(d.stages[si], { start: r.from ?? '', end: r.to ?? '' }) })} />
              <Button variant="ghost" size="sm" aria-label={`${t.deleteBigPhase}: ${s.name}`} onClick={() => deleteStage(si)}><Icon icon={Trash2} /></Button>
            </div>
          ))}
          <div>
            <Button variant="secondary" size="sm" onClick={() => edit(d => { d.stages.push({ id: newId(), name: `Phase ${d.stages.length + 1}`, start: '', end: '' }) })}>
              <Icon icon={Plus} />{t.addBigPhase}
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={t.phasesAndTasks}
          action={project.phases.length > 0 && (
            <Button variant="ghost" size="sm"
              onClick={() => setClosed(allClosed ? new Set() : new Set(project.phases.map(p => p.id)))}>
              <Icon icon={allClosed ? ChevronsUpDown : ChevronsDownUp} />{allClosed ? t.expandAll : t.collapseAll}
            </Button>
          )}
        />
        <CardBody className="stack">
          {project.phases.length === 0 && (
            <EmptyState size="sm" icon={<Icon icon={CalendarRange} />} title={t.noPhases}
              action={<Button onClick={() => addPhase(newPhase('Phase 1', [newTask()]))}><Icon icon={Plus} />{t.addPhase}</Button>}>
              {t.noPhasesHint}
            </EmptyState>
          )}
          <div className="phase-list" ref={listRef} onPointerDown={onPointerDown}
            onKeyDown={e => {
              const el = e.target as Element
              const trigger = el.closest('.dtx-collapse__trigger')
              const item = el.closest('.dtx-collapse__item')
              const pi = item ? items().indexOf(item) : -1
              if (pi < 0) return
              if (e.key === 'F2' && trigger) {
                e.preventDefault()
                return startRename(project.phases[pi].id)
              }
              const row = el.closest<HTMLElement>('[data-ti]')
              if (e.altKey && e.key === 'Delete' && (row || trigger)) {
                e.preventDefault()
                if (row) return deleteTaskByKey(pi, Number(row.dataset.ti), [...row.querySelectorAll(FOCUSABLE)].indexOf(el))
                return deletePhaseByKey(pi)
              }
              const dir = !e.altKey ? 0 : e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0
              // Alt+ArrowDown opens pickers, so those keep it.
              if (!dir || el.closest('[role="combobox"], [aria-haspopup]:not([aria-haspopup="false"])')) return
              if (!row && !trigger) return
              e.preventDefault()
              if (trigger) return movePhase(pi, dir)
              moveTask(pi, Number(row!.dataset.ti), dir, [...row!.querySelectorAll(FOCUSABLE)].indexOf(el))
            }}>
          <Collapse
            headingLevel={3}
            value={project.phases.filter(p => !closed.has(p.id)).map(p => p.id)}
            onValueChange={open => setClosed(new Set(project.phases.map(p => p.id).filter(id => !open.includes(id))))}
            items={project.phases.map((ph, pi) => {
              return {
                value: ph.id,
                title: (
                  <span className="phase-title" title={`${t.renameHint}\n${t.holdToDrag}\n${t.swipeToDelete}`} data-id={ph.id}
                    data-dragging={(drag?.kind === 'phase' && drag.pi === pi) || undefined}
                    data-drop-into={(drag?.kind === 'task' && drop?.to === pi) || undefined}
                    onMouseDown={e => { if (e.detail > 1) e.preventDefault() }} // no word selection on double-click
                    onClick={onTitleClick(ph.id)}>
                    {ph.name || t.phaseFallback(pi + 1)}
                  </span>
                ),
                description: phaseSummary(ph, t),
                content: (
            <div className="stack">
              {ms && (
                <div className="row inline-edit">
                  <Field label={t.icon} className="kind">
                    <OptionSelect value={ph.icon} onValueChange={v => edit(d => { d.phases[pi].icon = (v ?? '') as PhaseIcon | '' })}
                      items={[{ value: '', label: t.iconAuto },
                        ...PHASE_ICONS.map(k => ({ value: k, label: t.icons[k], icon: <Icon icon={ICONS[k]} /> }))]} />
                  </Field>
                  <Field label={t.output} className="grow">
                    <Textarea rows={1} maxRows={6} value={ph.output} placeholder="—" onChange={e => edit(d => { d.phases[pi].output = e.target.value })} />
                  </Field>
                </div>
              )}
              {ph.tasks.length === 0 && <p className="muted">{t.noTasks}</p>}
              {ph.tasks.map((task, ti) => {
                const err = rangeError(task.start, task.end)
                const set = (k: keyof Pick<Task, 'name' | 'pic' | 'estimate' | 'label'>) => (v: string | null) =>
                  edit(d => { d.phases[pi].tasks[ti][k] = v ?? '' })
                return (
                  <div className="task inline-edit" key={task.id} data-ti={ti} data-id={task.id} title={`${t.holdToDrag}\n${t.swipeToDelete}`}
                    data-dragging={(drag?.kind === 'task' && drag.pi === pi && drag.ti === ti) || undefined}>
                    {/* One-line summary that stands in for the fields while a task is being dragged. */}
                    <div className="task-brief" aria-hidden="true">
                      <b>{task.name || '—'}</b>
                      {tl && task.pic && <span>{task.pic}</span>}
                      {tl && task.estimate && <span>{task.estimate} md</span>}
                      {st && task.status && <span>{t.statuses[task.status]}</span>}
                      {plan && task.priority && <span>{t.priorities[task.priority]}</span>}
                      {isDate(task.start) && <span>{fmtDate(task.start)}{isDate(task.end) && task.end !== task.start && ` – ${fmtDate(task.end)}`}</span>}
                    </div>
                    <div className="row">
                      <Field label={t.task} className="grow name"><Input value={task.name} placeholder="—" onChange={e => set('name')(e.target.value)} /></Field>
                      {plan ? (
                        <Field label={t.priority} className="kind">
                          <OptionSelect value={task.priority} onValueChange={v => edit(d => { d.phases[pi].tasks[ti].priority = (v ?? '') as Priority })}
                            items={(['', ...PRIORITIES] as const).map(s => ({ value: s, label: t.priorities[s] }))} />
                        </Field>
                      ) : st ? (
                        <Field label={t.status} className="kind">
                          <OptionSelect value={task.status} onValueChange={v => edit(d => { d.phases[pi].tasks[ti].status = (v ?? '') as TaskStatus })}
                            items={(['', 'todo', 'doing', 'done'] as const).map(s => ({ value: s, label: t.statuses[s] }))} />
                        </Field>
                      ) : <>
                        <Field label={t.pic} className="pic"><Input value={task.pic} placeholder="—" onChange={e => set('pic')(e.target.value)} /></Field>
                        <Field label={t.estimate} className="est">
                          <Input value={task.estimate} placeholder="—" inputMode="decimal" onChange={e => set('estimate')(e.target.value)} />
                        </Field>
                      </>}
                    </div>
                    <div className="row">
                      <DateRangePicker className="range" size="sm" label={t.dates} placeholder={t.pickDates}
                        value={{ from: task.start || null, to: task.end || null }}
                        onValueChange={r => edit(d => { Object.assign(d.phases[pi].tasks[ti], { start: r.from ?? '', end: r.to ?? '' }) })}
                        error={err ? t.endBeforeStart : project.stages.length && hasBar(task.start, task.end) && !stageOfTask(project, task) ? t.outsideBigPhase : undefined} />
                      {(tl || plan) && (
                        <Field label={tl ? t.barLabel : t.barText} className="grow">
                          <Input value={task.label} placeholder="—" onChange={e => set('label')(e.target.value)} />
                        </Field>
                      )}
                    </div>
                  </div>
                )
              })}
              <div>
                <Button variant="secondary" size="sm" onClick={() => edit(d => { d.phases[pi].tasks.push(newTask()) })}>
                  <Icon icon={Plus} />{t.addTask}
                </Button>
              </div>
            </div>
                ),
              }
            })}
          />
          {drop && drag && (
            <div className="drop-line" style={{ top: drop.top, insetInlineStart: drop.left }}>
              <span className="drop-tag">{dropLabel(drag, drop)}</span>
            </div>
          )}
          {renaming && renameBox && (
            <Input key={renaming} className="rename" aria-label={t.phaseName} autoFocus
              defaultValue={project.phases.find(p => p.id === renaming)?.name}
              style={{ top: renameBox.top, insetInlineStart: renameBox.left, width: renameBox.width }}
              onFocus={e => e.currentTarget.select()}
              onBlur={e => finishRename(e.currentTarget.value, false)}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); finishRename(e.currentTarget.value, true) }
                if (e.key === 'Escape') { e.preventDefault(); finishRename(null, true) }
              }} />
          )}
          </div>
          {project.phases.length > 0 && (
            <div>
              <Button variant="secondary" onClick={() => addPhase(newPhase())}><Icon icon={Plus} />{t.addPhase}</Button>
            </div>
          )}
        </CardBody>
      </Card>

      {(tl || ms) && <Card>
        <CardHeader
          title={milestonesOpen || !project.milestones.length ? t.milestones : `${t.milestones} (${project.milestones.length})`}
          action={
            <Button variant="ghost" size="sm" aria-expanded={milestonesOpen}
              onClick={() => setMilestonesOpen(o => !o)}>
              <Icon icon={milestonesOpen ? ChevronsDownUp : ChevronsUpDown} />{milestonesOpen ? t.collapse : t.expand}
            </Button>
          }
        />
        {milestonesOpen && <CardBody className="stack" id="milestones-body">
          {project.milestones.length === 0 && (
            <EmptyState size="sm" icon={<Icon icon={Flag} />} title={t.noMilestones}>{t.noMilestonesHint}</EmptyState>
          )}
          <div className="stack inline-edit" onPointerDown={milestoneGestures.onPointerDown}
            onKeyDown={e => {
              const row = (e.target as Element).closest<HTMLElement>('[data-mi]')
              if (!e.altKey || e.key !== 'Delete' || !row) return
              e.preventDefault()
              const mi = Number(row.dataset.mi), next = project.milestones[mi + 1] ?? project.milestones[mi - 1]
              const i = [...row.querySelectorAll(FOCUSABLE)].indexOf(e.target as Element)
              deleteMilestone(mi)
              if (next) requestAnimationFrame(() =>
                document.querySelector(`[data-mi][data-id="${CSS.escape(next.id)}"]`)?.querySelectorAll<HTMLElement>(FOCUSABLE)[Math.max(i, 0)]?.focus())
            }}>
          {project.milestones.map((m, mi) => (
            <div className="row task" key={m.id} data-mi={mi} data-id={m.id} title={t.swipeToDelete}>
              <Field label={t.date} className="date">
                <DatePicker size="sm" value={m.date || null} onValueChange={v => edit(d => { d.milestones[mi].date = v ?? '' })} />
              </Field>
              <Field label={t.kind} className="kind">
                <Select value={m.kind} onValueChange={v => v && edit(d => { d.milestones[mi].kind = v as 'milestone' | 'marker' })}
                  items={[{ value: 'milestone', label: ms ? t.kindLine : t.kindMilestone }, { value: 'marker', label: ms ? t.kindTextOnly : t.kindMarker }]} />
              </Field>
              {ms && (
                <Field label={t.color} className="kind">
                  <OptionSelect value={m.color} onValueChange={v => edit(d => { d.milestones[mi].color = (v ?? '') as Hue | '' })}
                    items={(['', ...HUES] as const).map(h => ({ value: h, label: t.colors[h],
                      icon: h ? <span className="swatch" style={{ background: PALETTE[h].solid }} aria-hidden /> : undefined }))} />
                </Field>
              )}
              <Field label={t.text} className="grow">
                <Textarea rows={1} maxRows={4} value={m.text} placeholder="—" onChange={e => edit(d => { d.milestones[mi].text = e.target.value })} />
              </Field>
            </div>
          ))}
          </div>
          <div>
            <Button variant="secondary" size="sm" onClick={() => edit(d => { d.milestones.push(newMilestone()) })}>
              <Icon icon={Plus} />{t.addMilestone}
            </Button>
          </div>
        </CardBody>}
      </Card>}
    </div>
  )
}
