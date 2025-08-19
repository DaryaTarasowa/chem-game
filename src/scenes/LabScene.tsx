import {Canvas} from '@react-three/fiber';
import {OrbitControls, Environment} from '@react-three/drei';
import {LabTable, Flask} from './components';
import {SimpleHUD as HUD} from '../ui/HUD';
import {useLabStore} from "../state/useLabStore.ts";
import {Bubbles, Foam} from "../core/fx/particles.tsx";
import {Liquid} from "../core/fx/liquids.tsx";

export default function LabScene() {
    const effects = useLabStore(s => s.ctx.activeEffects);
    const bubblesOn = effects.includes('bubbles');
    const foamOn = effects.includes('foam');
    const liquidOn = effects.includes('liquid');
    const liquidColor = useLabStore(s => s.ctx.liquidColor || '#a7d9ff');

    return (
        <>
            <Canvas style={{width: '100vw', height: '100vh'}}
                    shadows
                    camera={{position: [0, 1.2, 2.2], fov: 40}}>
                <Environment preset="apartment" background={false} blur={0.2}/>
                <ambientLight intensity={0.6}/>
                <directionalLight position={[3, 3, 2]} intensity={1.2} castShadow/>


                <LabTable/>
                <Flask fill={0.65} liquidColor="#a7d9ff">
                    {(b) => (
                        <>
                            <Bubbles
                                enabled={bubblesOn}
                                center={[0, b.center[1], 0]}      // local space
                                profile={{bottom: b.bottom, height: b.height, radii: b.radii}}
                                count={220}
                            />
                            <Foam
                                enabled={foamOn}
                                center={[0, b.center[1], 0]}      // local space
                                profile={{bottom: b.bottom, height: b.height, radii: b.radii}}
                                count={20}/>
                            <Liquid profile={b} fill={0.65} color={liquidColor} enabled={liquidOn}/>
                        </>
                    )}
                </Flask>

                <OrbitControls enablePan={false} minDistance={1.5} maxDistance={5}/>
            </Canvas>
            <HUD/>
        </>
    );
}
