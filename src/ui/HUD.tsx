// ui/SimpleHUD.tsx
import { useLabStore } from '../state/useLabStore';

export function SimpleHUD() {
    const ctx = useLabStore(s => s.ctx);
    const add = useLabStore(s => s.addReagent);
    const reset = useLabStore(s => s.reset);

    return (
        <div
            style={{
                position: 'absolute',
                right: 16,
                top: 16,
                width: 260,
                padding: 12,
                background: 'rgba(20,20,24,0.8)',
                color: 'white',
                borderRadius: 12,
                fontFamily: 'sans-serif',
            }}
        >
            <h3 style={{ marginTop: 0 }}>Inventory</h3>
            <div style={{ display: 'grid', gap: 8 }}>
                <button onClick={() => add('main-flask', 'vinegar')}>Add Vinegar</button>
                <button onClick={() => add('main-flask', 'baking_soda')}>Add Baking Soda</button>
                <button onClick={() => add('main-flask', 'salt_na')}>Add Sodium Salt</button>
                <button onClick={() => add('main-flask', 'flame')}>Add Flame</button>
                <button onClick={reset} style={{ marginTop: 8 }}>Reset</button>
            </div>

            <h4>Active effects</h4>
            {ctx.activeEffects.length === 0 ? (
                <div style={{ opacity: 0.7 }}>None</div>
            ) : (
                 <ul>
                     {ctx.activeEffects.map(e => (
                         <li key={e}>{e}</li>
                     ))}
                 </ul>
             )}
        </div>
    );
}
