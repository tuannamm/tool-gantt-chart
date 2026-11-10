import { useEffect, useRef, useState } from 'react'
import { Download, FilePlus, FileJson, LayoutTemplate, Monitor, Moon, PanelLeftClose, PanelLeftOpen, Sun, Upload, ZoomIn, ZoomOut } from 'lucide-react'
import { Button, Dialog, DialogClose, Icon, Logo, Segmented, Select, ToastProvider, useTheme, useToast, type ThemeMode } from '@dgtx/ui-frek'
import { type ConfirmRequest, Editor } from './Editor.tsx'
import { GanttChart } from './GanttChart.tsx'
import { MilestoneChart } from './MilestoneChart.tsx'
import { BoardChart } from './BoardChart.tsx'
import { PlanChart } from './PlanChart.tsx'
import { download, exportJpg, safeFileName } from './exportImage.ts'
import { I18n, STRINGS, useLang, type Lang } from './i18n.tsx'
import { blankProject, sampleProject, withTemplate } from './sample.ts'
import { MAX_ZOOM, MIN_ZOOM, stepZoom, usePanZoom } from './usePanZoom.ts'
import { parseProject, useProject } from './useProject.ts'
import { TEMPLATES, type Template } from './types.ts'

const EDITOR_KEY = 'gantt-editor-open'
const CHARTS = { timeline: GanttChart, milestones: MilestoneChart, board: BoardChart, plan: PlanChart } satisfies Record<Template, unknown>

// Per-browser convenience: the editor panel stays hidden across reloads once the user hides it.
function useEditorOpen() {
  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem(EDITOR_KEY) !== 'false' } catch { return true }
  })
  useEffect(() => {
    try { localStorage.setItem(EDITOR_KEY, String(open)) } catch { /* storage blocked */ }
  }, [open])
  return [open, setOpen] as const
}

