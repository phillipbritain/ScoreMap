// PROTOTYPE (throwaway): the switcher's label for ?panelStepProto= (see panelStepProto.ts).
import type { PanelStepProto } from './panelStepProto'

export function PanelStepProtoBar({ variant }: { variant: PanelStepProto }) {
  return (
    <div style={{
      position: 'fixed', top: 8, left: 8, zIndex: 10, padding: '4px 10px', borderRadius: 6,
      background: '#000c', color: '#fff', font: '12px system-ui', pointerEvents: 'none',
    }}>
      Panel steps: <b>{variant === 'arrow' ? 'A · arrow' : 'B · above its part'}</b> ([ / ])
    </div>
  )
}

