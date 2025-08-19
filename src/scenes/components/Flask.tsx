import { useMemo } from 'react';
import * as THREE from 'three';
import { MeshTransmissionMaterial } from '@react-three/drei';


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

    const {
        glassGeom, rimGeom, bounds
    } = useMemo(() => {
        const steps = [
            { y: 0.000, r: 0.00 },
            { y: 0.002, r: 0.065 },
            { y: 0.004, r: 0.090 },
            { y: 0.03, r: 0.095 },
            { y: 0.17, r: 0.036 },
            { y: 0.255, r: 0.038 },  // start neck opening
            { y: 0.257, r: 0.040 },  // flare out (lip outer edge)
            { y: 0.259, r: 0.038 },  // curve back in
            { y: 0.260, r: 0.037 }   // inside rim
        ];

        const toV2 = (arr: { y: number; r: number }[]) =>
            arr.map(p => new THREE.Vector2(p.r, p.y));
        const glassGeom = new THREE.LatheGeometry(toV2(steps), 48);
        glassGeom.computeVertexNormals();
        glassGeom.scale(1, 1, -1);

        const top = steps[steps.length - 1];
        const rimGeom = new THREE.CylinderGeometry(
            top.r, // top radius
            top.r, // bottom radius (same, so it's a straight ring)
            0.002, // thin height
            64,    // segments
            1,
            true   // open ended (so we don’t get caps)
        );
        rimGeom.translate(0, top.y + 0.001, 0);

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

        const shrink = 0.003;
        const bottom = steps[1].y;
        const fullHeight = steps[steps.length - 1].y - bottom;
        const liquidTop = bottom + fullHeight * fill;
        const liquidHeight = liquidTop - bottom;

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
            height: liquidHeight,
            bottom,
            radii,
        };



        return { glassGeom, rimGeom, bounds };
    }, [fill]);

    const glassMatProps = {
        thickness: 0.3,           // a bit thinner walls
        transmission: 0.95,          // keep it transparent
        roughness: 0.18,          // more diffuse, less glossy
        chromaticAberration: 0.005, // very subtle
        anisotropy: 0.01,
        ior: 1.5,                 // closer to real glass
        distortion: 0.002,        // almost none
        distortionScale: 0.2,     // reduce distortion strength
        side: THREE.FrontSide,
    };

    return (
        <group position={position}>
            <mesh geometry={glassGeom} castShadow receiveShadow>
                <MeshTransmissionMaterial {...glassMatProps}/>
            </mesh>
            <mesh geometry={rimGeom}>
                <MeshTransmissionMaterial {...glassMatProps} side={THREE.DoubleSide} />
            </mesh>
            {typeof children === 'function'
             ? (children as (b: LiquidBounds) => React.ReactNode)(bounds)
             : children}
        </group>
    );
}
