// Move src[from] so it lands just before dst[before] (before === dst.length appends).
// src and dst may be the same array; `before` is an index into dst as it was before the move.
export function transfer<T>(src: T[], from: number, dst: T[], before: number) {
  const [item] = src.splice(from, 1)
  dst.splice(src === dst && from < before ? before - 1 : before, 0, item)
}

// A drop at `before` in the same list is a no-op when it would leave `from` where it is.
export const isNoop = (sameList: boolean, from: number, before: number) =>
  sameList && (before === from || before === from + 1)
