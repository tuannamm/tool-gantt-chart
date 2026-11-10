import { useState, type PointerEvent as ReactPointerEvent } from 'react'

const HOLD_MS = 300 // press this long without moving to pick a row up
const SLOP = 6 // moving further first is a scroll or a text selection, not a gesture
const EDGE = 48 // auto-scroll band at the top and bottom of the scroll container
const SWIPE_MAX = 140 // swipe at least this far left (or 40% of the row, if less) to delete
const ANCHOR_MS = 500 // after pick-up, keep the held row in place while onDrag's layout change animates
// Pressing these edits or acts, so they only pick up after a still hold, and never swipe.
const CONTROL = 'input, textarea, select, a, button:not(.dtx-collapse__trigger), [contenteditable], [role="combobox"]'

const scrollParent = (el: Element): HTMLElement => {
  for (let e = el.parentElement; e; e = e.parentElement) {
    const o = getComputedStyle(e).overflowY
    if ((o === 'auto' || o === 'scroll') && e.scrollHeight > e.clientHeight) return e
  }
  return document.scrollingElement as HTMLElement
}

// A copy of the held row that follows the pointer, so it is clear what is being carried.
const lift = (node: HTMLElement, host: HTMLElement) => {
  const ghost = node.cloneNode(true) as HTMLElement
  // React sets field values as properties, which cloneNode does not copy.
  const from = node.querySelectorAll<HTMLInputElement>('input, textarea')
  ghost.querySelectorAll<HTMLInputElement>('input, textarea').forEach((f, i) => { f.value = from[i]?.value ?? '' })
  ghost.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'))
  ghost.removeAttribute('id')
  ghost.classList.add('drag-ghost')
  ghost.setAttribute('aria-hidden', 'true')
  ghost.inert = true
  ghost.style.width = `${node.getBoundingClientRect().width}px`
  ghost.style.margin = '0' // rules scoped to the row, such as negative inline margins, must not offset it
  // Inside the gesture's own container, so every style scoped around the row still applies.
  host.append(ghost)
  return ghost
}

export type Picked<D> = {
  data: D
  node: HTMLElement // the row that is lifted on drag
  swipe?: HTMLElement // what slides away on swipe, if not the row itself
}

