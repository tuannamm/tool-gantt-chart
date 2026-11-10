// '' = not set: no status text on the bar.
export type TaskStatus = '' | 'todo' | 'doing' | 'done'
// Plan template: the marker on the bar corner. '' = none.
export const PRIORITIES = ['high', 'medium', 'low'] as const
export type Priority = typeof PRIORITIES[number] | ''

export type Task = {
  id: string
  name: string
  pic: string
  estimate: string
  start: string // YYYY-MM-DD, empty = no bar
  end: string
  label: string // timeline: text beside the bar; plan: text inside it
  status: TaskStatus // milestones and board templates; set by hand, never derived from dates
  priority: Priority // plan template only
}

// Closed set the milestones template can draw on a phase tile. '' = guessed from the phase name.
export const PHASE_ICONS = ['code', 'data', 'test', 'deploy', 'design', 'workflow', 'ai', 'docs', 'team', 'layers'] as const
export type PhaseIcon = typeof PHASE_ICONS[number]

export type Phase = {
  id: string
  name: string
  tasks: Task[]
  icon: PhaseIcon | '' // milestones template only
  output: string // milestones template only: one bullet per line
}

// A big phase (Phase 1, Phase 2...): a banner over the phases whose tasks all fall inside start..end.
export type Stage = { id: string; name: string; start: string; end: string }

export const HUES = ['purple', 'teal', 'yellow', 'red', 'indigo', 'blue', 'pink'] as const
export type Hue = typeof HUES[number]

// 'milestone': red dashed line + red text above the dates. 'marker': blue text right above the date.
// color: milestones template only; '' = the default indigo text and red diamond.
export type Milestone = { id: string; date: string; text: string; kind: 'milestone' | 'marker'; color: Hue | '' }

export const TEMPLATES = ['timeline', 'milestones', 'board', 'plan'] as const
export type Template = typeof TEMPLATES[number]

// Board and plan templates: the calendar columns. 'auto' picks days for a short project, months for a long one.
export const SCALES = ['auto', 'day', 'month'] as const
export type Scale = typeof SCALES[number]

export type Project = {
  template: Template // how the chart is drawn; the data is the same for every template
  title: string
  subtitle: string
  footer: string
  scale: Scale
  statusDate: string // milestones: the red "status" line; board: the highlighted column. Empty = today
  stages: Stage[]
  phases: Phase[]
  milestones: Milestone[]
}
