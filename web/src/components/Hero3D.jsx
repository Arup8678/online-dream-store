import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Float, RoundedBox } from '@react-three/drei';

const M = (color, extra = {}) => ({ color, roughness: 0.35, metalness: 0.15, ...extra });

function Pencil(props) {
  return (
    <group {...props}>
      <mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.12, 0.12, 1.6, 6]} /><meshStandardMaterial {...M('#facc15')} /></mesh>
      <mesh position={[0.95, 0, 0]} rotation={[0, 0, -Math.PI / 2]}><coneGeometry args={[0.12, 0.3, 6]} /><meshStandardMaterial {...M('#f5d6a8')} /></mesh>
      <mesh position={[1.08, 0, 0]} rotation={[0, 0, -Math.PI / 2]}><coneGeometry args={[0.04, 0.1, 6]} /><meshStandardMaterial color="#222" /></mesh>
      <mesh position={[-0.86, 0, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.125, 0.125, 0.14, 12]} /><meshStandardMaterial {...M('#f472b6')} /></mesh>
    </group>
  );
}
function Pen(props) {
  return (
    <group {...props}>
      <mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.08, 0.08, 1.3, 20]} /><meshStandardMaterial {...M('#22d3ee', { metalness: 0.5 })} /></mesh>
      <mesh position={[0.72, 0, 0]} rotation={[0, 0, -Math.PI / 2]}><coneGeometry args={[0.08, 0.22, 20]} /><meshStandardMaterial {...M('#e5e7eb', { metalness: 0.8 })} /></mesh>
      <mesh position={[-0.35, 0.1, 0]}><boxGeometry args={[0.5, 0.025, 0.05]} /><meshStandardMaterial color="#e5e7eb" metalness={0.8} roughness={0.2} /></mesh>
    </group>
  );
}
function Notebook(props) {
  return (
    <group {...props}>
      <RoundedBox args={[1.1, 1.5, 0.22]} radius={0.04}><meshStandardMaterial {...M('#8b7bff')} /></RoundedBox>
      <mesh position={[0.02, 0, 0.115]}><boxGeometry args={[1.0, 1.4, 0.01]} /><meshStandardMaterial color="#f4f2ff" /></mesh>
      <mesh position={[-0.52, 0, 0]}><boxGeometry args={[0.07, 1.5, 0.24]} /><meshStandardMaterial {...M('#5b46d8')} /></mesh>
      <mesh position={[0.15, 0.2, 0.125]}><planeGeometry args={[0.55, 0.55]} /><meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={0.4} /></mesh>
    </group>
  );
}
function Teddy(props) {
  const fur = M('#c98b4a', { roughness: 0.9, metalness: 0 });
  const light = M('#e8c08a', { roughness: 0.9, metalness: 0 });
  return (
    <group {...props}>
      <mesh position={[0, -0.35, 0]}><sphereGeometry args={[0.5, 24, 24]} /><meshStandardMaterial {...fur} /></mesh>
      <mesh position={[0, -0.3, 0.38]} scale={[1, 1.1, 0.6]}><sphereGeometry args={[0.3, 20, 20]} /><meshStandardMaterial {...light} /></mesh>
      <mesh position={[0, 0.33, 0]}><sphereGeometry args={[0.38, 24, 24]} /><meshStandardMaterial {...fur} /></mesh>
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * 0.29, 0.65, 0]}><sphereGeometry args={[0.14, 16, 16]} /><meshStandardMaterial {...fur} /></mesh>
          <mesh position={[s * 0.29, 0.65, 0.07]}><sphereGeometry args={[0.07, 12, 12]} /><meshStandardMaterial {...light} /></mesh>
          <mesh position={[s * 0.13, 0.4, 0.33]}><sphereGeometry args={[0.045, 12, 12]} /><meshStandardMaterial color="#111" /></mesh>
          <mesh position={[s * 0.55, -0.25, 0.1]}><sphereGeometry args={[0.17, 16, 16]} /><meshStandardMaterial {...fur} /></mesh>
          <mesh position={[s * 0.3, -0.78, 0.2]}><sphereGeometry args={[0.19, 16, 16]} /><meshStandardMaterial {...fur} /></mesh>
        </group>
      ))}
      <mesh position={[0, 0.27, 0.37]} scale={[1, 0.75, 0.8]}><sphereGeometry args={[0.13, 16, 16]} /><meshStandardMaterial {...light} /></mesh>
      <mesh position={[0, 0.3, 0.46]}><sphereGeometry args={[0.04, 12, 12]} /><meshStandardMaterial color="#222" /></mesh>
      <mesh position={[0, 0.0, 0.2]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.28, 0.05, 10, 24]} /><meshStandardMaterial {...M('#ef4444')} /></mesh>
    </group>
  );
}
function Bag(props) {
  return (
    <group {...props}>
      <RoundedBox args={[0.95, 1.2, 0.5]} radius={0.15} smoothness={4}><meshStandardMaterial {...M('#22d3ee')} /></RoundedBox>
      <RoundedBox args={[0.75, 0.45, 0.12]} radius={0.06} position={[0, -0.28, 0.3]}><meshStandardMaterial {...M('#0e7490')} /></RoundedBox>
      <mesh position={[0, 0.2, 0.26]}><planeGeometry args={[0.5, 0.06]} /><meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={0.3} /></mesh>
      <mesh position={[0, 0.7, 0]} rotation={[0, 0, 0]}><torusGeometry args={[0.16, 0.035, 8, 20, Math.PI]} /><meshStandardMaterial {...M('#0e7490')} /></mesh>
    </group>
  );
}
function Blocks(props) {
  const cols = ['#f43f5e', '#facc15', '#22c55e'];
  return (
    <group {...props}>
      {[[-0.28, -0.2, 0], [0.28, -0.2, 0], [0, 0.35, 0]].map((p, i) => (
        <RoundedBox key={i} args={[0.5, 0.5, 0.5]} radius={0.05} position={p} rotation={[0, i * 0.4, 0]}><meshStandardMaterial {...M(cols[i], { roughness: 0.5 })} /></RoundedBox>
      ))}
    </group>
  );
}
const Shape = ({ kind, color, ...p }) => (
  <mesh {...p}>
    {kind === 'ico' && <icosahedronGeometry args={[0.3, 0]} />}
    {kind === 'torus' && <torusGeometry args={[0.28, 0.1, 14, 32]} />}
    {kind === 'octa' && <octahedronGeometry args={[0.28, 0]} />}
    {kind === 'knot' && <torusKnotGeometry args={[0.2, 0.07, 64, 10]} />}
    <meshStandardMaterial {...M(color, { metalness: 0.5, roughness: 0.2 })} emissive={color} emissiveIntensity={0.12} />
  </mesh>
);

