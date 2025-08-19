import { useMemo, Fragment } from 'react';
import * as THREE from 'three';

export interface RadiusProfile {
    bottom: number;
    height: number;
    radii: number[]; // sampled 0..1
}

interface LiquidProps {
    profile: RadiusProfile;
    fill: number;           // 0..1
    color?: string;
}

export function Liquid({ profile, fill, color = '#9ad0ff' }: LiquidProps) {
    const { mesh, surfaceY, surfaceR } = useMemo(() => {
        const { bottom, height, radii } = profile;
        const clampedFill = THREE.MathUtils.clamp(fill, 0, 1);
        const maxIndex = Math.floor((radii.length - 1) * clampedFill);

        const points: THREE.Vector2[] = [];
        for (let i = 0; i <= maxIndex; i++) {
            const y = bottom + (i / (radii.length - 1)) * height;
            points.push(new THREE.Vector2(radii[i], y));
        }

        const surfaceY = bottom + (maxIndex / (radii.length - 1)) * height;
        const surfaceR = radii[maxIndex];

        const mesh = new THREE.LatheGeometry(points, 48);
        return { mesh, surfaceY, surfaceR };
    }, [profile, fill]);

    const material = useMemo(() =>
                                 new THREE.MeshPhysicalMaterial({
                                                                    color: new THREE.Color(color),
                                                                    roughness: 0.05,
                                                                    metalness: 0,
                                                                    transmission: 0.95,
                                                                    thickness: 0.04,
                                                                    ior: 1.33,
                                                                    transparent: true,
                                                                    opacity: 1.0,
                                                                    envMapIntensity: 1.0,
                                                                }), [color]
    );

    const surfaceMaterial = useMemo(() =>
                                        new THREE.MeshStandardMaterial({
                                                                           color: new THREE.Color(color).multiplyScalar(1.1),
                                                                           roughness: 0.1,
                                                                           metalness: 0.0,
                                                                           transparent: true,
                                                                           opacity: 0.7,
                                                                       }), [color]
    );

    const surface = useMemo(() => {
        const geom = new THREE.CircleGeometry(surfaceR, 48);
        geom.rotateX(-Math.PI / 2);
        geom.translate(0, surfaceY + 0.0001, 0);
        return geom;
    }, [surfaceY, surfaceR]);

    return (
        <Fragment>
            <mesh geometry={mesh} castShadow receiveShadow>
                <primitive object={material} attach="material" />
            </mesh>
            <mesh geometry={surface} castShadow receiveShadow>
                <primitive object={surfaceMaterial} attach="material" />
            </mesh>
        </Fragment>
    );
}
