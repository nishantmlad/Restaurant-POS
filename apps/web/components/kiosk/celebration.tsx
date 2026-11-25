"use client";

import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
  shape: "rect" | "circle" | "ribbon";
  opacity: number;
  wobble: number;
  wobbleSpeed: number;
}

const CELEBRATION_COLORS = [
  "#10B981", // Emerald
  "#059669", // Dark Emerald
  "#F59E0B", // Amber / Gold
  "#EC4899", // Pink
  "#8B5CF6", // Purple
  "#3B82F6", // Blue
  "#EF4444", // Red
  "#14B8A6", // Teal
  "#FCD34D", // Light Gold
];

export function CelebrationConfetti() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    const particles: Particle[] = [];
    const count = 120;

    // Launch particles from both bottom corners towards center-up
    for (let i = 0; i < count; i++) {
      const fromLeft = i % 2 === 0;
      const originX = fromLeft ? width * 0.15 : width * 0.85;
      const originY = height * 0.85;

      const angle = fromLeft
        ? -Math.PI / 3 - (Math.random() * Math.PI) / 6
        : (-2 * Math.PI) / 3 + (Math.random() * Math.PI) / 6;

      const speed = 12 + Math.random() * 16;
      const shapeRand = Math.random();
      const shape: Particle["shape"] =
        shapeRand < 0.5 ? "rect" : shapeRand < 0.8 ? "circle" : "ribbon";

      particles.push({
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 7 + Math.random() * 8,
        color:
          CELEBRATION_COLORS[
            Math.floor(Math.random() * CELEBRATION_COLORS.length)
          ],
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 8,
        shape,
        opacity: 1,
        wobble: Math.random() * 10,
        wobbleSpeed: 0.05 + Math.random() * 0.08,
      });
    }

    let animationId: number;
    const startTime = Date.now();
    const duration = 4500; // 4.5 seconds of joyful burst

    const render = () => {
      const elapsed = Date.now() - startTime;
      if (elapsed > duration) {
        ctx.clearRect(0, 0, width, height);
        return;
      }

      ctx.clearRect(0, 0, width, height);

      const fadeProgress = elapsed > 3000 ? (elapsed - 3000) / 1500 : 0;

      for (const p of particles) {
        // Physics update
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.38; // Gravity
        p.vx *= 0.985; // Air drag
        p.rotation += p.rotationSpeed;
        p.wobble += p.wobbleSpeed;
        p.opacity = Math.max(0, 1 - fadeProgress);

        ctx.save();
        ctx.translate(p.x + Math.sin(p.wobble) * 3, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;

        if (p.shape === "circle") {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.shape === "ribbon") {
          ctx.fillRect(-p.size / 2, -p.size * 1.5, p.size * 0.4, p.size * 2);
        } else {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
        }

        ctx.restore();
      }

      animationId = requestAnimationFrame(render);
    };

    animationId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-50 h-full w-full"
      aria-hidden="true"
    />
  );
}

