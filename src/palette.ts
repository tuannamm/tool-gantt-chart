import type { Hue } from './types.ts'

// Milestones and board template colours, after the reference executive view; phases cycle through them in HUES order.
// solid: caps, icon tile, borders, diamonds. text: on white, tint or pale, 4.5:1. tint: tile and output fill.
// pale / mid / solid: the pill for not started / in progress / done. Pill text is dark, but `ink` on solid.
export const PALETTE: Record<Hue, { solid: string, text: string, tint: string, pale: string, mid: string, ink: string }> = {
  purple: { solid: '#9333ea', text: '#7e22ce', tint: '#f3e8ff', pale: '#ead5fd', mid: '#c792f7', ink: '#fff' },
  teal: { solid: '#0f8378', text: '#115e59', tint: '#e2f7f3', pale: '#a6e6da', mid: '#5fcab7', ink: '#fff' },
  yellow: { solid: '#f5b700', text: '#8a5300', tint: '#fff8dc', pale: '#fff0b3', mid: '#ffd84d', ink: '#3b2a00' },
  red: { solid: '#e11d2a', text: '#b91c1c', tint: '#ffe6ee', pale: '#ffd2de', mid: '#ff9aae', ink: '#fff' },
  indigo: { solid: '#3730a3', text: '#3730a3', tint: '#e0e9fd', pale: '#cad8fb', mid: '#97b2f3', ink: '#fff' },
  blue: { solid: '#2563eb', text: '#1d4ed8', tint: '#e3edff', pale: '#c3d7fd', mid: '#8fb3f7', ink: '#fff' },
  pink: { solid: '#ee9ee0', text: '#9d1f8f', tint: '#fdeefa', pale: '#fbdcf5', mid: '#f4bce9', ink: '#3d0a36' },
}