// Handle-free row gestures on pointer events, the same for mouse and touch:
// - drag: a still press of HOLD_MS picks the row up anywhere. A mouse press outside a control also
//   picks up as soon as it moves vertically. On a control, or on touch, moving first stays a text
//   selection or a scroll.
// - swipe: a press outside a control that moves left slides the row; released past the threshold,
//   it deletes. Short of it, the row slides back.
export function useRowGestures<D, T>({ pick, locate, commit, onDrag, remove, labels }: {
  pick: (el: Element) => Picked<D> | null
  locate?: (drag: D, el: Element, y: number) => T | null // drop target under the pointer; omit to disable drag
  commit?: (drag: D, target: T) => void
  onDrag?: (drag: D | null) => void // pick-up and put-down (before commit), e.g. to fold the list
  remove: (data: D) => void
  labels: { swipe: string, release: string } // shown in the strip a swipe uncovers
}) {
  const [drag, setDrag] = useState<D | null>(null)
  const [target, setTarget] = useState<T | null>(null)

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (!e.isPrimary || e.button !== 0) return
    const picked = pick(e.target as Element)
    if (!picked) return
    const { data: d, node } = picked
    const slide = picked.swipe ?? node
    const host = e.currentTarget
    const scroller = scrollParent(host)
    const sx = e.clientX, sy = e.clientY
    const onControl = !!(e.target as Element).closest(CONTROL)
    const quick = e.pointerType === 'mouse' && !onControl
    const point = { x: sx, y: sy }
    let mode: 'press' | 'drag' | 'swipe' = 'press', over: T | null = null, raf = 0, armed = false
    let ghost: HTMLElement | null = null, off = { x: 0, y: 0 }, anchorTop = 0, anchorUntil = 0, overKey = ''
    const moveGhost = () => ghost?.style.setProperty('translate', `${point.x - off.x}px ${point.y - off.y}px`)
    // Tints the row while the hold is counting, so a long press visibly does something.
    if (locate) node.dataset.pressing = ''

    const place = () => {
      const { x, y } = point
      getSelection()?.removeAllRanges()
      const el = document.elementFromPoint(x, y)
      over = el ? locate!(d, el, y) : null
      // Runs every frame, so only a changed target re-renders.
      const key = JSON.stringify(over)
      if (key !== overKey) { overKey = key; setTarget(over) }
      moveGhost()
    }
    // Rows above the held one fold or shrink on pick-up. Scroll to keep it under the pointer, padding
    // the scroller where it runs out of room; the padding goes when the drag ends.
    const pad = { top: 0, bottom: 0 }
    const base = getComputedStyle(scroller)
    const baseTop = parseFloat(base.paddingTop), baseBottom = parseFloat(base.paddingBottom)
    const anchor = () => {
      let want = node.getBoundingClientRect().top - anchorTop
      if (want < -scroller.scrollTop) {
        pad.top += -want - scroller.scrollTop
        scroller.style.paddingTop = `${baseTop + pad.top}px`
        want = node.getBoundingClientRect().top - anchorTop
      }
      const room = scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop
      if (want > room) {
        pad.bottom += want - room
        scroller.style.paddingBottom = `${baseBottom + pad.bottom}px`
      }
      scroller.scrollTop += want
    }
    const autoScroll = () => {
      if (performance.now() < anchorUntil && node.isConnected) anchor()
      const r = scroller.getBoundingClientRect(), y = point.y
      const dy = y < r.top + EDGE ? y - r.top - EDGE : y > r.bottom - EDGE ? y - r.bottom + EDGE : 0
      if (dy) scroller.scrollTop += dy / 4
      // Layout can move under a still pointer (scrolling, folding), so the target is re-read each frame.
      place()
      raf = requestAnimationFrame(autoScroll)
    }
    const startDrag = () => {
      clearTimeout(timer)
      mode = 'drag'
      // Stop a text selection already under way in the pressed field.
      const f = document.activeElement
      if (f instanceof HTMLElement && f.matches(CONTROL)) f.blur()
      delete node.dataset.pressing
      const r0 = node.getBoundingClientRect()
      // May restyle rows (e.g. compact while dragging), so measure the held row again after it.
      document.documentElement.classList.add('hold-dragging')
      ghost = lift(node, host)
      const r = node.getBoundingClientRect()
      off = { x: sx - r0.left, y: Math.min(sy - r0.top, r.height / 2) }
      // Keep the held row under the pointer while the list reflows around it.
      anchorTop = sy - off.y
      anchorUntil = performance.now() + ANCHOR_MS
      setDrag(d)
      onDrag?.(d)
      place()
      raf = requestAnimationFrame(autoScroll)
    }
    const width = slide.getBoundingClientRect().width
    const threshold = Math.min(SWIPE_MAX, width * 0.4)
    const swipeTo = (dx: number) => {
      const x = Math.max(-width, Math.min(0, dx))
      armed = -x >= threshold
      slide.style.translate = `${x}px 0`
      slide.style.setProperty('--swipe-x', `${-x}px`)
      slide.dataset.swipe = armed ? labels.release : labels.swipe
      if (armed) slide.dataset.armed = ''
      else delete slide.dataset.armed
    }
    const startSwipe = () => {
      clearTimeout(timer)
      mode = 'swipe'
      delete node.dataset.pressing
      getSelection()?.removeAllRanges()
      document.documentElement.classList.add('swiping')
    }
    const timer = locate ? setTimeout(startDrag, HOLD_MS) : 0

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return
      point.x = ev.clientX
      point.y = ev.clientY
      const dx = point.x - sx, dy = point.y - sy
      if (mode === 'drag') return place()
      if (mode === 'swipe') return swipeTo(dx)
      if (Math.hypot(dx, dy) <= SLOP) return
      if (!onControl && dx < 0 && -dx > Math.abs(dy)) { startSwipe(); swipeTo(dx) }
      else if (quick && locate) startDrag()
      else finish(false)
    }
    // Once a gesture owns the pointer, touch must not scroll the page or open the long-press menu.
    const block = (ev: Event) => { if (mode !== 'press') ev.preventDefault() }
    const noNativeDrag = (ev: Event) => ev.preventDefault()
    const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape' && mode !== 'press') { ev.preventDefault(); finish(false) } }
    const swallow = (ev: Event) => { ev.stopPropagation(); ev.preventDefault() }
    const up = () => finish(true)
    const cancel = () => finish(false)
    const finish = (done: boolean) => {
      clearTimeout(timer)
      cancelAnimationFrame(raf)
      removeEventListener('pointermove', onMove)
      removeEventListener('pointerup', up)
      removeEventListener('pointercancel', cancel)
      removeEventListener('touchmove', block)
      removeEventListener('contextmenu', block)
      removeEventListener('dragstart', noNativeDrag)
      removeEventListener('keydown', onKey, true)
      delete node.dataset.pressing
      if (mode === 'press') return
      // The click that ends the gesture must not toggle a phase or focus the field under it.
      addEventListener('click', swallow, { capture: true, once: true })
      setTimeout(() => removeEventListener('click', swallow, true))
      if (mode === 'drag') {
        ghost?.remove()
        scroller.style.paddingTop = scroller.style.paddingBottom = ''
        scroller.scrollTop -= pad.top
        document.documentElement.classList.remove('hold-dragging')
        setDrag(null)
        setTarget(null)
        onDrag?.(null)
        if (done && over) commit?.(d, over)
        return
      }
      document.documentElement.classList.remove('swiping')
      // Slide back; a deleted row unmounts before this paints. A phase with tasks asks first, then stays.
      slide.dataset.settling = ''
      slide.style.translate = ''
      slide.style.removeProperty('--swipe-x')
      delete slide.dataset.swipe
      delete slide.dataset.armed
      setTimeout(() => delete slide.dataset.settling, 200)
      if (done && armed) remove(d)
    }
    addEventListener('pointermove', onMove)
    addEventListener('pointerup', up)
    addEventListener('pointercancel', cancel)
    addEventListener('touchmove', block, { passive: false })
    addEventListener('contextmenu', block)
    addEventListener('dragstart', noNativeDrag)
    addEventListener('keydown', onKey, true)
  }

  return { drag, target, onPointerDown }
}
