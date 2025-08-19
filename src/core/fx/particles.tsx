import {useEffect, useMemo, useRef} from 'react';
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
    count?: number;
    enabled?: boolean;
    spawnBand?: number;    // 0..1 (bottom part)
    topFade?: number;      // 0..1 (top fade)
    profile: RadiusProfile;
    wallMarginFrac?: number; // fraction of radius to keep away from wall (e.g. 0.06)
    innerShrink?: number;    // extra inset from glass wall (m)
}

interface FoamProps {
    center?: Vec3;
    count?: number;
    enabled?: boolean;
    profile: RadiusProfile;
    wallMarginFrac?: number;
    innerShrink?: number;
    exitHeight?: number;
}

function sampleRadius(profile: RadiusProfile, yNorm: number): number {
    const arr = profile.radii;
    if (!arr.length) return 0;
    const t = THREE.MathUtils.clamp(yNorm, 0, 1) * (arr.length - 1);
    const i = Math.floor(t);
    const f = t - i;
    return i >= arr.length - 1
           ? arr[arr.length - 1]
           : THREE.MathUtils.lerp(arr[i], arr[i + 1], f);
}

/* -------------------- FOAM -------------------- */
export function Foam({
                         center = [0, 0, 0],
                         count = 60,
                         enabled = true,
                         profile,
                         wallMarginFrac = 0.06,
                         innerShrink = 0.004,
                         exitHeight = 0.15, // height above rim before recycle
                     }: FoamProps) {
    const meshRef = useRef<THREE.InstancedMesh>(null!);
    const geometry = useMemo(() => new THREE.SphereGeometry(1, 8, 8), []);

    useEffect(() => {
        if (enabled) {
            const localTop = H * 0.5;
            seedsRef.current.forEach((p) => {
                const r0 = Math.max(0, allowedRadiusAtLocal(localTop) - innerShrink);
                const margin = r0 * wallMarginFrac;
                const a = Math.random() * Math.PI * 2;
                const r = Math.sqrt(Math.random()) * Math.max(0, r0 - margin);

                p.x = Math.cos(a) * r;
                p.z = Math.sin(a) * r;
                p.y = localTop;
                p.s = p.baseS;
                p.phi = Math.random() * Math.PI * 2;
            });
        }
    }, [enabled]);


    const material = useMemo(
        () =>
            new THREE.MeshStandardMaterial({
                                               color: new THREE.Color('white'),
                                               roughness: 1,
                                               metalness: 0,
                                               transparent: true,
                                               opacity: 0.85,
                                               depthWrite: false,
                                           }),
        []
    );

    const [, centerY] = center;
    const H = profile.height;
    const localTop = H * 0.5; // liquid surface

    const allowedRadiusAtLocal = (yLocal: number) => {
        const yAbs = centerY + yLocal;
        return sampleRadius(profile, (yAbs - profile.bottom) / Math.max(1e-6, H))
    };

    type Seed = {
        x: number; y: number; z: number;
        s: number; spd: number; growth: number;
        phi: number; drift: number; baseS: number;
    };

    const seedsRef = useRef<Seed[]>([]);
    if (seedsRef.current.length === 0) {
        seedsRef.current = new Array(count).fill(0).map(() => {
            const rLocal = Math.max(0, allowedRadiusAtLocal(localTop) - innerShrink);
            const margin = rLocal * wallMarginFrac;

            const a = Math.random() * Math.PI * 2;
            const r = Math.sqrt(Math.random()) * Math.max(0, rLocal - margin);

            const baseS = THREE.MathUtils.lerp(rLocal * 0.06, rLocal * 0.11, Math.random());
            return {
                x: Math.cos(a) * r,
                y: localTop,
                z: Math.sin(a) * r,
                s: baseS,
                baseS,
                spd: H * THREE.MathUtils.lerp(0.15, 0.35, Math.random()),
                growth: THREE.MathUtils.lerp(baseS * 0.15, baseS * 0.3, Math.random()),
                phi: Math.random() * Math.PI * 2,
                drift: rLocal * THREE.MathUtils.lerp(0.006, 0.02, Math.random()),
            };
        });
    }
    const seeds = seedsRef.current;

    useFrame((_, dt) => {
        if (!enabled || !meshRef.current) return;
        const m = new THREE.Matrix4();
        const [cx, , cz] = center;
        const recycleY = localTop + exitHeight;

        for (let i = 0; i < seeds.length; i++) {
            const p = seeds[i];

            // rise + grow
            p.y += p.spd * dt;
            p.s += p.growth * dt;

            // drift
            p.phi += dt * 1.2;
            let tx = p.x + Math.sin(p.phi) * p.drift;
            let tz = p.z + Math.sin(p.phi * 0.7 + 1.23) * p.drift;

            if (p.y <= localTop) {
                // keep inside flask
                const rLocal = Math.max(0, allowedRadiusAtLocal(p.y) - innerShrink);
                const rAllowed = Math.max(0, rLocal - rLocal * wallMarginFrac - p.s * 0.6);
                const rr = Math.hypot(tx, tz);
                if (rr > rAllowed) {
                    const k = rAllowed / (rr + 1e-6);
                    tx *= k;
                    tz *= k;
                }
            } else {
                // outside -> shrink/pop
                p.s *= 0.985;
            }

            // recycle
            if (p.y > recycleY || p.s < 0.003) {
                const r0 = Math.max(0, allowedRadiusAtLocal(localTop) - innerShrink);
                const margin = r0 * wallMarginFrac;
                const a = Math.random() * Math.PI * 2;
                const r = Math.sqrt(Math.random()) * Math.max(0, r0 - margin);
                p.x = Math.cos(a) * r;
                p.z = Math.sin(a) * r;
                p.y = localTop;
                p.s = p.baseS;
                p.phi = Math.random() * Math.PI * 2;
            }

            m.identity()
                .makeScale(p.s, p.s, p.s)
                .setPosition(cx + tx, centerY + p.y, cz + tz);
            meshRef.current.setMatrixAt(i, m);
        }
        meshRef.current.instanceMatrix.needsUpdate = true;
    });

    if (!enabled) return null;
    return <instancedMesh ref={meshRef} args={[geometry, material, count]} renderOrder={3} />;
}

