export const safeFileName = (s: string) => s.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'gantt-chart'

export function download(blob: Blob, fileName: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = fileName
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

// SVG -> <img> -> <canvas> at `scale`x -> JPG. Uses system fonts only, so no font embedding needed.
export async function exportJpg(svg: SVGSVGElement, name: string, scale = 2) {
  const w = Number(svg.getAttribute('width')), h = Number(svg.getAttribute('height'))
  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.removeAttribute('class') // drop the on-screen responsive sizing
  const src = URL.createObjectURL(
    new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml;charset=utf-8' }),
  )
  try {
    const img = new Image()
    img.src = src
    await img.decode()
    const canvas = document.createElement('canvas')
    canvas.width = w * scale
    canvas.height = h * scale
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas is not available')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', 0.95))
    if (!blob) throw new Error('the browser could not encode the image')
    download(blob, `${safeFileName(name)}.jpg`)
  } finally {
    URL.revokeObjectURL(src)
  }
}
