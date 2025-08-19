// core/fx/particles.tsx (replace Bubbles with this version)
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

type Vec3 = [number, number, number];

interface RadiusProfile {
    bottom: number;     // local Y of liquid bottom
    height: number;     // liquid column height
    radii: number[];    // sampled radii along height (0..1)
}

interface BubblesProps {
    center?: Vec3;        // local center (x,y,z)
    radius?: number;      // fallback max radius
    height?: number;      // fallback height
    count?: number;
    enabled?: boolean;
    spawnBand?: number;   // 0..1 bottom band for spawning
    topFade?: number;     // 0..1 top segment to fade size
    profile?: RadiusProfile;
    wallMargin?: number;  // extra margin from glass (in scene units)
}

/** Linear sample of radius profile at normalized y in [0..1]. */
function sampleRadius(profile: RadiusProfile, yNorm: number): number {
    const arr = profile.radii;
    const n = arr.length;
    if (n === 0) return 0;
    const t = THREE.MathUtils.clamp(yNorm, 0, 1) * (n - 1);
    const i = Math.floor(t);
    const frac = t - i;
    if (i >= n - 1) return arr[n - 1];
    return THREE.MathUtils.lerp(arr[i], arr[i + 1], frac);
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
                            wallMargin = 0.003, // small constant gap from glass
                        }: BubblesProps) {
    const meshRef = useRef<THREE.InstancedMesh>(null!);
    const geometry = useMemo(() => new THREE.SphereGeometry(1, 10, 10), []);

    // Bright, always-visible bubbles (debug-friendly)
    const material = useMemo(
        () =>
            new THREE.MeshBasicMaterial({
                                            color: '#ff4040',     // bright red
                                            transparent: true,
                                            opacity: 0.95,
                                            depthWrite: false,    // do not write to depth buffer
                                            toneMapped: false,    // keep full brightness
                                        }),
        []
    );

    // Helper: allowed radius at world Y (consider profile if provided)
    const allowedRadiusAt = (y: number): number => {
        if (profile) {
            const yNorm = (y - profile.bottom) / Math.max(1e-6, profile.height);
            return sampleRadius(profile, yNorm);
        }
        return radius;
    };

    type Seed = {
        x: number; y: number; z: number;
        s: number; spd: number; phi: number; drift: number; baseY: number;
    };

    const seeds = useMemo<Seed[]>(() => {
        const [cx, cy] = center;
        const H = profile?.height ?? height;
        const bottom = profile?.bottom ?? (cy - H * 0.5);

        return new Array(count).fill(0).map(() => {
            const baseY = bottom + Math.random() * (H * spawnBand);
            const s = Math.random() * 0.022 + 0.014;            // bubble size (radius in model units)
            // compute spawn radius with safety margin and own size
            const rAllowed = Math.max(
                0,
                (allowedRadiusAt(baseY) - wallMargin - s * 1.2) * 0.95
            );
            const a = Math.random() * Math.PI * 2;
            const r = Math.sqrt(Math.random()) * rAllowed;
            const x = Math.cos(a) * r;
            const z = Math.sin(a) * r;
            const spd = 0.06 + Math.random() * 0.06;
            const phi = Math.random() * Math.PI * 2;
            const drift = 0.002 + Math.random() * 0.006;
            return { x, y: baseY, z, s, spd, phi, drift, baseY };
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [count, spawnBand, profile?.bottom, profile?.height, center[1]]);

    useFrame((_, dt) => {
        if (!enabled || !meshRef.current) return;

        const m = new THREE.Matrix4();
        const [cx, cy, cz] = center;
        const H = profile?.height ?? height;
        const top = cy + H * 0.5;
        const bottom = profile?.bottom ?? (cy - H * 0.5);

        for (let i = 0; i < seeds.length; i++) {
            const p = seeds[i];

            // rise
            p.y += p.spd * dt;

            // lateral drift
            p.phi += dt * 1.6;
            let tx = p.x + Math.sin(p.phi) * p.drift;
            let tz = p.z + Math.sin(p.phi * 0.7 + 1.23) * p.drift;

            // compute allowed radius at current height minus bubble's own size + margin
            const rAllowedRaw = allowedRadiusAt(p.y);
            const rAllowed = Math.max(0, rAllowedRaw - wallMargin - p.s * 1.2);
            const rr = Math.hypot(tx, tz);

            if (rr > rAllowed) {
                // gentle push-in from wall: scale vector and also reduce drift near wall
                const k = rAllowed / (rr + 1e-6);
                tx *= k * 0.98; // slight extra shrink to keep off the wall
                tz *= k * 0.98;
                // also softly reduce amplitude of future drift when near wall
                p.drift *= 0.98;
                if (p.drift < 0.0015) p.drift = 0.0015; // keep some motion
            } else {
                // slowly restore drift when safely inside
                p.drift = Math.min(p.drift * 1.005, 0.006);
            }

            // fade near the top
            const tNorm = (p.y - bottom) / H; // 0..1
            const fadeStart = 1 - topFade;
            const fadeK = THREE.MathUtils.clamp((tNorm - fadeStart) / (1 - fadeStart), 0, 1);
            const s = Math.max(0.0001, p.s * (1 - fadeK));

            // recycle at the very top
            if (p.y > top) {
                p.y = p.baseY = bottom + Math.random() * (H * spawnBand);
                const rSpawn = Math.max(0, allowedRadiusAt(p.y) - wallMargin - p.s * 1.2);
                const a = Math.random() * Math.PI * 2;
                const r = Math.sqrt(Math.random()) * rSpawn * 0.95;
                p.x = Math.cos(a) * r;
                p.z = Math.sin(a) * r;
                p.phi = Math.random() * Math.PI * 2;
                p.drift = 0.002 + Math.random() * 0.006;
            }

            m.identity()
                .makeScale(s, s, s)
                .setPosition(cx + tx, cy + p.y, cz + tz); // include center.y

            meshRef.current.setMatrixAt(i, m);
        }
        meshRef.current.instanceMatrix.needsUpdate = true;
    });

    if (!enabled) return null;
    return <instancedMesh ref={meshRef} args={[geometry, material, count]} renderOrder={3} />;
}