/* -------------------- BUBBLES -------------------- */
export function Bubbles({
                            center = [0, 0, 0],
                            count = 160,
                            enabled = true,
                            spawnBand = 0.18,
                            topFade = 0.22,
                            profile,
                            wallMarginFrac = 0.06,
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

    const [, centerY] = center;
    const H = profile.height;
    const localBottom = -H * 0.5;
    const localTop = H * 0.5;

    const allowedRadiusAtLocal = (yLocal: number) => {
        const yAbs = centerY + yLocal;
        return sampleRadius(profile, (yAbs - profile.bottom) / Math.max(1e-6, H))
    };

    type Seed = { x:number; y:number; z:number; s:number; spd:number; phi:number; drift:number; baseY:number };

    const seedsRef = useRef<Seed[]>([]);
    if (seedsRef.current.length === 0) {
        seedsRef.current = new Array(count).fill(0).map(() => {
            const y0 = localBottom + Math.random() * (H * spawnBand);
            const rLocal = Math.max(0, allowedRadiusAtLocal(y0) - innerShrink);
            const margin = rLocal * wallMarginFrac;

            const a = Math.random() * Math.PI * 2;
            const r = Math.sqrt(Math.random()) * Math.max(0, rLocal - margin);

            return {
                x: Math.cos(a) * r,
                y: y0,
                z: Math.sin(a) * r,
                s: THREE.MathUtils.lerp(rLocal * 0.05, rLocal * 0.1, Math.random()),
                spd: H * THREE.MathUtils.lerp(0.35, 0.65, Math.random()),
                phi: Math.random() * Math.PI * 2,
                drift: rLocal * THREE.MathUtils.lerp(0.01, 0.03, Math.random()),
                baseY: y0,
            };
        });
    }
    const seeds = seedsRef.current;

    useFrame((_, dt) => {
        if (!enabled || !meshRef.current) return;
        const m = new THREE.Matrix4();
        const [cx, , cz] = center;

        for (let i = 0; i < seeds.length; i++) {
            const p = seeds[i];
            p.y += p.spd * dt;

            // drift
            p.phi += dt * 1.6;
            let tx = p.x + Math.sin(p.phi) * p.drift;
            let tz = p.z + Math.sin(p.phi * 0.7 + 1.23) * p.drift;

            // clamp inside liquid
            const rLocal = Math.max(0, allowedRadiusAtLocal(p.y) - innerShrink);
            const rAllowed = Math.max(0, rLocal - (rLocal * wallMarginFrac + p.s * 0.6));
            const rr = Math.hypot(tx, tz);
            if (rr > rAllowed) {
                const k = rAllowed / (rr + 1e-6);
                tx *= k;
                tz *= k;
            }

            // fade near top
            const tNorm = (p.y - localBottom) / H;
            const fadeStart = 1 - topFade;
            const fadeK = THREE.MathUtils.clamp((tNorm - fadeStart) / (1 - fadeStart), 0, 1);
            const s = Math.max(0.0001, p.s * (1 - fadeK));

            // recycle
            if (p.y > localTop) {
                const y0 = localBottom + Math.random() * (H * spawnBand);
                const r0 = Math.max(0, allowedRadiusAtLocal(y0) - innerShrink);
                const margin = r0 * wallMarginFrac;
                const a = Math.random() * Math.PI * 2;
                const r = Math.sqrt(Math.random()) * Math.max(0, r0 - margin);
                p.x = Math.cos(a) * r;
                p.z = Math.sin(a) * r;
                p.y = y0;
                p.baseY = y0;
                p.phi = Math.random() * Math.PI * 2;
                p.drift = r0 * THREE.MathUtils.lerp(0.01, 0.03, Math.random());
            }

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