function Builder() {
  const toast = useToast()
  const [lang, setLang] = useLang()
  const [theme, setTheme] = useTheme()
  const [editorOpen, setEditorOpen] = useEditorOpen()
  // Preview only: export ignores zoom because the SVG keeps its own size.
  const { zoom, zoomTo, viewRef, sheetRef, onPointerDown } = usePanZoom()
  const t = STRINGS[lang]
  const [project, setProject] = useProject()
  const svgRef = useRef<SVGSVGElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<ConfirmRequest | null>(null)
  const name = safeFileName(project.subtitle || project.title)
  const Chart = CHARTS[project.template]

  const exportAs = async () => {
    if (!svgRef.current) return
    setBusy(true)
    try {
      await exportJpg(svgRef.current, name)
      toast({ title: t.exported(`${name}.jpg`), tone: 'ok' })
    } catch {
      toast({ title: t.exportFailed, description: t.exportFailedDesc, tone: 'err' })
    } finally {
      setBusy(false)
    }
  }

  const importJson = async (file: File) => {
    try {
      setProject(parseProject(JSON.parse(await file.text())))
      toast({ title: t.imported(file.name), tone: 'ok' })
    } catch {
      toast({ title: t.importFailed(file.name), description: t.importFailedDesc, tone: 'err' })
    }
  }

  const replaceWith = (what: string, make: () => typeof project) => setPending({
    title: t.replaceTitle(what),
    description: t.replaceDesc,
    confirmLabel: t.replaceConfirm,
    // The chosen template stays: it is how the user wants to see any project.
    run: () => setProject(withTemplate(make(), project.template)),
  })

  return (
    <I18n.Provider value={t}>
      <div className="app dtx-root">
        <header className="toolbar">
          <div className="brand">
            {/* Logo files are never recoloured: pick the variant for the theme's background. */}
            <span className="logo-light"><Logo variant="horizontal" width={120} /></span>
            <span className="logo-dark"><Logo variant="horizontal-white" width={120} /></span>
            <span className="sep" aria-hidden />
            <h1>Timeline Chart Builder</h1>
          </div>
          <div className="actions">
            <Button variant="ghost" size="sm" onClick={() => replaceWith(t.blankProject, blankProject)}><Icon icon={FilePlus} />{t.newProject}</Button>
            <Button variant="ghost" size="sm" onClick={() => replaceWith(t.sampleProject, sampleProject)}><Icon icon={LayoutTemplate} />{t.sample}</Button>
            <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()}><Icon icon={Upload} />{t.importJson}</Button>
            <Button variant="ghost" size="sm" onClick={() =>
              download(new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }), `${name}.json`)}>
              <Icon icon={FileJson} />{t.exportJson}
            </Button>
            <span className="sep" aria-hidden />
            <Button size="sm" disabled={busy} onClick={exportAs}>
              <Icon icon={Download} />{busy ? t.exporting : t.exportJpg}
            </Button>
            <span className="sep" aria-hidden />
            <Segmented aria-label={t.language} value={lang} onValueChange={v => setLang(v as Lang)}
              options={[{ value: 'en', label: 'EN' }, { value: 'vi', label: 'VI' }]} />
            <Segmented aria-label={t.theme} value={theme} onValueChange={v => setTheme(v as ThemeMode)}
              options={[
                { value: 'light', label: <Icon icon={Sun} label={t.light} /> },
                { value: 'dark', label: <Icon icon={Moon} label={t.dark} /> },
                { value: 'system', label: <Icon icon={Monitor} label={t.system} /> },
              ]} />
            <input ref={fileRef} type="file" accept="application/json,.json" hidden
              onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void importJson(f) }} />
          </div>
        </header>
        <main className={editorOpen ? 'layout' : 'layout layout--full'}>
          <aside id="editor-panel" className="panel" aria-label={t.editorRegion} hidden={!editorOpen}>
            <Editor project={project} onChange={setProject} confirm={setPending} />
          </aside>
          <section className="preview" aria-label={t.previewRegion}>
            <div className="previewbar">
              <Button variant="ghost" size="sm" icon aria-controls="editor-panel" aria-expanded={editorOpen}
                aria-label={editorOpen ? t.hideEditor : t.showEditor} title={editorOpen ? t.hideEditor : t.showEditor}
                onClick={() => setEditorOpen(o => !o)}>
                <Icon icon={editorOpen ? PanelLeftClose : PanelLeftOpen} />
              </Button>
              <div className="previewbar-end">
              <Select size="sm" className="template-select" aria-label={t.template} value={project.template}
                items={TEMPLATES.map(v => ({ value: v, label: t.templates[v] }))}
                onValueChange={v => v && setProject(withTemplate(project, v as Template))} />
              <div className="zoom" role="group" aria-label={t.zoom}>
                <Button variant="ghost" size="sm" icon aria-label={t.zoomOut} title={t.zoomOut} disabled={zoom <= MIN_ZOOM}
                  onClick={() => zoomTo(stepZoom(zoom, -1))}><Icon icon={ZoomOut} /></Button>
                <Button variant="ghost" size="sm" aria-label={t.zoomReset} title={t.zoomReset}
                  onClick={() => zoomTo(1)}><span className="zoom-pct">{Math.round(zoom * 100)}%</span></Button>
                <Button variant="ghost" size="sm" icon aria-label={t.zoomIn} title={t.zoomIn} disabled={zoom >= MAX_ZOOM}
                  onClick={() => zoomTo(stepZoom(zoom, 1))}><Icon icon={ZoomIn} /></Button>
              </div>
              </div>
            </div>
            <div ref={viewRef} className="viewport" tabIndex={0}>
              <div ref={sheetRef} className="sheet" style={{ width: `${zoom * 100}%` }} onPointerDown={onPointerDown}>
                <Chart ref={svgRef} project={project} />
              </div>
            </div>
          </section>
        </main>
        <Dialog
          open={!!pending}
          onOpenChange={open => { if (!open) setPending(null) }}
          title={pending?.title ?? ''}
          description={pending?.description}
          footer={<>
            <DialogClose><Button variant="secondary">{t.cancel}</Button></DialogClose>
            <Button variant="danger" onClick={() => { pending?.run(); setPending(null) }}>{pending?.confirmLabel}</Button>
          </>}
        />
      </div>
    </I18n.Provider>
  )
}

export default function App() {
  return <ToastProvider><Builder /></ToastProvider>
}
