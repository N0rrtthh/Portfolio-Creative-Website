"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Imperative cursor — no React re-renders on mousemove.
 * Ring size uses CSS scale (compositor-only) instead of width/height layout thrash.
 */
export default function CustomCursor({ design }: { design: "classic" | "eva" }) {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const [isCoarse, setIsCoarse] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [host, setHost] = useState<HTMLElement | null>(null);

  /* Mount detection and the portal host are created together, inside a
     deferred frame: both are setState-in-effect, and doing them in a rAF
     avoids the cascading render React warns about.

     The host is a dedicated element kept as the LAST child of <body>.
     Portalling straight into <body> is not enough on its own: every other
     portal (modals, loaders, the dev overlay) mounts after this one and, at
     an equal or near z-index, wins on document order — which is exactly the
     "pointer went behind the background" symptom. */
  useEffect(() => {
    let el: HTMLDivElement | null = null;

    const id = requestAnimationFrame(() => {
      const coarse = window.matchMedia("(pointer: coarse)").matches;
      setIsCoarse(coarse);
      setMounted(true);
      if (coarse) return;

      el = document.createElement("div");
      el.setAttribute("data-cursor-host", "");
      /* Plain fixed overlay. Nothing here creates a stacking context beyond
         the z-index itself, which is what keeps the cursor above portals. */

      el.style.cssText =
        "position:fixed;inset:0;z-index:2147483647;pointer-events:none";
      document.body.appendChild(el);
      setHost(el);
    });

    return () => {
      cancelAnimationFrame(id);
      el?.remove();
    };
  }, []);

  /* Anything appended to <body> after the host (a modal portal, the dev
     overlay) would sit above it on document order; move the host back. */
  useEffect(() => {
    if (!host) return;
    const observer = new MutationObserver(() => {
      if (document.body.lastElementChild !== host) document.body.appendChild(host);
    });
    observer.observe(document.body, { childList: true });
    return () => observer.disconnect();
  }, [host]);



  useEffect(() => {
    if (isCoarse) return;

    const ring = { x: 0, y: 0 };
    let target = { x: 0, y: 0 };
    let raf = 0;
    let isPointer = false;
    let isVisible = false;
    let lastPointer = false;

    const setVisible = (v: boolean) => {
      if (isVisible === v) return;
      isVisible = v;
      const opacity = v ? "1" : "0";
      if (dotRef.current) dotRef.current.style.opacity = opacity;
      if (ringRef.current) {
        ringRef.current.style.opacity = v ? (isPointer ? "0.9" : "0.45") : "0";
      }
    };

    const applyPointerState = (next: boolean) => {
      if (lastPointer === next) return;
      lastPointer = next;
      isPointer = next;
      if (!ringRef.current) return;
      /* The ring no longer grows over links, buttons and nav items. It used to
         jump to 1.6–1.8x, which on a dense navbar meant a large disc sweeping
         over the labels you were trying to read. Hover is now signalled by
         opacity and a faint fill only — same information, no geometry change,
         and still transform-free so nothing lays out. */
      ringRef.current.style.opacity = isVisible ? (next ? "0.95" : "0.45") : "0";
      /* Fill is the accent at low alpha. Since the cursor no longer
         difference-blends, a tint here stays the colour it says it is. */
      ringRef.current.style.backgroundColor = next
        ? "color-mix(in srgb, var(--color-accent-primary) 22%, transparent)"
        : "transparent";



    };

    function onMove(e: MouseEvent) {
      target = { x: e.clientX, y: e.clientY };
      setVisible(true);
      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0) translate(-50%, -50%)`;
      }
    }

    function onMouseOver(e: MouseEvent) {
      const el = e.target as HTMLElement;
      if (el?.closest("a, button, [data-cursor-hover]")) {
        applyPointerState(true);
      }
    }

    function onMouseOut(e: MouseEvent) {
      const el = e.target as HTMLElement;
      const related = e.relatedTarget as HTMLElement;
      if (
        el?.closest("a, button, [data-cursor-hover]") &&
        !related?.closest("a, button, [data-cursor-hover]")
      ) {
        applyPointerState(false);
      }
    }

    function animateRing() {
      ring.x += (target.x - ring.x) * 0.14;
      ring.y += (target.y - ring.y) * 0.14;
      if (ringRef.current) {
        const baseRotate = design === "eva" ? " rotate(45deg)" : "";
        ringRef.current.style.transform = `translate3d(${ring.x}px, ${ring.y}px, 0) translate(-50%, -50%)${baseRotate}`;

      }
      raf = requestAnimationFrame(animateRing);
    }

    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mouseover", onMouseOver, { passive: true });
    window.addEventListener("mouseout", onMouseOut, { passive: true });
    raf = requestAnimationFrame(animateRing);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseover", onMouseOver);
      window.removeEventListener("mouseout", onMouseOut);
      cancelAnimationFrame(raf);
    };
  }, [design, isCoarse]);

  if (!mounted || isCoarse || !host) return null;


  const isEva = design === "eva";
  const baseSize = isEva ? 24 : 32;

  /* Portalled into the dedicated host (last child of <body>, max z-index).
     A z-index alone was not enough: rendered inside any subtree that creates
     a stacking context (a transformed smooth-scroll wrapper, a `transform-gpu`
     card, a `filter`ed panel) the z-index resolves *within* that context and
     the cursor falls behind later siblings.

     Colour: `--color-starlight`, which is near-white in dark mode and near-
     black in light mode, so the cursor tracks the theme instead of fighting
     it. `mix-blend-mode: difference` was removed — it worked on the dark
     surfaces but on Classic light (#f8f8fc page, #ffffff cards) it inverted
     white into an almost-white value and the cursor vanished. A token colour
     plus a contrast ring is predictable in both modes.

     Both the dot and the ring render for BOTH designs. EVA previously looked
     dotless because the difference blend inverted the white dot against the
     bright purple/green banner into a near-banner colour. */
  const cursorColor = "var(--color-starlight)";

  return createPortal(
    <>
      <div
        ref={dotRef}
        className="pointer-events-none fixed top-0 left-0 h-2 w-2 rounded-full"
        style={{
          opacity: 0,
          willChange: "transform",
          backgroundColor: cursorColor,
        }}
        aria-hidden="true"
      />
      <div
        ref={ringRef}
        className={`pointer-events-none fixed top-0 left-0 border-2 will-change-transform transform-gpu ${
          isEva ? "rounded-none" : "rounded-full"
        }`}
        style={{
          width: baseSize,
          height: baseSize,
          opacity: 0,
          borderColor: cursorColor,
          transition:
            "opacity 150ms ease-out, background-color 150ms ease-out, border-color 150ms ease-out",
        }}
        aria-hidden="true"
      />
    </>,
    host
  );


}
