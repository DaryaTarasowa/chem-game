
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import { LabTable, Flask } from './components';
import { SimpleHUD as HUD } from '../ui/HUD';
import {useLabStore} from "../state/useLabStore.ts";
import {Bubbles} from "../core/fx/particles.tsx";

export default function LabScene() {
    const bubblesOn = useLabStore(s => s.ctx.activeEffects.includes('bubbles'));
    return (
        <>
            <Canvas shadows camera={{ position: [0, 1.2, 2.2], fov: 45 }}>
                <ambientLight intensity={0.6} />
                <directionalLight position={[3,3,2]} castShadow intensity={1.2} />
                <Environment preset="apartment" />
                <LabTable />

                // scenes/LabScene.tsx (фрагмент)
                <Flask fill={0.65} liquidColor="#a7d9ff">
                    {(b) => (
                        <Bubbles
                            enabled={bubblesOn}
                            center={[0, b.center[1], 0]}      // local space
                            radius={b.radius}                 // fallback
                            height={b.height}                 // fallback
                            profile={{ bottom: b.bottom, height: b.height, radii: b.radii }}
                            count={220}
                        />
                    )}
                </Flask>

                <OrbitControls enablePan={false} minDistance={1.5} maxDistance={3} />
            </Canvas>
            <HUD />
        </>
    );
}
