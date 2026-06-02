"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

const interactiveSelector =
  "a,button,input,textarea,select,[role='button'],[data-cursor-interactive]";

type Dot = {
  x: number;
  y: number;
};

function isDesktopPointer() {
  return (
    window.matchMedia("(pointer: fine)").matches &&
    !window.matchMedia("(pointer: coarse)").matches &&
    window.innerWidth >= 768
  );
}

export function PremiumCursor() {
  const [enabled, setEnabled] = useState(false);
  const [interactive, setInteractive] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const interactiveRef = useRef(false);
  const reducedMotionRef = useRef(false);
  const auraRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const trailRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const pointerRef = useRef<Dot>({ x: 0, y: 0 });
  const auraRefPosition = useRef<Dot>({ x: 0, y: 0 });
  const ringRefPosition = useRef<Dot>({ x: 0, y: 0 });
  const trailPositions = useRef<Dot[]>(
    Array.from({ length: 4 }, () => ({ x: 0, y: 0 })),
  );

  useEffect(() => {
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pointerQuery = window.matchMedia("(pointer: fine)");
    const coarseQuery = window.matchMedia("(pointer: coarse)");
    let frame = 0;

    const updateAvailability = () => {
      if (!pointerRef.current.x && !pointerRef.current.y) {
        pointerRef.current = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        auraRefPosition.current = pointerRef.current;
        ringRefPosition.current = pointerRef.current;
        trailPositions.current = trailPositions.current.map(() => pointerRef.current);
      }
      reducedMotionRef.current = motionQuery.matches;
      setEnabled(isDesktopPointer());
      setReducedMotion(motionQuery.matches);
    };
    const moveElement = (
      element: HTMLElement | null,
      position: Dot,
      scale = 1,
    ) => {
      if (!element) return;
      element.style.transform = `translate3d(${position.x}px, ${position.y}px, 0) translate(-50%, -50%) scale(${scale})`;
    };
    const animate = () => {
      auraRefPosition.current.x +=
        (pointerRef.current.x - auraRefPosition.current.x) * 0.12;
      auraRefPosition.current.y +=
        (pointerRef.current.y - auraRefPosition.current.y) * 0.12;
      ringRefPosition.current.x +=
        (pointerRef.current.x - ringRefPosition.current.x) * 0.2;
      ringRefPosition.current.y +=
        (pointerRef.current.y - ringRefPosition.current.y) * 0.2;

      moveElement(
        auraRef.current,
        auraRefPosition.current,
        interactiveRef.current ? 1.18 : 1,
      );
      moveElement(
        ringRef.current,
        ringRefPosition.current,
        interactiveRef.current ? 1.42 : 1,
      );

      if (!reducedMotionRef.current) {
        trailPositions.current.forEach((position, index) => {
          const target = index === 0 ? pointerRef.current : trailPositions.current[index - 1];
          position.x += (target.x - position.x) * (0.34 - index * 0.045);
          position.y += (target.y - position.y) * (0.34 - index * 0.045);
          moveElement(trailRefs.current[index], position);
        });
      }

      frame = window.requestAnimationFrame(animate);
    };
    const handlePointerMove = (event: PointerEvent) => {
      pointerRef.current = { x: event.clientX, y: event.clientY };
      const target = event.target instanceof Element ? event.target : null;
      const nextInteractive = Boolean(target?.closest(interactiveSelector));
      if (nextInteractive !== interactiveRef.current) {
        interactiveRef.current = nextInteractive;
        setInteractive(nextInteractive);
      }
    };

    updateAvailability();
    window.addEventListener("resize", updateAvailability, { passive: true });
    pointerQuery.addEventListener("change", updateAvailability);
    coarseQuery.addEventListener("change", updateAvailability);
    motionQuery.addEventListener("change", updateAvailability);
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    frame = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updateAvailability);
      pointerQuery.removeEventListener("change", updateAvailability);
      coarseQuery.removeEventListener("change", updateAvailability);
      motionQuery.removeEventListener("change", updateAvailability);
      window.removeEventListener("pointermove", handlePointerMove);
    };
  }, []);

  if (!enabled) {
    return null;
  }

  const cursorState = {
    "--cursor-ring-opacity": interactive ? 0.72 : 0.34,
    "--cursor-aura-opacity": interactive ? 0.76 : 0.46,
  } as CSSProperties;

  return (
    <div aria-hidden="true" className="premium-cursor-layer" style={cursorState}>
      <div className="premium-cursor-aura" ref={auraRef} />
      <div className="premium-cursor-ring" ref={ringRef} />
      {!reducedMotion &&
        Array.from({ length: 4 }, (_, index) => (
          <span
            className="premium-cursor-spark"
            key={index}
            ref={(element) => {
              trailRefs.current[index] = element;
            }}
            style={{ "--spark-index": index } as CSSProperties}
          />
        ))}
    </div>
  );
}
