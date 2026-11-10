import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

export const MIN_ZOOM = 0.5
export const MAX_ZOOM = 3
// Button stops. Ctrl+wheel zooms continuously between MIN_ZOOM and MAX_ZOOM.
const STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3]

export const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z))
// Next button stop strictly above (dir 1) or below (dir -1) z, so 1.1 steps to 1.25 or 1.
export const stepZoom = (z: number, dir: 1 | -1) =>
  (dir > 0 ? STEPS.find(s => s > z + 1e-6) : STEPS.findLast(s => s < z - 1e-6)) ?? clampZoom(z)

type Anchor = { x: number, y: number, rx: number, ry: number }

// Zoom is the sheet width as a multiple of the scroll view's width. The point under the
// cursor (or the view centre, for buttons) stays put across a zoom. Mouse drag pans the view.
export function usePanZoom() {
  const viewRef = useRef<HTMLDivElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const zoomRef = useRef(1)
  const anchor = useRef<Anchor | null>(null)

  const zoomTo = useCallback((z: number, x?: number, y?: number) => {
    const view = viewRef.current, sheet = sheetRef.current
    if (!view || !sheet) return
    const v = view.getBoundingClientRect(), s = sheet.getBoundingClientRect()
    x ??= v.left + v.width / 2
    y ??= v.top + v.height / 2
    anchor.current = { x, y, rx: (x - s.left) / s.width, ry: (y - s.top) / s.height }
    zoomRef.current = clampZoom(z)
    setZoom(zoomRef.current)
  }, [])

  useLayoutEffect(() => {
    const a = anchor.current, view = viewRef.current, sheet = sheetRef.current
    anchor.current = null
    if (!a || !view || !sheet) return
    const s = sheet.getBoundingClientRect()
    view.scrollLeft += s.left + a.rx * s.width - a.x
    view.scrollTop += s.top + a.ry * s.height - a.y
  }, [zoom])

  // React's onWheel is passive, so it cannot stop the browser's own page zoom.
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY
      zoomTo(zoomRef.current * Math.exp(-dy * 0.002), e.clientX, e.clientY)
    }
    view.addEventListener('wheel', onWheel, { passive: false })
    return () => view.removeEventListener('wheel', onWheel)
  }, [zoomTo])

  // Touch already pans natively; only mouse needs grab-to-pan. Keyboard scrolls the focused view.
  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    const view = viewRef.current, el = e.currentTarget
    if (!view || e.pointerType !== 'mouse' || e.button !== 0) return
    e.preventDefault()
    const start = { x: e.clientX, y: e.clientY, left: view.scrollLeft, top: view.scrollTop }
    el.setPointerCapture(e.pointerId)
    el.classList.add('panning')
    const move = (ev: PointerEvent) => {
      view.scrollLeft = start.left - (ev.clientX - start.x)
      view.scrollTop = start.top - (ev.clientY - start.y)
    }
    const end = () => {
      el.classList.remove('panning')
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', end)
      el.removeEventListener('pointercancel', end)
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', end)
    el.addEventListener('pointercancel', end)
  }

  return { zoom, zoomTo, viewRef, sheetRef, onPointerDown }
}
