"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Group,
  MathUtils,
  Mesh,
  Points,
} from "three";

type SceneProps = {
  compact?: boolean;
};

type PointerState = {
  x: number;
  y: number;
  scroll: number;
};

function useMotionPreference() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return reduced;
}

function usePointerState() {
  const pointer = useRef<PointerState>({ x: 0, y: 0, scroll: 0 });

  useEffect(() => {
    const handlePointer = (event: PointerEvent) => {
      pointer.current.x = (event.clientX / window.innerWidth - 0.5) * 2;
      pointer.current.y = (event.clientY / window.innerHeight - 0.5) * 2;
    };
    const handleScroll = () => {
      pointer.current.scroll =
        window.scrollY / Math.max(1, document.body.scrollHeight - window.innerHeight);
    };

    window.addEventListener("pointermove", handlePointer, { passive: true });
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener("pointermove", handlePointer);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return pointer;
}

function ParticleField({ compact = false }: SceneProps) {
  const ref = useRef<Points>(null);
  const count = compact ? 520 : 920;
  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const palette = [
      new Color("#fffaf0"),
      new Color("#8be9ff"),
      new Color("#b99cff"),
      new Color("#f6d78a"),
      new Color("#f8b8d9"),
    ];

    for (let index = 0; index < count; index += 1) {
      const radius = 8 + Math.random() * 24;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[index * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[index * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta) * 0.65;
      positions[index * 3 + 2] = radius * Math.cos(phi) - 8;

      const color = palette[index % palette.length];
      colors[index * 3] = color.r;
      colors[index * 3 + 1] = color.g;
      colors[index * 3 + 2] = color.b;
    }

    const field = new BufferGeometry();
    field.setAttribute("position", new BufferAttribute(positions, 3));
    field.setAttribute("color", new BufferAttribute(colors, 3));
    return field;
  }, [count]);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const elapsed = clock.getElapsedTime();
    ref.current.rotation.y = elapsed * 0.012;
    ref.current.rotation.x = Math.sin(elapsed * 0.08) * 0.035;
  });

  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial
        blending={AdditiveBlending}
        depthWrite={false}
        opacity={0.64}
        size={compact ? 0.026 : 0.034}
        sizeAttenuation
        transparent
        vertexColors
      />
    </points>
  );
}

function DreamArchitecture({ compact = false }: SceneProps) {
  const group = useRef<Group>(null);
  const inner = useRef<Mesh>(null);

  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime();
    if (group.current) {
      group.current.rotation.y = elapsed * 0.035;
      group.current.position.y = Math.sin(elapsed * 0.22) * (compact ? 0.08 : 0.16);
    }
    if (inner.current) {
      inner.current.rotation.x = Math.PI / 2 + elapsed * 0.024;
      inner.current.rotation.z = elapsed * -0.028;
    }
  });

  return (
    <group ref={group} position={[0, compact ? -0.3 : -0.05, -7.8]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[compact ? 3.1 : 4.2, 0.012, 12, 180]} />
        <meshBasicMaterial color="#f6d78a" opacity={0.24} transparent />
      </mesh>
      <mesh ref={inner} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[compact ? 2.1 : 2.9, 0.008, 12, 180]} />
        <meshBasicMaterial color="#8be9ff" opacity={0.22} transparent />
      </mesh>
      <mesh rotation={[Math.PI / 2.4, 0.2, -0.4]}>
        <torusGeometry args={[compact ? 4.2 : 5.4, 0.006, 12, 220]} />
        <meshBasicMaterial color="#b99cff" opacity={0.14} transparent />
      </mesh>
    </group>
  );
}

