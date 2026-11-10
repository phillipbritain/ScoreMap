// PROTOTYPE (throwaway, not for main): which look the rail's Leagues popover is tried in, from the
// page's `?pickerProto=` search param. Its own param name, so it can't clash with another prototype's.
import { useSyncExternalStore } from 'react'

export const pickerProtoParam = 'pickerProto'

export const pickerProtoVariants = [
  { key: 'current', name: 'Current (white pills)' },
  { key: 'glow', name: 'Gold glow pills' },
  { key: 'switches', name: 'Toggle list' },
  { key: 'colors', name: 'Sport colors' },
  { key: 'cards', name: 'Sport cards + checkboxes' },
  { key: 'tabs', name: 'Sport tabs' },
] as const

export type PickerProto = (typeof pickerProtoVariants)[number]['key']

const changed = 'picker-proto-change'

function read(): PickerProto {
  const value = new URLSearchParams(window.location.search).get(pickerProtoParam)
  return pickerProtoVariants.find((variant) => variant.key === value)?.key ?? 'current'
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(changed, onChange)
  window.addEventListener('popstate', onChange)
  return () => {
    window.removeEventListener(changed, onChange)
    window.removeEventListener('popstate', onChange)
  }
}

export function usePickerProto(): PickerProto {
  return useSyncExternalStore(subscribe, read)
}

export function setPickerProto(variant: PickerProto): void {
  const url = new URL(window.location.href)
  url.searchParams.set(pickerProtoParam, variant)
  window.history.replaceState(window.history.state, '', url)
  window.dispatchEvent(new Event(changed))
}
