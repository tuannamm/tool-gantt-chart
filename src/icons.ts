import { BrainCircuit, Code, Database, FileText, Layers, PenTool, Rocket, ShieldCheck, Users, Workflow, type LucideIcon } from 'lucide-react'
import type { PhaseIcon } from './types.ts'

// Phase tile icons for the milestones template, shared by the chart and the editor's picker.
export const ICONS: Record<PhaseIcon, LucideIcon> = {
  code: Code, data: Database, test: ShieldCheck, deploy: Rocket, design: PenTool,
  workflow: Workflow, ai: BrainCircuit, docs: FileText, team: Users, layers: Layers,
}
