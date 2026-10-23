"use client";

import { motion } from "framer-motion";

interface RevealTextProps {
  children: string;
  className?: string;
  delay?: number;
  as?: "h1" | "h2" | "h3" | "p" | "span";
  splitBy?: "word" | "char";
}

export default function RevealText({
  children,
  className = "",
  delay = 0,
  as = "span",
  splitBy = "word",
}: RevealTextProps) {
  const Tag = as;
  const parts =
    splitBy === "word" ? children.split(" ") : children.split("");

  return (
    <Tag className={className}>
      {parts.map((part, i) => (
        <span
          key={i}
          className="inline-block overflow-hidden"
          style={{ verticalAlign: "top" }}
        >
          <motion.span
            className="inline-block"
            initial={{ y: "120%", opacity: 0, filter: "blur(6px)" }}
            whileInView={{ y: "0%", opacity: 1, filter: "blur(0px)", transitionEnd: { filter: "none" } }}
            viewport={{ once: true, margin: "-10%" }}
            transition={{
              duration: 1.0,
              delay: delay + i * (splitBy === "word" ? 0.08 : 0.025),
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            {part}
            {splitBy === "word" && i < parts.length - 1 ? "\u00A0" : ""}
          </motion.span>
        </span>
      ))}
    </Tag>
  );
}
