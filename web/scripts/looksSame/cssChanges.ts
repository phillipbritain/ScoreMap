import type { CssDeclaration } from './cssDeclarations.ts'

/** A declaration that computes differently on the base and the working tree, or is on only one. */
export interface CssChange {
  rule: string
  property: string
  /** Its value on the base, if the base has it. */
  base: string | undefined
  /** Its value on the working tree, if the working tree has it. */
  work: string | undefined
}

/** The declarations whose computed values differ between the base and the working tree, by rule and property. */
export function cssChanges(base: readonly CssDeclaration[], work: readonly CssDeclaration[]): CssChange[] {
  const key = ({ rule, property }: CssDeclaration) => `${rule}\n${property}`
  const before = new Map(base.map((declaration) => [key(declaration), declaration]))
  const after = new Map(work.map((declaration) => [key(declaration), declaration]))
  const changes: CssChange[] = []
  for (const k of new Set([...before.keys(), ...after.keys()])) {
    const was = before.get(k)
    const now = after.get(k)
    if (was?.value === now?.value) continue
    const { rule, property } = (was ?? now)!
    changes.push({ rule, property, base: was?.value, work: now?.value })
  }
  return changes.sort((a, b) => order(a.rule, b.rule) || order(a.property, b.property))
}

function order(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}
