/**
 * The label over the globe in a demo (ADR-0019), saying its games are made up, so a screenshot of one
 * can't pass them off as real. It can't be clicked: the globe takes clicks through it.
 */
export function DemoLabel() {
  return (
    <p className="demo-label">
      Demo Mode
    </p>
  )
}
