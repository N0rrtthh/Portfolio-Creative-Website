"use client";

import { useRef } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

interface MagneticButtonProps {
  children: React.ReactNode;
  className?: string;
  href?: string;
  download?: boolean | string;
  onClick?: () => void;
  strength?: number;
}

/**
 * Magnetic pull without setState on every mousemove.
 * Motion values stay off the React render path — compositor-friendly.
 */
export default function MagneticButton({
  children,
  className = "",
  href,
  download,
  onClick,
  strength = 0.3,
}: MagneticButtonProps) {
  const ref = useRef<HTMLAnchorElement | HTMLButtonElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 140, damping: 14, mass: 0.4 });
  const springY = useSpring(y, { stiffness: 140, damping: 14, mass: 0.4 });

  function handleMouseMove(e: React.MouseEvent) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    x.set((e.clientX - rect.left - rect.width / 2) * strength);
    y.set((e.clientY - rect.top - rect.height / 2) * strength);
  }

  function handleMouseLeave() {
    x.set(0);
    y.set(0);
  }

  const shared = {
    ref: ref as never,
    onMouseMove: handleMouseMove,
    onMouseLeave: handleMouseLeave,
    style: { x: springX, y: springY },
    className: `magnetic-btn select-none will-change-transform transform-gpu ${className}`,
    "data-cursor-hover": true as const,
  };

  if (href) {
    return (
      <motion.a href={href} download={download} {...shared}>
        {children}
      </motion.a>
    );
  }

  return (
    <motion.button type="button" onClick={onClick} {...shared}>
      {children}
    </motion.button>
  );
}
