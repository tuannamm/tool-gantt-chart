import type { Milestone, Phase, Project, Task, Template } from './types.ts'

// Not crypto.randomUUID: it only exists in secure contexts, so the app would not start over plain http
// on a LAN address. getRandomValues has no such limit.
export const newId = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), b => b.toString(16).padStart(2, '0')).join('')

export const newTask = (t: Partial<Task> = {}): Task => ({
  id: newId(), name: '', pic: '', estimate: '', start: '', end: '', label: '', status: '', priority: '', ...t,
})

export const newPhase = (name = 'New phase', tasks: Task[] = [], more: Partial<Phase> = {}): Phase => ({
  id: newId(), name, tasks, icon: '', output: '', ...more,
})

export const newMilestone = (m: Partial<Milestone> = {}): Milestone => ({
  id: newId(), date: '', text: '', kind: 'milestone', color: '', ...m,
})

// Each template's title. Switching template swaps an untouched default for the other one.
const TITLE: Record<Template, string> = { timeline: 'GANTT CHART', milestones: 'PROJECT MILESTONES', board: 'Gantt Chart', plan: 'Project Plan' }
export const withTemplate = (p: Project, template: Template): Project =>
  ({ ...p, template, title: p.title === TITLE[p.template] ? TITLE[template] : p.title })

export const blankProject = (): Project => ({
  template: 'timeline', title: TITLE.timeline, subtitle: 'New project', footer: '', scale: 'auto', statusDate: '', stages: [], phases: [newPhase('Phase 1', [newTask()])], milestones: [],
})

const d = (day: number) => `2026-11-${String(day).padStart(2, '0')}`

export const sampleProject = (): Project => ({
  template: 'timeline',
  title: TITLE.timeline,
  scale: 'auto',
  statusDate: d(18),
  subtitle: 'Project automation',
  stages: [],
  footer: 'Key milestones: Nov 18 – Staging Build  |  Nov 23 – Testing Complete  |  Nov 24 – Release PRO',
  phases: [
    newPhase('Implementation', [
      newTask({ name: 'Optimize AI workflow', pic: 'AI Team', estimate: '5', start: d(1), end: d(5), status: 'done' }),
      newTask({ name: 'Auto-label tool', pic: 'Anh Tuan', estimate: '1', start: d(1), end: d(5), status: 'done' }),
      newTask({ name: 'Trainning model', pic: 'AI Team', estimate: '12', start: d(5), end: d(17), status: 'doing', priority: 'high' }),
      newTask({ name: 'Design workflow label', pic: 'TS Team', estimate: '1' }),
      newTask({ name: 'Design workflow auto', pic: 'TS Team', estimate: '2' }),
    ], { icon: 'code', output: 'Optimized AI workflow\nAuto-label tool\nTrained model' }),
    newPhase('Dataset preparation', [
      newTask({ name: 'Provides rollup 300 samples', pic: 'OPS', start: d(5), end: d(12), status: 'doing', priority: 'medium' }),
    ], { icon: 'data', output: '300 labelled samples' }),
    newPhase('Testing', [
      newTask({ name: 'Workflow testing (2.5 mandays)', pic: 'TS Team', estimate: '2.5', start: d(18), end: d(23), status: 'todo', priority: 'medium' }),
      newTask({ name: 'End-to-end testing', pic: 'QC Team', estimate: '3', start: d(18), end: d(23), status: 'todo' }),
    ], { icon: 'test', output: 'Test report\nSign-off' }),
    newPhase('Integrate workflow', [
      newTask({ name: 'Integrate OCR labeling service', pic: 'Tuan Nam / Van Bao', estimate: '1', start: d(5), end: d(5), status: 'done' }),
      newTask({ name: 'Integrate OCR pipeline', pic: 'Tuan Nam / Van Bao', estimate: '1', start: d(17), end: d(17), status: 'doing' }),
      newTask({ name: 'Integrate VLM extraction API', pic: 'Ba Dai / Van Bao', estimate: '1', start: d(18), end: d(18), status: 'todo' }),
    ], { icon: 'workflow', output: 'OCR and VLM services wired into the workflow' }),
    newPhase('Deploy', [
      newTask({ name: 'PO Staging', pic: 'DevOps Team', estimate: '1', start: d(18), end: d(18), label: 'Release Staging', status: 'todo' }),
      newTask({ name: 'PO Production', pic: 'DevOps Team', estimate: '0.5', start: d(24), end: d(24), label: 'Release PRO', status: 'todo', priority: 'low' }),
    ], { icon: 'deploy', output: 'Staging build\nProduction release' }),
  ],
  milestones: [
    newMilestone({ date: d(1), text: 'Kick-off', kind: 'marker' }),
    newMilestone({ date: d(17), text: 'Milestone 1\nImplement\nCompleted', color: 'red' }),
    newMilestone({ date: d(19), text: 'Release staging', kind: 'marker' }),
    newMilestone({ date: d(23), text: 'Milestone 2\nTesting\nCompleted', color: 'teal' }),
    newMilestone({ date: d(24), text: 'Release PRO', kind: 'marker' }),
    newMilestone({ date: d(24), text: 'Milestone 3\nDeployment\nCompleted', color: 'teal' }),
  ],
})