/** Extruded love-heart. */
function heartGeometry() {
  const sh = new THREE.Shape();
  sh.moveTo(0, -0.5);
  sh.bezierCurveTo(-0.15, -0.38, -0.6, -0.12, -0.6, 0.2);
  sh.bezierCurveTo(-0.6, 0.5, -0.28, 0.62, 0, 0.36);
  sh.bezierCurveTo(0.28, 0.62, 0.6, 0.5, 0.6, 0.2);
  sh.bezierCurveTo(0.6, -0.12, 0.15, -0.38, 0, -0.5);
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.22, bevelEnabled: true, bevelSize: 0.07, bevelThickness: 0.09, bevelSegments: 6, curveSegments: 28 });
  g.center();
  return g;
}

const heartMat = (c = '#ff4fa3', e = 0.55) => ({ color: c, emissive: c, emissiveIntensity: e, roughness: 0.22, metalness: 0.25 });

/** The big love heart the teddy hugs: pulses like a heartbeat. */
function LoveHeart({ geo, ...props }) {
  const r = useRef();
  useFrame((st) => {
    const t = st.clock.elapsedTime;
    const beat = 1 + 0.07 * Math.max(0, Math.sin(t * 3.4)) ** 3 * 2 + 0.02 * Math.sin(t * 1.5);
    r.current.scale.setScalar(beat);
  });
  return <group {...props}><mesh ref={r} geometry={geo}><meshStandardMaterial {...heartMat()} /></mesh></group>;
}

/** Small hearts drifting up behind/around the teddy. */
function RisingHearts({ geo, count = 9 }) {
  const refs = useRef([]);
  const seeds = useMemo(() => Array.from({ length: count }, (_, i) => ({ x: ((i * 7919) % 100) / 100 * 7 - 3.5, speed: 0.22 + ((i * 31) % 10) / 45, phase: i / count, s: 0.12 + ((i * 17) % 10) / 55, c: ['#ff4fa3', '#c084fc', '#f9a8d4', '#a78bfa'][i % 4] })), [count]);
  useFrame((st) => {
    const t = st.clock.elapsedTime;
    seeds.forEach((d, i) => {
      const m = refs.current[i]; if (!m) return;
      const k = (t * d.speed * 0.25 + d.phase) % 1;
      m.position.set(d.x + Math.sin(t * 0.8 + i) * 0.25, -3 + k * 6, -0.8 + (i % 3) * 0.5);
      m.rotation.y = t * 0.8 + i; m.rotation.z = Math.sin(t + i) * 0.3;
      m.scale.setScalar(d.s * Math.min(1, k * 6, (1 - k) * 4));
    });
  });
  return seeds.map((d, i) => <mesh key={i} ref={(el) => (refs.current[i] = el)} geometry={geo}><meshStandardMaterial {...heartMat(d.c, 0.45)} /></mesh>);
}

