import { useEffect, useState } from 'react'
import { HUES, PHASE_ICONS, PRIORITIES, SCALES, TEMPLATES, type Milestone, type Phase, type Project, type Stage, type Task } from './types.ts'
import { newId, sampleProject } from './sample.ts'
import { sortMilestones } from './layout.ts'

const KEY = 'gantt-project-v1'
const str = (v: unknown) => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '')

// Accepts anything JSON.parse returns; throws a readable message when it is not a project.
export function parseProject(x: unknown): Project {
  const o = x as Record<string, unknown> | null
  if (!o || typeof o !== 'object' || !Array.isArray(o.phases)) throw new Error('missing "phases" list')
  // Fields added after v1 get their defaults here, so older files still open.
  const stages = (Array.isArray(o.stages) ? o.stages : []).map((s: Partial<Stage>): Stage => ({ id: str(s?.id) || newId(), name: str(s?.name), start: str(s?.start), end: str(s?.end) }))
  return {
    template: TEMPLATES.find(v => v === o.template) ?? 'timeline',
    scale: SCALES.find(v => v === o.scale) ?? 'auto',
    statusDate: str(o.statusDate),
    title: str(o.title),
    subtitle: str(o.subtitle),
    footer: str(o.footer),
    stages,
    phases: o.phases.map((p: Partial<Phase>): Phase => ({
      id: str(p?.id) || newId(),
      name: str(p?.name),
      icon: PHASE_ICONS.find(i => i === p?.icon) ?? '',
      output: str(p?.output),
      tasks: (Array.isArray(p?.tasks) ? p.tasks : []).map((t: Partial<Task>): Task => ({
        id: str(t?.id) || newId(), name: str(t?.name), pic: str(t?.pic), estimate: str(t?.estimate),
        start: str(t?.start), end: str(t?.end), label: str(t?.label),
        status: (['todo', 'doing', 'done'] as const).find(s => s === t?.status) ?? '',
        priority: PRIORITIES.find(s => s === t?.priority) ?? '',
      })),
    })),
    milestones: sortMilestones((Array.isArray(o.milestones) ? o.milestones : []).map((m: Partial<Milestone>): Milestone => ({
      id: str(m?.id) || newId(), date: str(m?.date), text: str(m?.text), kind: m?.kind === 'marker' ? 'marker' : 'milestone',
      color: HUES.find(h => h === m?.color) ?? '',
    }))),
  }
}

function load(): Project {
  try {
    const s = localStorage.getItem(KEY)
    if (s) return parseProject(JSON.parse(s))
  } catch { /* corrupt or blocked storage: fall back to sample */ }
  return sampleProject()
}

export function useProject() {
  const [project, setProject] = useState(load)
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(project)) } catch { /* storage full or blocked */ }
  }, [project])
  return [project, setProject] as const
}
