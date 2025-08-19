import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

type Vec3 = [number, number, number];

interface RadiusProfile {
    bottom: number;
    height: number;
    radii: number[]; // sampled 0..1
}

interface BubblesProps {
    center?: Vec3;
    radius?: number;   // fallback
    height?: number;   // fallback
    count?: number;
    enabled?: boolean;
    spawnBand?: number;    // 0..1 (bottom part)
    topFade?: number;      // 0..1 (top fade)
    profile?: RadiusProfile;
    wallMarginFrac?: number; // fraction of radius to keep away from wall (e.g. 0.06)
    innerShrink?: number;    // extra inset from glass wall (m)
}

function sampleRadius(profile: RadiusProfile, yNorm: number): number {
    const arr = profile.radii;
    const n = arr.length;
    if (!n) return 0;
    const t = THREE.MathUtils.clamp(yNorm, 0, 1) * (n - 1);
    const i = Math.floor(t);
    const f = t - i;
    return i >= n - 1 ? arr[n - 1] : THREE.MathUtils.lerp(arr[i], arr[i + 1], f);
}

export function Bubbles({
                            center = [0, 0, 0],
                            radius = 0.10,
                            height = 0.24,
                            count = 160,
                            enabled = true,
                            spawnBand = 0.18,
                            topFade = 0.22,
                            profile,
                            wallMarginFrac = 0.06, // 6% of local radius
                            innerShrink = 0.004,
                        }: BubblesProps) {
    const meshRef = useRef<THREE.InstancedMesh>(null!);
    const geometry = useMemo(() => new THREE.SphereGeometry(1, 10, 10), []);

    const material = useMemo(
        () =>
            new THREE.MeshStandardMaterial({
                                               color: new THREE.Color('white'),
                                               transparent: true,
                                               opacity: 0.33,
                                               roughness: 0.1,
                                               metalness: 0.3,
                                               emissive: new THREE.Color('#bcdfff'),
                                               emissiveIntensity: 0.2,
                                               depthWrite: false,
                                               depthTest: false,
                                           }),
        []
    );

    // ----- LOCAL coordinate system -----
    // We simulate inside the liquid column centered at centerY:
    //   localBottom = centerY - H/2
    //   localTop    = centerY + H/2
    // We store p.y as LOCAL offset from centerY (i.e., in [-H/2 .. +H/2]).
    const [, centerY, ] = center;
    const H = profile?.height ?? height;

    // Allowed radius sampler: receives LOCAL y, converts to ABS y for profile
    const allowedRadiusAtLocal = (yLocal: number) => {
        const yAbs = centerY + yLocal;
        return profile
               ? sampleRadius(profile, (yAbs - (profile.bottom)) / Math.max(1e-6, H))
               : radius;
    };

    type Seed = { x:number; y:number; z:number; s:number; spd:number; phi:number; drift:number; baseY:number; };

    // StrictMode-safe seeds, generated ONCE; all Y stored as LOCAL offsets
    const seedsRef = useRef<Seed[]>([]);
    if (seedsRef.current.length === 0) {
        const localBottom = -H * 0.5; // relative to centerY
        const minCols = 0.35, maxCols = 0.65; // columns/sec

        seedsRef.current = new Array(count).fill(0).map(() => {
            const y0 = localBottom + Math.random() * (H * spawnBand); // LOCAL
            const rLocal = Math.max(0, allowedRadiusAtLocal(y0) - innerShrink);
            const margin = rLocal * wallMarginFrac;

            const a = Math.random() * Math.PI * 2;
            const r = Math.sqrt(Math.random()) * Math.max(0, rLocal - margin);
            const x = Math.cos(a) * r;
            const z = Math.sin(a) * r;

            const s = THREE.MathUtils.lerp(rLocal * 0.05, rLocal * 0.10, Math.random());
            const spd = H * THREE.MathUtils.lerp(minCols, maxCols, Math.random()); // LOCAL
            const phi = Math.random() * Math.PI * 2;
            const drift = rLocal * THREE.MathUtils.lerp(0.01, 0.03, Math.random());

            return { x, y: y0, z, s, spd, phi, drift, baseY: y0 };
        });
        // console.log('Bubbles seeds initialized once:', seedsRef.current.length);
    }
    const seeds = seedsRef.current;

    useFrame((_, dt) => {
        if (!enabled || !meshRef.current) return;

        const m = new THREE.Matrix4();
        const [cx, , cz] = center;
        const localBottom = -H * 0.5;
        const localTop    =  H * 0.5;

        for (let i = 0; i < seeds.length; i++) {
            const p = seeds[i];

            // rise (LOCAL)
            p.y += p.spd * dt;

            // drift (LOCAL)
            p.phi += dt * 1.6;
            let tx = p.x + Math.sin(p.phi) * p.drift;
            let tz = p.z + Math.sin(p.phi * 0.7 + 1.23) * p.drift;

            // clamp inside liquid radius at current LOCAL height
            let rLocal = Math.max(0, allowedRadiusAtLocal(p.y) - innerShrink);
            const margin = rLocal * wallMarginFrac + p.s * 0.6;
            const rAllowed = Math.max(0, rLocal - margin);
            const rr = Math.hypot(tx, tz);

            if (rr > rAllowed) {
                const k = rAllowed / (rr + 1e-6);
                tx *= k * 0.98;
                tz *= k * 0.98;
                p.drift = THREE.MathUtils.lerp(p.drift, rLocal * 0.01, 0.2);
            } else {
                p.drift = THREE.MathUtils.clamp(p.drift * 1.01, rLocal * 0.01, rLocal * 0.03);
            }

            // fade near the top
            const tNorm = (p.y - localBottom) / H;
            const fadeStart = 1 - topFade;
            const fadeK = THREE.MathUtils.clamp((tNorm - fadeStart) / (1 - fadeStart), 0, 1);
            const s = Math.max(0.0001, p.s * (1 - fadeK));

            // recycle at top (LOCAL)
            if (p.y > localTop) {
                p.y = p.baseY = localBottom + Math.random() * (H * spawnBand);
                const r0 = Math.max(0, allowedRadiusAtLocal(p.y) - innerShrink);
                const m0 = r0 * wallMarginFrac;
                const a = Math.random() * Math.PI * 2;
                const r = Math.sqrt(Math.random()) * Math.max(0, r0 - m0);
                p.x = Math.cos(a) * r;
                p.z = Math.sin(a) * r;
                p.phi = Math.random() * Math.PI * 2;
                p.drift = r0 * THREE.MathUtils.lerp(0.01, 0.03, Math.random());
            }

            // place in LOCAL of Flask group: XZ around (0,0), Y around centerY
            m.identity()
                .makeScale(s, s, s)
                .setPosition(cx + tx, centerY + p.y, cz + tz);

            meshRef.current.setMatrixAt(i, m);
        }
        meshRef.current.instanceMatrix.needsUpdate = true;
    });

    if (!enabled) return null;
    return <instancedMesh ref={meshRef} args={[geometry, material, count]} renderOrder={3} />;
}
