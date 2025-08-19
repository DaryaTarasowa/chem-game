// scenes/components/Flask.tsx
import {useMemo} from 'react';
import * as THREE from 'three';
import {MeshTransmissionMaterial} from '@react-three/drei';

type Vec3 = [number, number, number];

export interface LiquidBounds {
    center: Vec3;      // local center of the liquid column
    radius: number;    // max radius within the liquid (safety margin)
    height: number;    // liquid column height
    bottom: number;    // local Y of liquid bottom
    radii: number[];   // sampled radii along height (0..1 -> bottom..top)
}

interface FlaskProps {
    position?: Vec3;
    scale?: number;
    fill?: number;           // 0..1
    liquidColor?: string;
    children?: React.ReactNode | ((bounds: LiquidBounds) => React.ReactNode);
}

export function Flask({
                          position = [0, 0.15, 0],
                          scale = 3,
                          fill = 0.55,
                          liquidColor = '#9ad0ff',
                          children,
                      }: FlaskProps) {
    const f = Math.max(0, Math.min(1, fill));

    const {
        glassGeom, innerGeom, neckGeom, baseGeom, surfaceGeom, bounds
    } = useMemo(() => {
        const h = 0.26;
        const y0 = -h / 2;
        const steps = [
            {y: y0 + 0.00, r: 0.00},
            {y: y0 + 0.008, r: 0.06},
            {y: y0 + 0.03, r: 0.075},
            {y: y0 + 0.08, r: 0.09},
            {y: y0 + 0.13, r: 0.065},
            {y: y0 + 0.18, r: 0.045},
            {y: y0 + 0.23, r: 0.035},
            {y: y0 + 0.24, r: 0.036},
            {y: y0 + 0.26, r: 0.00},
        ];
        const toV2 = (arr: { y: number; r: number }[]) =>
            arr.map(p => new THREE.Vector2(p.r, p.y));
        const glassGeom = new THREE.LatheGeometry(toV2(steps), 48);

        function interpRadius(points: { y: number; r: number }[], y: number): number {
            for (let i = 0; i < points.length - 1; i++) {
                const a = points[i], b = points[i + 1];
                if (y >= a.y && y <= b.y) {
                    const t = (y - a.y) / Math.max(1e-6, b.y - a.y);
                    return THREE.MathUtils.lerp(a.r, b.r, t);
                }
            }
            return y < points[0].y ? points[0].r : points[points.length - 1].r;
        }

        const shrink = 0.004;
        const liquidBottomY = steps[1].y + 0.002;   // just above base ring
        const liquidTopY = y0 + h * f * 0.88;       // below shoulder
        const liquidProfile = steps
            .filter(p => p.y >= liquidBottomY && p.y <= liquidTopY)
            .map(p => ({y: p.y, r: Math.max(0, p.r - shrink)}));
        const topR = Math.max(0, interpRadius(steps, liquidTopY) - shrink);
        liquidProfile.push({y: liquidTopY, r: topR});

        const innerGeom = new THREE.LatheGeometry(toV2(liquidProfile), 48);

        const neckGeom = new THREE.CylinderGeometry(0.036, 0.036, 0.02, 32);
        neckGeom.translate(0, y0 + 0.24 + 0.01, 0);
        const baseGeom = new THREE.CylinderGeometry(0.10, 0.10, 0.008, 48);
        baseGeom.translate(0, y0 - 0.004, 0);
        const surfaceGeom = new THREE.CircleGeometry(topR, 48);
        surfaceGeom.rotateX(-Math.PI / 2);
        surfaceGeom.translate(0, liquidTopY + 0.001, 0);

        // Sample radii along the liquid column (0..1 bottom->top)
        const height = liquidTopY - liquidBottomY;
        const samples = 32;
        const radii: number[] = [];
        let maxR = 0;
        for (let i = 0; i <= samples; i++) {
            const y = liquidBottomY + (height * i) / samples;
            const r = Math.max(0, interpRadius(steps, y) - shrink);
            radii.push(r);
            maxR = Math.max(maxR, r);
        }

        const midY = liquidBottomY + height / 2;
        const bounds: LiquidBounds = {
            center: [0, midY, 0],
            radius: maxR * 0.92,   // safety margin
            height,
            bottom: liquidBottomY,
            radii,
        };

        return {glassGeom, innerGeom, neckGeom, baseGeom, surfaceGeom, bounds};
    }, [fill]);

    const glassMatProps = {
        thickness: 0.2,
        transmission: 1,
        roughness: 0.15,
        chromaticAberration: 0.02,
        anisotropy: 0.02,
        ior: 1.5,
        distortion: 0.0,
    } as const;

    const liquidMat = useMemo(
        () =>
            new THREE.MeshPhysicalMaterial({
                                               color: new THREE.Color(liquidColor),
                                               roughness: 0.35,
                                               metalness: 0.0,
                                               transparent: true,
                                               opacity: 0.7,                 // ↓ a bit lower to reveal bubbles
                                               depthWrite: false,            // do not occlude bubbles behind
                                               side: THREE.DoubleSide,       // render both sides of the thin shell
                                           }),
        [liquidColor]
    );

    const surfaceMat = useMemo(
        () =>
            new THREE.MeshStandardMaterial({
                                               color: new THREE.Color(liquidColor).multiplyScalar(
                                                   1.1),
                                               transparent: true,
                                               opacity: 0.5,
                                               roughness: 0.2,
                                               metalness: 0.0,
                                               depthWrite: false,            // avoid z-fighting with bubbles
                                           }),
        [liquidColor]
    );

    return (
        <group position={position} scale={[scale, scale, scale]}>
            <mesh geometry={glassGeom} castShadow receiveShadow>
                <MeshTransmissionMaterial {...glassMatProps} />
            </mesh>
            <mesh geometry={neckGeom} castShadow>
                <MeshTransmissionMaterial {...glassMatProps} />
            </mesh>
            <mesh geometry={baseGeom} receiveShadow>
                <meshStandardMaterial color="#6b5b4a" roughness={0.8}/>
            </mesh>
            <mesh geometry={innerGeom} castShadow renderOrder={2}>
                <primitive object={liquidMat} attach="material"/>
            </mesh>
            <mesh geometry={surfaceGeom} renderOrder={3}>
                <primitive object={surfaceMat} attach="material"/>
            </mesh>

            {typeof children === 'function' ? (children as (b: LiquidBounds) => React.ReactNode)(
                bounds) : children}
        </group>
    );
}
