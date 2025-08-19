import { useMemo } from 'react';
import * as THREE from 'three';
import { MeshTransmissionMaterial } from '@react-three/drei';
import {Liquid} from "../../core/fx/liquids.tsx";


type Vec3 = [number, number, number];

export interface LiquidBounds {
    center: Vec3;
    radius: number;
    height: number;
    bottom: number;
    radii: number[];
}

interface FlaskProps {
    position?: Vec3;
    fill?: number;
    liquidColor?: string;
    children?: React.ReactNode | ((bounds: LiquidBounds) => React.ReactNode);
}

export function Flask({
                          position = [0, 0, 0],
                          fill = 0.55,
                          liquidColor = '#9ad0ff',
                          children,
                      }: FlaskProps) {
    const f = Math.max(0, Math.min(1, fill));

    const {
        glassGeom, neckGeom, bounds
    } = useMemo(() => {
        const h = 0.26;
        const steps = [
            { y: 0.000, r: 0.00 },
            { y: 0.004, r: 0.03 },
            { y: 0.008, r: 0.06 },
            { y: 0.03, r: 0.075 },
            { y: 0.08, r: 0.09 },
            { y: 0.13, r: 0.065 },
            { y: 0.18, r: 0.045 },
            { y: 0.23, r: 0.035 },
            { y: 0.24, r: 0.036 },
            { y: 0.26, r: 0.038 }
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

        const shrink = 0.001;
        const fullHeight = steps[steps.length - 1].y - steps[1].y;
        const liquidHeight = fullHeight * f;
        const bottom = steps[1].y;

        const samples = 32;
        const radii: number[] = [];
        let maxR = 0;
        for (let i = 0; i <= samples; i++) {
            const y = bottom + (liquidHeight * i) / samples;
            const r = Math.max(0, interpRadius(steps, y) - shrink);
            radii.push(r);
            maxR = Math.max(maxR, r);
        }

        const midY = bottom + liquidHeight / 2;

        const bounds: LiquidBounds = {
            center: [0, midY, 0],
            radius: maxR * 0.99,
            height: liquidHeight, // << это теперь реальная высота жидкости
            bottom,
            radii,
        };


        const neckGeom = new THREE.CylinderGeometry(0.036, 0.036, 0.001, 32);
        neckGeom.translate(0, 0.25, 0);

        return { glassGeom, neckGeom, bounds };
    }, [fill]);

    const glassMatProps = {
        thickness: 0.4,
        transmission: 1,
        roughness: 0.05,
        chromaticAberration: 0.03,
        anisotropy: 0.02,
        ior: 1.7,
        distortion: 0.01,
    } as const;

    return (
        <group position={position}>
            <mesh geometry={glassGeom} castShadow receiveShadow>
                <MeshTransmissionMaterial {...glassMatProps} />
            </mesh>
            <mesh geometry={neckGeom}>
                <MeshTransmissionMaterial {...glassMatProps} />
            </mesh>
            <Liquid profile={bounds} fill={f} color={liquidColor} />
            {typeof children === 'function'
             ? (children as (b: LiquidBounds) => React.ReactNode)(bounds)
             : children}
        </group>
    );
}