function Rig({ children, mobile }) {
  const g = useRef();
  const { viewport } = useThree();
  // fit the composition to the canvas: phones get a big centred teddy, wide screens get the full cast
  const fit = mobile ? Math.min(1.25, viewport.width / 3.4) : Math.min(1.15, viewport.width / 9.5);
  useFrame((state, dt) => {
    const { x, y } = state.pointer;
    const tx = mobile ? Math.sin(state.clock.elapsedTime * 0.3) * 0.15 : x * 0.3;
    const ty = mobile ? 0 : -y * 0.15;
    g.current.rotation.y += (tx - g.current.rotation.y) * Math.min(1, dt * 2.5);
    g.current.rotation.x += (ty - g.current.rotation.x) * Math.min(1, dt * 2.5);
  });
  return <group ref={g} scale={fit}>{children}</group>;
}

function Spin({ speed = 0.4, children, ...p }) {
  const r = useRef();
  useFrame((_, dt) => { r.current.rotation.y += dt * speed; r.current.rotation.x += dt * speed * 0.4; });
  return <group ref={r} {...p}>{children}</group>;
}

export default function Hero3D({ lite = false, active = true }) {
  const dpr = useMemo(() => [1, lite ? 1.25 : 1.75], [lite]);
  const geo = useMemo(heartGeometry, []);
  return (
    <Canvas dpr={dpr} frameloop={active ? 'always' : 'never'} camera={{ position: [0, 0, 7], fov: 42 }} gl={{ antialias: !lite, powerPreference: 'high-performance', alpha: true }} aria-hidden="true">
      <ambientLight intensity={0.85} color="#d8ccff" />
      <directionalLight position={[3, 5, 5]} intensity={2.4} color="#fff4ff" />
      <pointLight position={[-5, -1, 3]} intensity={45} color="#a855f7" />
      <pointLight position={[5, 2, 2]} intensity={32} color="#ec4899" />
      <pointLight position={[0, -3, 4]} intensity={18} color="#7c3aed" />
      <Rig mobile={lite}>
        <Float speed={1.4} rotationIntensity={0.25} floatIntensity={0.9}>
          <group position={[0, -0.2, 0.4]}>
            <Teddy scale={lite ? 1.9 : 2.15} />
            {/* the heart the teddy is holding, in front of its arms */}
            <LoveHeart geo={geo} position={[0, lite ? -0.45 : -0.55, lite ? 1.25 : 1.4]} scale={lite ? 1 : 1.1} rotation={[0, 0, 0]} />
          </group>
        </Float>
        <RisingHearts geo={geo} count={lite ? 6 : 10} />
        {!lite && <>
          <Float speed={1.3} rotationIntensity={0.8}><Notebook position={[-3.7, 1.1, -1]} rotation={[0.2, 0.5, 0.2]} scale={0.95} /></Float>
          <Float speed={1.8} rotationIntensity={0.7}><Bag position={[3.8, 0.9, -0.8]} rotation={[0, -0.5, -0.1]} scale={0.95} /></Float>
          <Float speed={2} rotationIntensity={1}><Pencil position={[-3.2, -1.9, -0.2]} rotation={[0, 0.3, 0.7]} scale={0.9} /></Float>
          <Float speed={1.7} rotationIntensity={1}><Pen position={[3.4, -1.9, 0]} rotation={[0.2, -0.3, -0.6]} scale={0.9} /></Float>
          <Float speed={1.5} rotationIntensity={0.9}><Blocks position={[-1.9, 2.2, -1.2]} rotation={[0.3, 0.4, 0]} scale={0.7} /></Float>
          <Spin speed={0.5}><Float speed={2.2} floatIntensity={1.6}><Shape kind="ico" color="#c084fc" position={[2.2, 2.3, -1.4]} /></Float></Spin>
          <Spin speed={0.6}><Float speed={2}><Shape kind="torus" color="#a78bfa" position={[-2.6, -2.5, -0.6]} /></Float></Spin>
          <Spin speed={0.35}><Float speed={2.4}><Shape kind="knot" color="#f0abfc" position={[2.8, -2.6, -0.8]} /></Float></Spin>
        </>}
      </Rig>
    </Canvas>
  );
}
