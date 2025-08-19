
export function LabTable() {
    // Simple wooden-like plane as a table
    return (
        <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]} receiveShadow>
            <planeGeometry args={[3, 2]} />
            <meshStandardMaterial color="#8b6f47" roughness={0.9} metalness={0.0} />
        </mesh>
    );
}
