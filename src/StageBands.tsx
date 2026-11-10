// Big phases (Phase 1, Phase 2...): a bar over the dates each one covers. A bar too short for its name
// grows around its centre and is held inside min..max.
export function StageBands({ bands, y, fill, min, max }: {
  bands: { name: string, x1: number, x2: number }[], y: number, fill: string, min: number, max: number,
}) {
  return bands.map(({ name, x1, x2 }, i) => {
    const label = name.trim().toUpperCase()
    const w = Math.min(max - min, Math.max(x2 - x1, label.length * 10 + 24))
    const x = Math.min(Math.max((x1 + x2) / 2 - w / 2, min), max - w)
    return (
      <g key={i}>
        <rect x={x} y={y} width={w} height={28} rx={4} fill={fill} />
        <text x={x + w / 2} y={y + 19} fontSize={15} fontWeight="bold" fill="#fff" textAnchor="middle">{label}</text>
      </g>
    )
  })
}