function Auroras({ compact = false }: SceneProps) {
  const left = useRef<Mesh>(null);
  const right = useRef<Mesh>(null);

  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime();
    if (left.current) {
      left.current.position.y = Math.sin(elapsed * 0.18) * 0.18;
      left.current.rotation.z = -0.36 + Math.sin(elapsed * 0.12) * 0.04;
    }
    if (right.current) {
      right.current.position.y = Math.cos(elapsed * 0.16) * 0.18;
      right.current.rotation.z = 0.42 + Math.cos(elapsed * 0.1) * 0.04;
    }
  });

  return (
    <group position={[0, 0, -8.4]}>
      <mesh ref={left} position={[-3.3, compact ? 1.2 : 1.8, 0]} rotation={[0, 0, -0.36]}>
        <planeGeometry args={[compact ? 7 : 10, compact ? 2 : 2.8, 18, 4]} />
        <meshBasicMaterial
          blending={AdditiveBlending}
          color="#8be9ff"
          opacity={0.075}
          side={DoubleSide}
          transparent
        />
      </mesh>
      <mesh ref={right} position={[3.6, compact ? 0.9 : 1.4, -0.25]} rotation={[0, 0, 0.42]}>
        <planeGeometry args={[compact ? 7 : 10, compact ? 1.8 : 2.6, 18, 4]} />
        <meshBasicMaterial
          blending={AdditiveBlending}
          color="#f8b8d9"
          opacity={0.064}
          side={DoubleSide}
          transparent
        />
      </mesh>
    </group>
  );
}

function VolumetricShafts({ compact = false }: SceneProps) {
  const group = useRef<Group>(null);
  const shaftCount = compact ? 4 : 7;

  useFrame(({ clock }) => {
    if (!group.current) return;
    group.current.rotation.z = Math.sin(clock.getElapsedTime() * 0.08) * 0.025;
  });

  return (
    <group ref={group} position={[0, 0.4, -7.2]}>
      {Array.from({ length: shaftCount }, (_, index) => (
        <mesh
          key={index}
          position={[index * 1.4 - (shaftCount * 1.4) / 2, 0.6 - index * 0.1, -index * 0.05]}
          rotation={[0, 0, -0.42 + index * 0.08]}
        >
          <planeGeometry args={[0.42, compact ? 7 : 9]} />
          <meshBasicMaterial
            blending={AdditiveBlending}
            color={index % 2 ? "#f6d78a" : "#fffaf0"}
            opacity={0.028}
            side={DoubleSide}
            transparent
          />
        </mesh>
      ))}
    </group>
  );
}

function SceneContents({ compact = false }: SceneProps) {
  const root = useRef<Group>(null);
  const pointer = usePointerState();

  useFrame(({ camera, clock }) => {
    const elapsed = clock.getElapsedTime();
    const targetX = pointer.current.x * 0.42;
    const targetY = -pointer.current.y * 0.24 + pointer.current.scroll * 0.8;

    camera.position.x = MathUtils.lerp(camera.position.x, targetX, 0.035);
    camera.position.y = MathUtils.lerp(camera.position.y, targetY, 0.035);
    camera.lookAt(0, 0, -8);

    if (root.current) {
      root.current.rotation.y = MathUtils.lerp(
        root.current.rotation.y,
        pointer.current.x * 0.045,
        0.03,
      );
      root.current.position.y = Math.sin(elapsed * 0.16) * 0.08;
    }
  });

  return (
    <group ref={root}>
      <color attach="background" args={["#070712"]} />
      <fog attach="fog" args={["#070712", 8, compact ? 22 : 30]} />
      <ambientLight intensity={0.82} />
      <pointLight color="#fffaf0" intensity={1.8} position={[0, 4, -3]} />
      <pointLight color="#8be9ff" intensity={0.9} position={[-5, 1.5, -6]} />
      <pointLight color="#b99cff" intensity={0.72} position={[5, -0.5, -8]} />
      <ParticleField compact={compact} />
      <Auroras compact={compact} />
      <VolumetricShafts compact={compact} />
      <DreamArchitecture compact={compact} />
    </group>
  );
}

export function CelestialScene({ compact = false }: SceneProps) {
  const reducedMotion = useMotionPreference();

  if (reducedMotion) {
    return null;
  }

  return (
    <Canvas
      camera={{ fov: compact ? 44 : 50, position: [0, 0, 7.5] }}
      dpr={[1, 1.45]}
      gl={{
        alpha: true,
        antialias: false,
        powerPreference: "high-performance",
        stencil: false,
      }}
      performance={{ min: 0.45 }}
    >
      <SceneContents compact={compact} />
    </Canvas>
  );
}
