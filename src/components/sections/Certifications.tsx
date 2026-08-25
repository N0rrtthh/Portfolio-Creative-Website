"use client";

import { useEffect, useLayoutEffect, useRef, useState, useMemo, type ComponentType, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useScrollLock } from "@/lib/hooks/useScrollLock";
import { useLenis } from "@/components/providers/SmoothScrollProvider";
import {
  BadgeCheck,
  Search,
  BookOpen,
  Globe,
  X,
  CheckCircle2,
  Layers,
  Brain,
  BarChart3,
  ShieldCheck,
  Code2,
  CircuitBoard,
  Briefcase,
  Cpu,
} from "lucide-react";
import ChapterLabel from "@/components/ui/ChapterLabel";
import RevealText from "@/components/ui/RevealText";

/* Subject → drawn icon. The badges used to be emoji glyphs — a
   placeholder standing in for an icon system. One lucide set now:
   the same stroke and weight on every badge, sized by the caller,
   coloured by currentColor. */
const SUBJECT_ICONS: Record<
  RealCertification["subject"],
  ComponentType<{ size?: number; className?: string; strokeWidth?: number }>
> = {
  AI: Brain,
  "Data Science": BarChart3,
  Cybersecurity: ShieldCheck,
  "Software Engineering": Code2,
  "Systems & IoT": CircuitBoard,
  "Business & Professional": Briefcase,
};

function SubjectIcon({
  subject,
  size,
  className = "",
}: {
  subject: RealCertification["subject"];
  size: number;
  className?: string;
}) {
  const Icon = SUBJECT_ICONS[subject] ?? Cpu;
  return <Icon size={size} className={className} strokeWidth={1.75} aria-hidden />;
}

const EASING = [0.22, 1, 0.36, 1] as const;
/* The issuer pill used to run a very stiff spring (stiffness 480). A stiff
   spring overshoots its target and settles with a visible bounce; combined
   with the content cross-fade happening underneath, that read as the tab
   "glitching" on click. A softer, critically-damped spring glides to the
   new tab and stops dead — no overshoot, no wobble. */
const TAB_SPRING = { type: "spring", stiffness: 300, damping: 32, mass: 0.8 } as const;

/* ══════════════════════════════════════════════════════════
   Certificate viewer — why it's scaled the way it is
   ──────────────────────────────────────────────────────────
   The preview is a CROSS-ORIGIN iframe pointing at pdfhost.io's own
   HTML viewer. We cannot read or set anything inside it: no zoom API,
   no `#zoom=` fragment (that only works for the browser's built-in PDF
   plugin, not for a third-party HTML viewer), and no postMessage
   contract. So the zoom is not ours to set directly.

   What IS ours is the viewport the viewer thinks it has. That's the
   actual cause of the "opens at ~240% on mobile" report: given a
   ~340px-wide frame, pdfhost takes its small-screen layout path and
   fits the page to that width, so the certificate's text renders at
   roughly 2.4x the density you'd see on a desktop.

   Fix: give the iframe a fixed DESKTOP width (`FRAME_VIRTUAL_WIDTH`)
   so the viewer always takes its desktop layout path, then scale the
   whole frame down to whatever space we actually have. The apparent
   zoom becomes containerWidth / 900 — a number we control exactly,
   identical in behaviour on every device. This also replaces the old
   `h-[185%] w-[185%] scale-[0.54]` magic numbers, which hard-coded one
   ratio and therefore only ever looked right at one width.
   ══════════════════════════════════════════════════════════ */
const FRAME_VIRTUAL_WIDTH = 900;

function ScaledFrame({ src, title }: { src: string; title: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const measure = (w: number) => {
      if (w > 0) setScale(w / FRAME_VIRTUAL_WIDTH);
    };
    measure(el.getBoundingClientRect().width);
    const ro = new ResizeObserver((entries) => measure(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={hostRef} className="absolute inset-0 overflow-hidden">
      {/* Rendered only once the real width is known — mounting at a
          guessed scale would make the viewer lay out twice and flash. */}
      {scale > 0 && (
        <iframe
          src={src}
          title={title}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="absolute left-0 top-0 border-0"
          style={{
            width: FRAME_VIRTUAL_WIDTH,
            // Percentage of the host box, pre-scale, so that after the
            // transform the frame covers exactly the host's height.
            height: `${100 / scale}%`,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        />
      )}
    </div>
  );
}

export interface CertVariant {
  id: string;
  name: string; // e.g. "Cisco Networking Academy", "IBM SkillsBuild", "DICT-ITU DTC Initiative"
  viewWebUrl: string; // pdfhost URL
  previewPdfUrl?: string;
  previewImageUrl?: string;
  credlyBadgeId?: string;
  credlyPublicUrl?: string;
  credlyBadgeImageUrl?: string;
}

export interface RealCertification {
  id: string;
  title: string;
  subject: "AI" | "Data Science" | "Cybersecurity" | "Software Engineering" | "Systems & IoT" | "Business & Professional";
  issuer: string;
  issueDate: string;
  skills: string[];
  description: string;
  badgeBgColor: string;
  variants: CertVariant[];
  credlyVerified: boolean;
}

export const ALL_28_CERTIFICATIONS: RealCertification[] = [
  // --- 1-4. AI & MACHINE LEARNING ---
  {
    id: "cert-01",
    title: "AI Fundamentals: Foundations for Understanding AI",
    subject: "AI",
    issuer: "Cisco Academy x IBM SkillsBuild x DICT-ITU",
    issueDate: "2026",
    skills: ["Generative AI", "Neural Networks", "Ethics in AI", "Prompt Engineering"],
    description: "Foundational mastery in artificial intelligence architecture, machine learning concepts, ethical AI deployment, and neural model mechanics. Issued across 3 official partner credentials.",
    badgeBgColor: "from-blue-500 via-indigo-600 to-blue-800",
    credlyVerified: true,
    variants: [
      {
        id: "v-dict-foundations",
        name: "DICT-ITU DTC Initiative",
        viewWebUrl: "https://pdfhost.io/v/se3wAfNhfT_AI_Fundamentals_-_Foundations_for_Understanding_AI",
        previewPdfUrl: "https://pdfhost.io/pdf/c23a864a-470f-40ea-ac15-b484182341f8.pdf",
        previewImageUrl: "https://pdfhost.io/thumbnail/a579bcbe-c490-40ea-8f05-19205adec4c4-full.jpg",
      },
      {
        id: "v-cisco",
        name: "Cisco Networking Academy",
        viewWebUrl: "https://pdfhost.io/v/xfYmH4DgYj_AI_Fundamentals__Foundations_for_Understanding_AI",
        previewPdfUrl: "https://pdfhost.io/pdf/3e62a5a5-96db-461b-af08-6327486990e2.pdf",
        previewImageUrl: "https://pdfhost.io/thumbnail/48a6e6e5-51e5-49f3-947b-4e85cea7582e-full.jpg",
        credlyBadgeId: "c701bfe8-fd85-476f-ac93-e8d13045da5a",
        credlyPublicUrl: "https://www.credly.com/badges/c701bfe8-fd85-476f-ac93-e8d13045da5a/public_url",
        credlyBadgeImageUrl: "https://images.credly.com/size/340x340/images/e0644ccc-dd87-4e27-82e4-0facf461cd1f/AI_20Fundamentals_20Foundations_20for_20Understanding_20AI.png",
      },
      {
        id: "v-ibm",
        name: "IBM SkillsBuild",
        viewWebUrl: "https://pdfhost.io/v/63m4yzVg2H_AI_Fundamentals__Foundations_for_Understanding_AI",
        previewPdfUrl: "https://pdfhost.io/pdf/933017f7-2623-4247-809b-3c235bc4100a.pdf",
        previewImageUrl: "https://pdfhost.io/thumbnail/66bab349-7751-4942-ba2d-0ffd36d082ca-full.jpg",
        credlyBadgeId: "d2b7b343-2d60-404d-961e-7d238aa0ceaf",
        credlyPublicUrl: "https://www.credly.com/badges/d2b7b343-2d60-404d-961e-7d238aa0ceaf/public_url",
        credlyBadgeImageUrl: "https://images.credly.com/size/340x340/images/fa29f782-3029-44f9-9fb1-631c3278a68a/blob",
      },
    ],
  },
  {
    id: "cert-02",
    title: "AI Fundamentals: Language and Vision in AI",
    subject: "AI",
    issuer: "Cisco Networking Academy x Credly",
    issueDate: "2026",
    skills: ["Computer Vision", "NLP", "Transformer Models", "Image Processing"],
    description: "Specialized certification in Natural Language Processing (NLP), Computer Vision algorithms, LLM transformers, and multimodal AI systems.",
    badgeBgColor: "from-blue-600 via-indigo-600 to-violet-600",
    credlyVerified: true,
    variants: [
      {
        id: "v-dict-vision",
        name: "DICT-ITU DTC Initiative",
        viewWebUrl: "https://pdfhost.io/v/hc6hLJCr3f_AI_Fundamentals_-_Language_and_Vision_in_AI",
        previewPdfUrl: "https://pdfhost.io/pdf/9bed9a48-9260-4ed8-ab27-60e0c64cfec1.pdf",
        previewImageUrl: "https://pdfhost.io/thumbnail/f3301ae4-a764-4797-88cf-a5327d77502d-full.jpg",
        credlyBadgeImageUrl: "https://pdfhost.io/thumbnail/f3301ae4-a764-4797-88cf-a5327d77502d-full.jpg",
      },
      {
        id: "v-cisco-vision",
        name: "Cisco Networking Academy",
        viewWebUrl: "https://pdfhost.io/v/2aBR4pXQR7_AI_Fundamentals_-_Language_and_Vision_in_AI",
        previewPdfUrl: "https://pdfhost.io/pdf/9bed9a48-9260-4ed8-ab27-60e0c64cfec1.pdf",
        previewImageUrl: "https://pdfhost.io/thumbnail/f3301ae4-a764-4797-88cf-a5327d77502d-full.jpg",
        credlyBadgeId: "0ddb7bbf-1c2d-4378-bbc5-c5d373f05d30",
        credlyPublicUrl: "https://www.credly.com/badges/0ddb7bbf-1c2d-4378-bbc5-c5d373f05d30/public_url",
        credlyBadgeImageUrl: "https://images.credly.com/size/340x340/images/c4383b39-473a-4fb1-ae0c-c0f4d445191f/blob",
      },
      {
        id: "v-ibm-vision",
        name: "IBM SkillsBuild",
        viewWebUrl: "https://pdfhost.io/v/vZCqJRGmbK_AI_Fundamentals_-_Language_and_Vision_in_AI",
        previewPdfUrl: "https://pdfhost.io/pdf/6527c6a9-b206-4515-9dc9-62e4523be0e4.pdf",
        previewImageUrl: "https://pdfhost.io/thumbnail/b527853e-df2d-42f3-8215-d5163a745441-full.jpg",
        credlyBadgeId: "f6227f46-2986-4896-a3da-e31fec9ae83b",
        credlyPublicUrl: "https://www.credly.com/badges/f6227f46-2986-4896-a3da-e31fec9ae83b/public_url",
        credlyBadgeImageUrl: "https://images.credly.com/size/340x340/images/1c760850-837a-4ffd-bf17-83dee11b1c77/BadgeEmblem_AIFundamentalsLanguageAndVisionInAI.png",
      },
    ],
  },
  {
    id: "cert-03",
    title: "Introduction to Modern AI",
    subject: "AI",
    issuer: "Cisco Networking Academy x Credly",
    issueDate: "2026",
    skills: ["Generative AI", "AI Models", "Prompting", "Responsible AI"],
    description: "Foundational overview of modern AI concepts, model behavior, and responsible generative workflows.",
    badgeBgColor: "from-cyan-500 via-sky-600 to-blue-700",
    credlyVerified: true,
    variants: [
      {
        id: "v-modern-ai-dict",
        name: "DICT-ITU DTC Initiative",
        viewWebUrl: "https://pdfhost.io/v/BPsATvCXKt_Introduction_to_Modern_AI",
        credlyBadgeImageUrl: "https://images.credly.com/images/e2d12302-10f9-40d4-8ff1-066a7008b61d/blob",
      },
      {
        id: "v-modern-ai-cisco",
        name: "Cisco Networking Academy",
        viewWebUrl: "https://pdfhost.io/v/VnwNceT4R7_Introduction_to_Modern_AI",
        credlyBadgeId: "d7387b6f-148b-421d-9a08-46560784b0cb",
        credlyPublicUrl: "https://www.credly.com/badges/d7387b6f-148b-421d-9a08-46560784b0cb/public_url",
        credlyBadgeImageUrl: "https://images.credly.com/images/e2d12302-10f9-40d4-8ff1-066a7008b61d/blob",
      },
    ],
  },
  {
    id: "cert-04",
    title: "Apply AI: Update Your Resume",
    subject: "AI",
    issuer: "Cisco Networking Academy x Credly",
    issueDate: "2026",
    skills: ["AI Productivity", "Career Automation", "Workflow Optimization"],
    description: "Practical application of AI productivity tools for career optimization, automated review pipelines, and executive branding.",
    badgeBgColor: "from-amber-500 via-orange-600 to-red-600",
    credlyVerified: true,
    variants: [
      {
        id: "v-apply-ai-dict",
        name: "DICT-ITU DTC Initiative",
        viewWebUrl: "https://pdfhost.io/v/gfUHYJA5Ug_Apply_AI_-_Update_Your_Resume",
      },
      {
        id: "v-apply-ai-cisco",
        name: "Cisco Networking Academy",
        viewWebUrl: "https://pdfhost.io/v/GRUZGmhFXx_Apply_AI_-_Update_Your_Resume",
        credlyBadgeId: "e0cc3f70-ed75-40fb-af86-7f20d0348efa",
        credlyPublicUrl: "https://www.credly.com/badges/e0cc3f70-ed75-40fb-af86-7f20d0348efa/public_url",
        credlyBadgeImageUrl: "https://images.credly.com/images/33ba62e4-b26d-4b95-9121-1ad01b754224/linkedin_thumb_blob",
      },
    ],
  },

  // --- 5-7. DATA SCIENCE ---
  {
    id: "cert-05",
    title: "Data Science Essentials with Python",
    subject: "Data Science",
    issuer: "Cisco Networking Academy x Credly",
    issueDate: "2026",
    skills: ["Pandas", "NumPy", "Matplotlib", "Data Wrangling", "Statistical Modeling"],
    description: "Core data science methodology using Python: exploratory data analysis, data cleaning, statistical modeling, and visualization.",
    badgeBgColor: "from-emerald-600 via-teal-600 to-cyan-600",
    credlyVerified: true,
    variants: [
      {
        id: "v-ds-py-dict",
        name: "DICT-ITU DTC Initiative",
        viewWebUrl: "https://pdfhost.io/v/TYXe7TsX8Z_Data_Science_Essentials_with_Python",
      },
      {
        id: "v-ds-py-cisco",
        name: "Cisco Networking Academy",
        viewWebUrl: "https://pdfhost.io/v/e4FP5SB3ds_Data_Science_Essentials_with_Python",
        credlyBadgeId: "664f0975-7c01-47fc-8a96-43bba8690442",
        credlyPublicUrl: "https://www.credly.com/badges/664f0975-7c01-47fc-8a96-43bba8690442/public_url",
        credlyBadgeImageUrl: "https://images.credly.com/images/62db59ef-19f9-4652-a00c-7582baee8177/linkedin_thumb_blob",
      },
    ],
  },
  {
    id: "cert-06",
    title: "Data Analytics Essentials",
    subject: "Data Science",
    issuer: "Cisco Networking Academy x Credly",
    issueDate: "2026",
    skills: ["SQL", "Data Pipelines", "Business Intelligence", "Analytics Dashboards"],
    description: "Comprehensive data analytics principles: querying relational databases, business metrics extraction, data reporting, and trend analysis.",
    badgeBgColor: "from-cyan-600 via-blue-600 to-indigo-600",
    credlyVerified: true,
    variants: [
      {
        id: "v-da-ess-dict",
        name: "DICT-ITU DTC Initiative",
        viewWebUrl: "https://pdfhost.io/v/5gkCuFTd4F_Data_Analytics_Essentials",
      },
      {
        id: "v-da-ess-cisco",
        name: "Cisco Networking Academy",
        viewWebUrl: "https://pdfhost.io/v/4fsDGv9WLK_Data_Analytics_Essentials",
        credlyBadgeId: "df779424-ba5e-4387-8335-44607c053587",
        credlyPublicUrl: "https://www.credly.com/badges/df779424-ba5e-4387-8335-44607c053587/public_url",
        credlyBadgeImageUrl: "https://images.credly.com/images/1fdfeaeb-e61c-4450-bdfe-a07bd4e715df/linkedin_thumb_image.png",
      },
    ],
  },
  {
    id: "cert-07",
    title: "Introduction to Data Science",
    subject: "Data Science",
    issuer: "Cisco Networking Academy x Credly",
    issueDate: "2026",
    skills: ["Data Life Cycle", "Big Data", "Predictive Analytics"],
    description: "Overview of the end-to-end data science lifecycle, big data infrastructure, machine learning pipelines, and decision intelligence.",
    badgeBgColor: "from-teal-600 via-emerald-600 to-green-600",
    credlyVerified: true,
    variants: [
      {
        id: "v-intro-ds-dict",
        name: "DICT-ITU DTC Initiative",
        viewWebUrl: "https://pdfhost.io/v/zEquHFz5Bg_Introduction_to_Data_Science",
      },
      {
        id: "v-intro-ds-cisco",
        name: "Cisco Networking Academy",
        viewWebUrl: "https://pdfhost.io/v/Vj3GvdJUGa_Introduction_to_Data_Science",
        credlyBadgeId: "3b678f36-573e-40f7-b63e-607209028634",
        credlyPublicUrl: "https://www.credly.com/badges/3b678f36-573e-40f7-b63e-607209028634/public_url",
        credlyBadgeImageUrl: "https://images.credly.com/images/b38a42e0-dc58-4ce2-b6c0-28d978e8aaad/linkedin_thumb_image.png",
      },
    ],
  },

  // --- 8-9. CYBERSECURITY ---
  {
    id: "cert-08",
    title: "Ethical Hacker",
    subject: "Cybersecurity",
    issuer: "Cisco Networking Academy x Credly",
    issueDate: "2026",
    skills: ["Penetration Testing", "Vulnerability Scanning", "Network Hardening", "Metasploit"],
    description: "Professional offensive security training: threat modeling, penetration testing methodologies, exploits, network hardening, and security auditing.",
    badgeBgColor: "from-red-600 via-rose-600 to-pink-700",
    credlyVerified: true,
    variants: [
      {
        id: "v-eth-hacker-dict",
        name: "DICT-ITU DTC Initiative",
        viewWebUrl: "https://pdfhost.io/v/gM3UNsMVyf_Ethical_Hacker",
      },
      {
        id: "v-eth-hacker-cisco",
        name: "Cisco Networking Academy",
        viewWebUrl: "https://pdfhost.io/v/Pm59qhX3hE_Ethical_Hacker",
        credlyBadgeId: "a4a574a4-2c88-43c3-97fa-6d867e815055",
        credlyPublicUrl: "https://www.credly.com/badges/a4a574a4-2c88-43c3-97fa-6d867e815055/public_url",
        credlyBadgeImageUrl: "https://images.credly.com/images/242902b5-f527-42ad-865e-977c9e1b5b58/linkedin_thumb_image.png",
      },
    ],
  },
  {
    id: "cert-09",
    title: "Introduction to Cybersecurity",
    subject: "Cybersecurity",
    issuer: "Cisco Networking Academy x Credly",
    issueDate: "2026",
    skills: ["Cyber Hygiene", "Cryptography", "Firewalls", "Incident Response"],
    description: "Foundational security protocols, cryptographic standards, malware analysis basics, firewalls, and enterprise security governance.",
    badgeBgColor: "from-rose-600 via-red-700 to-red-900",
    credlyVerified: true,
    variants: [
      {
        id: "v-intro-cs-dict",
        name: "DICT-ITU DTC Initiative",
        viewWebUrl: "https://pdfhost.io/v/AFWLAMF7mf_Introduction_to_Cybersecurity",
      },
      {
        id: "v-intro-cs-cisco",
        name: "Cisco Networking Academy",
        viewWebUrl: "https://pdfhost.io/v/5TVttbP4Uy_Introduction_to_Cybersecurity",
        credlyBadgeId: "f53ca562-b7a5-4723-817b-d348547b1ab2",
        credlyPublicUrl: "https://www.credly.com/badges/f53ca562-b7a5-4723-817b-d348547b1ab2/public_url",
        credlyBadgeImageUrl: "https://images.credly.com/images/af8c6b4e-fc31-47c4-8dcb-eb7a2065dc5b/linkedin_thumb_I2CS__1_.png",
      },
    ],
  },

  // --- 10-19. SOFTWARE ENGINEERING ---
  {
    id: "cert-10",
    title: "Python Essentials 1",
    subject: "Software Engineering",
    issuer: "Cisco Networking Academy x OpenEDG",
    issueDate: "2026",
    skills: ["Control Flow", "Functions", "Lists & Tuples", "Basic Algorithms"],
    description: "Fundamental Python programming certification covering core control structures, data collections, functions, and problem-solving.",
    badgeBgColor: "from-yellow-500 via-amber-500 to-green-600",
    credlyVerified: true,
    variants: [
      {
        id: "v-py1-lyn",
        name: "Lyn Bloomer (Cisco Networking Academy)",
        viewWebUrl: "https://pdfhost.io/v/SHUk8h9tgA_Python_Essentials_1",
      },
      {
        id: "v-py1-dict",
        name: "DICT-ITU DTC Initiative",
        viewWebUrl: "https://pdfhost.io/v/hf5Y3htWL3_Python_Essentials_1",
      },
      {
        id: "v-py1-cisco",
        name: "Cisco Networking Academy",
        viewWebUrl: "https://pdfhost.io/v/Ltjdam9sT9_Python_Essentials_1",
        credlyBadgeId: "fdcaaeb7-c1ee-4b6b-8771-89d6f2e4da00",
        credlyPublicUrl: "https://www.credly.com/badges/fdcaaeb7-c1ee-4b6b-8771-89d6f2e4da00/public_url",
        credlyBadgeImageUrl: "https://images.credly.com/images/68c0b94d-f6ac-40b1-a0e0-921439eb092e/linkedin_thumb_image.png",
      },
    ],
  },
  {
    id: "cert-11",
    title: "Digital Safety and Security Awareness",
    subject: "Cybersecurity",
    issuer: "DICT-ITU DTC Initiative",
    issueDate: "2026",
    skills: ["Digital Hygiene", "Threat Awareness", "Online Safety"],
    description: "Practical awareness training for digital safety, secure habits, and online risk reduction.",
    badgeBgColor: "from-rose-500 via-orange-500 to-amber-500",
    credlyVerified: true,
    variants: [
      {
        id: "v-digital-safety",
        name: "DICT-ITU DTC Initiative",
        viewWebUrl: "https://pdfhost.io/v/7S2b2RW7WH_Digital_Safety_and_Security_Awareness",
      },
      {
        id: "v-digital-safety-cisco",
        name: "Cisco Networking Academy",
        viewWebUrl: "https://pdfhost.io/v/7S2b2RW7WH_Digital_Safety_and_Security_Awareness",
        credlyBadgeId: "4f4c6e8e-1659-4ea3-aa28-df59e2235a10",
        credlyPublicUrl: "https://www.credly.com/badges/4f4c6e8e-1659-4ea3-aa28-df59e2235a10/public_url",
        credlyBadgeImageUrl: "https://images.credly.com/images/92d90000-9c96-4dbd-a37d-8c47bf338bca/linkedin_thumb_blob",
      },
    ],
  },
  {
    id: "cert-12",
    title: "Python Essentials 2",
    subject: "Software Engineering",
    issuer: "Cisco Networking Academy x OpenEDG",
    issueDate: "2026",
    skills: ["OOP", "Modules & Packages", "File Streams", "Exceptions"],
    description: "Advanced Python development certification covering Object-Oriented Programming, custom packages, data streams, and exception handling.",
    badgeBgColor: "from-green-600 via-emerald-600 to-teal-700",
    credlyVerified: true,
    variants: [
      {
        id: "v-py2-lyn",
        name: "Lyn Bloomer (Cisco Networking Academy)",
        viewWebUrl: "https://pdfhost.io/v/tGHD66b8Gb_Python_Essentials_2",
      },
      {
        id: "v-py2-dict",
        name: "DICT-ITU DTC Initiative",
        viewWebUrl: "https://pdfhost.io/v/JxheMKdFun_Python_Essentials_2",
      },
      {
        id: "v-py2-cisco",
        name: "Cisco Networking Academy",
        viewWebUrl: "https://pdfhost.io/v/JLX6nbvQb6_Python_Essentials_2",
        credlyBadgeId: "c7a050c7-62e9-4220-84c2-88fbc1afdf85",
        credlyPublicUrl: "https://www.credly.com/badges/c7a050c7-62e9-4220-84c2-88fbc1afdf85/public_url",
        credlyBadgeImageUrl: "https://images.credly.com/images/3f802526-7274-4230-91ab-f6d1a35340e6/linkedin_thumb_image.png",
      },
    ],
  },
  {
    id: "cert-13",
    title: "C++ Essentials 1",
    subject: "Software Engineering",
    issuer: "Cisco Networking Academy x C++ Institute",
    issueDate: "2026",
    skills: ["Variables", "Operators", "Functions", "Pointers Intro"],
    description: "Fundamental C++ system programming: syntax, functions, memory pointers, and compilation mechanics.",
    badgeBgColor: "from-blue-600 via-indigo-600 to-slate-800",
    credlyVerified: true,
    variants: [
      {
        id: "v-cpp1-dict",
        name: "DICT-ITU DTC Initiative",
        viewWebUrl: "https://pdfhost.io/v/DwrUewfePp_C___Essentials_1",
      },
      {
        id: "v-cpp1-cisco",
        name: "Cisco Networking Academy",
        viewWebUrl: "https://pdfhost.io/v/UAnjahJCVw_C___Essentials_1",
        credlyBadgeId: "eed4b2be-12c7-4a58-b480-a13e9277273c",
        credlyPublicUrl: "https://www.credly.com/badges/eed4b2be-12c7-4a58-b480-a13e9277273c/public_url",
        credlyBadgeImageUrl: "https://images.credly.com/images/fd262680-b0e1-41e0-bd03-6f9ea2b0c4e8/linkedin_thumb_image.png",
      },
    ],
  },
  {
    id: "cert-14",
    title: "C++ Essentials 2",
    subject: "Software Engineering",
    issuer: "Cisco Networking Academy x C++ Institute",
    issueDate: "2026",
    skills: ["Pointers", "Dynamic Memory", "Classes & Structs", "Overloading"],
    description: "Intermediate C++ development: dynamic memory allocation, class inheritance, operator overloading, and reference management.",
    badgeBgColor: "from-indigo-600 via-blue-700 to-sky-800",
    credlyVerified: true,
    variants: [
      {
        id: "v-cpp2-dict",
        name: "DICT-ITU DTC Initiative",
        viewWebUrl: "https://pdfhost.io/v/JKrTBMTKGU_C___Essentials_2",
      },
      {
        id: "v-cpp2-cisco",
        name: "Cisco Networking Academy",
        viewWebUrl: "https://pdfhost.io/v/rrcFN7uv49_C___Essentials_2",
        credlyBadgeId: "58418359-fd28-4e2f-a0eb-37b9d9f5e978",
        credlyPublicUrl: "https://www.credly.com/badges/58418359-fd28-4e2f-a0eb-37b9d9f5e978/public_url",
        credlyBadgeImageUrl: "https://images.credly.com/images/f1f94d14-e573-4013-9386-62d417d5a3fb/linkedin_thumb_image.png",
      },
    ],
  },
  {
    id: "cert-15",
    title: "C++ Advanced",
    subject: "Software Engineering",
    issuer: "Cisco Networking Academy x C++ Institute",
    issueDate: "2026",
    skills: ["STL Containers", "Templates", "Exception Safety", "Performance"],
    description: "Advanced C++ specialization: Standard Template Library (STL), generic templates, memory safety, and high-performance algorithms.",
    badgeBgColor: "from-sky-500 via-blue-600 to-indigo-800",
    credlyVerified: true,
    variants: [
      {
        id: "v-cpp-adv-dict",
        name: "DICT-ITU DTC Initiative",
        viewWebUrl: "https://pdfhost.io/v/9VeutnSTay_C___Advanced",
      },
      {
        id: "v-cpp-adv-cisco",
        name: "Cisco Networking Academy",
        viewWebUrl: "https://pdfhost.io/v/pZeh6w9yb4_C___Advanced",
        credlyBadgeId: "d5e9426a-1029-4ed6-b1fd-51f8a0c6a41c",
        credlyPublicUrl: "https://www.credly.com/badges/d5e9426a-1029-4ed6-b1fd-51f8a0c6a41c/public_url",
        credlyBadgeImageUrl: "https://images.credly.com/images/dc2d1946-7275-47a8-8f98-acc1da4fd73d/linkedin_thumb_image.png",
      },
    ],
  },
  {
    id: "cert-16",
    title: "JavaScript Essentials 1",
    subject: "Software Engineering",
    issuer: "Cisco Networking Academy x Credly",
    issueDate: "2026",
    skills: ["ES6 Syntax", "DOM Controls", "Events", "Functions"],
    description: "Core JavaScript web engine development: variables, control flow, functions, DOM events, and browser APIs.",
    badgeBgColor: "from-yellow-400 via-amber-500 to-orange-500",
    credlyVerified: true,
    variants: [
      {
        id: "v-js1-dict",
        name: "DICT-ITU DTC Initiative",
        viewWebUrl: "https://pdfhost.io/v/g4a3wmPn4t_JavaScript_Essentials_1",
      },
      {
        id: "v-js1-cisco",
        name: "Cisco Networking Academy",
        viewWebUrl: "https://pdfhost.io/v/xkNK4bh7F9_JavaScript_Essentials_1",
        credlyBadgeId: "c4666247-e181-4ddd-b471-edae5c987e62",
        credlyPublicUrl: "https://www.credly.com/badges/c4666247-e181-4ddd-b471-edae5c987e62/public_url",
        credlyBadgeImageUrl: "https://images.credly.com/images/b93bf373-3da6-4ada-9879-a0c39d6a11f8/linkedin_thumb_image.png",
      },
    ],
  },
  {
    id: "cert-17",
    title: "JavaScript Essentials 2",
    subject: "Software Engineering",
    issuer: "Cisco Networking Academy x Credly",
    issueDate: "2026",
    skills: ["Async/Await", "Promises", "Prototypes", "Web APIs"],
    description: "Advanced JavaScript engineering: asynchronous Event Loop, Promises, Fetch API, class prototypes, and error handling.",
    badgeBgColor: "from-amber-500 via-yellow-600 to-orange-600",
    credlyVerified: true,
    variants: [
      {
        id: "v-js2-dict",
        name: "DICT-ITU DTC Initiative",
        viewWebUrl: "https://pdfhost.io/v/AmBJ4dyRKZ_JavaScript_Essentials_2",
      },
      {
        id: "v-js2-cisco",
        name: "Cisco Networking Academy",
        viewWebUrl: "https://pdfhost.io/v/WYXZ9DGfn4_JavaScript_Essentials_2",
        credlyBadgeId: "f103bf83-5b0e-41fe-a99b-0d79489d62e3",
        credlyPublicUrl: "https://www.credly.com/badges/f103bf83-5b0e-41fe-a99b-0d79489d62e3/public_url",
        credlyBadgeImageUrl: "https://images.credly.com/images/e090c1e1-dbd4-40f8-bbb3-93cc07884d7f/linkedin_thumb_image.png",
      },
    ],
  },
  {
    id: "cert-18",
    title: "HTML Essentials",
    subject: "Software Engineering",
    issuer: "Cisco Networking Academy x Credly",
    issueDate: "2026",
    skills: ["Semantic Tags", "Accessibility (a11y)", "Forms", "DOM Trees"],
    description: "Semantic HTML5 architecture, accessibility compliance, web forms, and document structure standards.",
    badgeBgColor: "from-orange-500 via-amber-600 to-red-600",
    credlyVerified: true,
    variants: [
      {
        id: "v-html-dict",
        name: "DICT-ITU DTC Initiative",
        viewWebUrl: "https://pdfhost.io/v/459X66cNR3_HTML_Essentials",
      },
      {
        id: "v-html-cisco",
        name: "Cisco Networking Academy",
        viewWebUrl: "https://pdfhost.io/v/rAVGsHhJgz_HTML_Essentials",
        credlyBadgeId: "7670e2fe-10c0-45c8-a680-cde94bf45d7f",
        credlyPublicUrl: "https://www.credly.com/badges/7670e2fe-10c0-45c8-a680-cde94bf45d7f/public_url",
        credlyBadgeImageUrl: "https://images.credly.com/images/b1c17d0c-e76b-45fc-9b28-87b01ae1caf3/linkedin_thumb_blob",
      },
    ],
  },
  {
    id: "cert-19",
    title: "CSS Essentials",
    subject: "Software Engineering",
    issuer: "Cisco Networking Academy x Credly",
    issueDate: "2026",
    skills: ["Flexbox", "Grid", "Animations", "Responsive Design"],
    description: "Modern CSS layout design: Flexbox, CSS Grid, custom properties, animations, and responsive breakpoints.",
    badgeBgColor: "from-blue-500 via-indigo-600 to-sky-600",
    credlyVerified: true,
    variants: [
      {
        id: "v-css-dict",
        name: "DICT-ITU DTC Initiative",
        viewWebUrl: "https://pdfhost.io/v/cFjFG9fVKV_CSS_Essentials",
      },
      {
        id: "v-css-cisco",
        name: "Cisco Networking Academy",
        viewWebUrl: "https://pdfhost.io/v/Cg2WNjnNhB_CSS_Essentials",
        credlyBadgeId: "4f7f4a03-37d9-4b2a-96c0-09acdf694362",
        credlyPublicUrl: "https://www.credly.com/badges/4f7f4a03-37d9-4b2a-96c0-09acdf694362/public_url",
        credlyBadgeImageUrl: "https://images.credly.com/images/bd2bba36-66ad-4de2-9d91-e29433e51a16/linkedin_thumb_blob",
      },
    ],
  },

  // --- 20-22. SYSTEMS & IOT ---
  {
    id: "cert-20",
    title: "Introduction to IoT and Digital Transformation",
    subject: "Systems & IoT",
    issuer: "Cisco Networking Academy x Credly",
    issueDate: "2026",
    skills: ["Sensors", "Digital Transformation", "IoT Platforms"],
    description: "Introduction to IoT-driven digital transformation and connected systems for modern operations.",
    badgeBgColor: "from-cyan-600 via-teal-600 to-blue-700",
    credlyVerified: true,
    variants: [
      {
        id: "v-iot-dict",
        name: "DICT-ITU DTC Initiative",
        viewWebUrl: "https://pdfhost.io/v/zKPWFcF65t_Introduction_to_IoT_and_Digital_Transformation",
      },
      {
        id: "v-iot-cisco",
        name: "Cisco Networking Academy",
        viewWebUrl: "https://pdfhost.io/v/2C9j626zpZ_Introduction_to_IoT_and_Digital_Transformation",
        credlyBadgeId: "85504c74-946a-46eb-a293-028044350480",
        credlyPublicUrl: "https://www.credly.com/badges/85504c74-946a-46eb-a293-028044350480/public_url",
        credlyBadgeImageUrl: "https://images.credly.com/images/fce226c2-0f13-4e17-b60c-24fa6ffd88cb/linkedin_thumb_Intro2IoT.png",
      },
    ],
  },
  {
    id: "cert-21",
    title: "Hardware and Upgrade Support",
    subject: "Systems & IoT",
    issuer: "Cisco Networking Academy x Credly",
    issueDate: "2026",
    skills: ["Hardware Support", "Upgrades", "Troubleshooting"],
    description: "Practical hardware maintenance and upgrade support workflows for end-user and enterprise systems.",
    badgeBgColor: "from-slate-600 via-gray-700 to-zinc-800",
    credlyVerified: true,
    variants: [
      {
        id: "v-hardware-dict",
        name: "DICT-ITU DTC Initiative",
        viewWebUrl: "https://pdfhost.io/v/fQvPZsLH52_Hardware_and_Upgrade_Support",
      },
      {
        id: "v-hardware-cisco",
        name: "Cisco Networking Academy",
        viewWebUrl: "https://pdfhost.io/v/FGye98mqQs_Hardware_and_Upgrade_Support",
        credlyBadgeId: "1050e0bf-c6cb-4c56-baf1-1ec43dc4d50b",
        credlyPublicUrl: "https://www.credly.com/badges/1050e0bf-c6cb-4c56-baf1-1ec43dc4d50b/public_url",
        credlyBadgeImageUrl: "https://images.credly.com/images/94cbdf0d-3e44-44b2-b213-866fe22aa7d5/linkedin_thumb_blob",
      },
    ],
  },
  {
    id: "cert-22",
    title: "Operating Systems Support",
    subject: "Systems & IoT",
    issuer: "Cisco Networking Academy x Credly",
    issueDate: "2026",
    skills: ["Linux Bash", "Process Control", "File Systems", "Troubleshooting"],
    description: "Operating system internals, Linux bash scripting, process management, memory allocation, troubleshooting, and kernel config.",
    badgeBgColor: "from-zinc-600 via-slate-700 to-stone-800",
    credlyVerified: true,
    variants: [
      {
        id: "v-os-support-dict",
        name: "DICT-ITU DTC Initiative",
        viewWebUrl: "https://pdfhost.io/v/ANxVkTnyTn_Operating_Systems_Support",
      },
      {
        id: "v-os-support-cisco",
        name: "Cisco Networking Academy",
        viewWebUrl: "https://pdfhost.io/v/tDp7BrDSPh_Operating_Systems_Support",
        credlyBadgeId: "f39b2e79-5f07-4ea0-aeb3-e574befbb40a",
        credlyPublicUrl: "https://www.credly.com/badges/f39b2e79-5f07-4ea0-aeb3-e574befbb40a/public_url",
        credlyBadgeImageUrl: "https://images.credly.com/images/70cc28ef-542c-4ce2-8bad-e8d95daf5138/linkedin_thumb_blob",
      },
    ],
  },

  // --- 23-28. BUSINESS & PROFESSIONAL ---
  {
    id: "cert-23",
    title: "Discovering Entrepreneurship",
    subject: "Business & Professional",
    issuer: "Cisco Networking Academy x Credly",
    issueDate: "2026",
    skills: ["Venture Strategy", "Product Design", "Monetization Models"],
    description: "Technology venture creation, product-market fit evaluation, business model strategy, agile planning, and monetization.",
    badgeBgColor: "from-emerald-600 via-green-600 to-teal-700",
    credlyVerified: true,
    variants: [
      {
        id: "v-entrepreneur-dict",
        name: "DICT-ITU DTC Initiative",
        viewWebUrl: "https://pdfhost.io/v/xqDYLvmzDx_Discovering_Entrepreneurship",
      },
      {
        id: "v-entrepreneur-cisco",
        name: "Cisco Networking Academy",
        viewWebUrl: "https://pdfhost.io/v/xgNnknTPjn_Discovering_Entrepreneurship",
        credlyBadgeId: "8c470820-13ea-4385-8e62-ff40ebcd594f",
        credlyPublicUrl: "https://www.credly.com/badges/8c470820-13ea-4385-8e62-ff40ebcd594f/public_url",
        credlyBadgeImageUrl: "https://images.credly.com/images/0c77c11b-e3cf-4734-8fd4-2d920151ae0b/linkedin_thumb_image.png",
      },
    ],
  },
  {
    id: "cert-24",
    title: "Data Analytics: Your Game-Changer for 2025",
    subject: "Business & Professional",
    issuer: "UniAthena International Graduate School",
    issueDate: "2026",
    skills: ["Executive Leadership", "Strategic Management", "Global Tech"],
    description: "International executive leadership, organizational strategy, and technology management certification.",
    badgeBgColor: "from-gray-600 via-slate-700 to-zinc-900",
    credlyVerified: false,
    variants: [
      {
        id: "v-uniathena",
        name: "UniAthena International Graduate School",
        viewWebUrl: "https://pdfhost.io/v/UB2w3V3fDH_Data_Analytics__Your_Game-Changer_for_2025",
      },
    ],
  },
  {
    id: "cert-25",
    title: "MS Excel: For Real World Office Productivity",
    subject: "Business & Professional",
    issuer: "DataSense Analytics",
    issueDate: "2026",
    skills: ["Excel", "Office Productivity", "Data Analysis"],
    description: "Real-world office productivity and spreadsheet analytics certification.",
    badgeBgColor: "from-cyan-600 via-blue-700 to-indigo-800",
    credlyVerified: false,
    variants: [
      {
        id: "v-datasense",
        name: "DataSense Analytics",
        viewWebUrl: "https://pdfhost.io/v/FMZWnrgzxw_MS_Excel__For_Real_World_Office_Productivity",
      },
    ],
  },
  {
    id: "cert-26",
    title: "Cybersecurity for Small and Medium Enterprises (SMEs): Protecting Your Business From Cyber Threats",
    subject: "Business & Professional",
    issuer: "DICT - Caraga Region",
    issueDate: "2026",
    skills: ["Cybersecurity", "SME Protection", "Risk Awareness"],
    description: "Cybersecurity for small and medium enterprises, focused on protecting businesses from cyber threats.",
    badgeBgColor: "from-slate-700 via-slate-800 to-slate-950",
    credlyVerified: false,
    variants: [
      {
        id: "v-caraga-cyber",
        name: "DICT - Caraga Region",
        viewWebUrl: "https://pdfhost.io/v/7bUsJJLEpN_Cybersecurity_for_Small_and_Medium_Enterprises__SMEs___Protecting_Your_Business_From_Cyber_Threats",
      },
    ],
  },
  {
    id: "cert-27",
    title: "Digital Marketing for Startups and MSMEs using AI",
    subject: "Business & Professional",
    issuer: "DICT - Caraga Region",
    issueDate: "2026",
    skills: ["Digital Marketing", "AI", "SME Growth"],
    description: "Digital marketing for startups and MSMEs using AI tools and strategies.",
    badgeBgColor: "from-amber-600 via-orange-700 to-red-800",
    credlyVerified: false,
    variants: [
      {
        id: "v-caraga-marketing",
        name: "DICT - Caraga Region",
        viewWebUrl: "https://pdfhost.io/v/YJa5arskM8_Digital_Marketing_for_Startups_and_MSMEs_using_AI",
      },
    ],
  },
  {
    id: "cert-28",
    title: "Module 4 - Object Oriented Programming",
    subject: "Business & Professional",
    issuer: "",
    issueDate: "2026",
    skills: ["International Collaboration", "Online Learning"],
    description: "Collaborative online international learning programme certification.",
    badgeBgColor: "from-cyan-600 via-blue-700 to-indigo-800",
    credlyVerified: false,
    variants: [
      {
        id: "v-cavite",
        name: "Cavite State University x Universiti Teknologi Mara",
        viewWebUrl: "https://pdfhost.io/v/PwVgsvxpHE_Module_4_-_Object_Oriented_Programming",
      },
    ],
  },
];

const SUBJECT_CATEGORIES = [
  "ALL SUBJECTS (28)",
  "AI",
  "DATA SCIENCE",
  "CYBERSECURITY",
  "SOFTWARE ENGINEERING",
  "SYSTEMS & IOT",
  "BUSINESS & PROFESSIONAL",
] as const;

const AI_FUNDAMENTALS_CERT_IDS = new Set(["cert-01", "cert-02", "cert-03"]);

const CERT_ARTWORK_BY_ID: Partial<Record<string, string | string[]>> = {
  "cert-04": "https://images.credly.com/images/33ba62e4-b26d-4b95-9121-1ad01b754224/linkedin_thumb_blob",
  "cert-05": "https://images.credly.com/images/62db59ef-19f9-4652-a00c-7582baee8177/linkedin_thumb_blob",
  "cert-06": "https://images.credly.com/images/1fdfeaeb-e61c-4450-bdfe-a07bd4e715df/linkedin_thumb_image.png",
  "cert-07": "https://images.credly.com/images/b38a42e0-dc58-4ce2-b6c0-28d978e8aaad/linkedin_thumb_image.png",
  "cert-08": "https://images.credly.com/images/242902b5-f527-42ad-865e-977c9e1b5b58/linkedin_thumb_image.png",
  "cert-09": "https://images.credly.com/images/af8c6b4e-fc31-47c4-8dcb-eb7a2065dc5b/linkedin_thumb_I2CS__1_.png",
  "cert-10": "https://images.credly.com/images/68c0b94d-f6ac-40b1-a0e0-921439eb092e/linkedin_thumb_image.png",
  "cert-11": "https://images.credly.com/images/92d90000-9c96-4dbd-a37d-8c47bf338bca/linkedin_thumb_blob",
  "cert-12": "https://images.credly.com/images/3f802526-7274-4230-91ab-f6d1a35340e6/linkedin_thumb_image.png",
  "cert-13": "https://images.credly.com/images/fd262680-b0e1-41e0-bd03-6f9ea2b0c4e8/linkedin_thumb_image.png",
  "cert-14": "https://images.credly.com/images/f1f94d14-e573-4013-9386-62d417d5a3fb/linkedin_thumb_image.png",
  "cert-15": "https://images.credly.com/images/dc2d1946-7275-47a8-8f98-acc1da4fd73d/linkedin_thumb_image.png",
  "cert-16": "https://images.credly.com/images/b93bf373-3da6-4ada-9879-a0c39d6a11f8/linkedin_thumb_image.png",
  "cert-17": "https://images.credly.com/images/e090c1e1-dbd4-40f8-bbb3-93cc07884d7f/linkedin_thumb_image.png",
  "cert-18": "https://images.credly.com/images/b1c17d0c-e76b-45fc-9b28-87b01ae1caf3/linkedin_thumb_blob",
  "cert-19": "https://images.credly.com/images/bd2bba36-66ad-4de2-9d91-e29433e51a16/linkedin_thumb_blob",
  "cert-20": "https://images.credly.com/images/fce226c2-0f13-4e17-b60c-24fa6ffd88cb/linkedin_thumb_Intro2IoT.png",
  "cert-21": "https://images.credly.com/images/94cbdf0d-3e44-44b2-b213-866fe22aa7d5/linkedin_thumb_blob",
  "cert-22": "https://images.credly.com/images/70cc28ef-542c-4ce2-8bad-e8d95daf5138/linkedin_thumb_blob",
  "cert-23": "https://images.credly.com/images/0c77c11b-e3cf-4734-8fd4-2d920151ae0b/linkedin_thumb_image.png",
  "cert-24": "https://play-lh.googleusercontent.com/GlLhzUqFThey7irbBznTNIEo67kCe6ArkmGFlngWnLXsVypm60OJqdpIZdNkQZ5qs18=w600-h300-pc0xffffff-pd",
  "cert-25": "https://i.imgur.com/B1pn3na.png",
  "cert-26": "https://i.imgur.com/hZm8xlh.png",
  "cert-27": "https://i.imgur.com/hZm8xlh.png",
  "cert-28": [
    "https://upload.wikimedia.org/wikipedia/en/d/d2/Cavite_State_University_%28CvSU%29.png",
    "https://i.imgur.com/eDWNpBb.png",
  ],
};

function CredentialCardBody({ cert, badge }: { cert: RealCertification; badge: ReactNode }) {
  const verifiedVariants = cert.variants.filter((variant) => variant.credlyPublicUrl);
  const issuerCount = cert.variants.length;

  return (
    <>
      <div className="relative -mt-14 mb-7 flex justify-center items-end px-5 pointer-events-none">
        {badge}
      </div>

      <div className="px-5 pt-3 pb-5 flex flex-col flex-1">
        <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-ash)] block mb-1.5 truncate">
          {cert.issuer}
        </span>

        <h3 className="font-display text-base font-bold text-[var(--color-starlight)] leading-snug group-hover:text-[var(--color-accent-warm)] transition-colors mb-2">
          {cert.title}
        </h3>

        <p className="font-body text-xs text-[var(--color-silver)] line-clamp-2 leading-relaxed mb-4">
          {cert.description}
        </p>

        <div className="mt-auto pt-4 border-t border-[var(--color-glass-border)] space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {cert.skills.slice(0, 3).map((skill) => (
              <span
                key={skill}
                className="font-mono text-[9px] text-[var(--color-silver)] bg-white/5 px-2 py-0.5 rounded-md border border-white/10"
              >
                {skill}
              </span>
            ))}
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0 font-mono text-[9.5px] text-[var(--color-ash)]">
              <span className="text-[var(--color-accent-primary)] font-bold uppercase tracking-wide truncate">
                {cert.subject}
              </span>
              {cert.credlyVerified && (
                <span className="flex items-center gap-1 text-amber-400 shrink-0">
                  <BadgeCheck size={11} />
                  Verified
                </span>
              )}
              {issuerCount > 1 && (
                <span className="flex items-center gap-1 text-cyan-300 shrink-0">
                  <Layers size={11} />
                  {issuerCount}
                </span>
              )}
              {verifiedVariants.length > 0 && verifiedVariants.length !== issuerCount && (
                <span className="sr-only">{verifiedVariants.length} verified issuer(s)</span>
              )}
            </div>

            <span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--color-silver)] group-hover:text-[var(--color-starlight)] transition-colors">
              View →
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

const INITIAL_VISIBLE = 6;

export default function Certifications() {
  const [activeSubject, setActiveSubject] = useState<string>("ALL SUBJECTS (28)");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCert, setSelectedCert] = useState<RealCertification | null>(null);
  const [activeVariantId, setActiveVariantId] = useState<string>("");
  const [mounted, setMounted] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const lenis = useLenis();

  /* Clicking a subject filter tab re-renders the credential grid, which can
     change the page height. Left alone, Lenis' cached scroll limit goes stale
     and the page jumps — the "tab click resets scroll" report. Capture the
     offset at click time and restore it once the new grid is laid out. */
  const preserveScrollRef = useRef<number | null>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  /* Same root cause as the EVA modal: `overflow: hidden` on body/html does
     nothing while Lenis is running, because Lenis translates the page from
     its own rAF loop rather than using native scroll. The shared hook stops
     the instance, pins the body (the only lock iOS honours), and restores
     the exact scroll offset on close. */
  useScrollLock(!!selectedCert, lenis);

  /* Escape closes the inspector — expected of any modal, and the only way
     out for keyboard users if the header scrolls out of reach. */
  useEffect(() => {
    if (!selectedCert) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedCert(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedCert]);

  /* Restore the scroll offset captured on a subject-tab click, after the new
     grid has been laid out. `immediate` + `force` write straight through
     Lenis so the restore can't be animated or swallowed by a stale state. */
  useLayoutEffect(() => {
    const y = preserveScrollRef.current;
    if (y === null) return;
    preserveScrollRef.current = null;
    if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
    else window.scrollTo({ top: y, behavior: "instant" as ScrollBehavior });
  }, [activeSubject, expanded, lenis]);

  // Open Inspector Modal with default variant selected
  const handleOpenInspector = (cert: RealCertification) => {
    setSelectedCert(cert);
    const preferredVariant = cert.variants.find((variant) => variant.credlyBadgeId) ?? cert.variants[0];
    if (preferredVariant) {
      setActiveVariantId(preferredVariant.id);
    }
  };

  const currentVariant = useMemo(() => {
    if (!selectedCert) return null;
    return (
      selectedCert.variants.find((v) => v.id === activeVariantId) ||
      selectedCert.variants[0]
    );
  }, [selectedCert, activeVariantId]);

  // Filtered certifications calculation across ALL 28
  const filteredCerts = useMemo(() => {
    return ALL_28_CERTIFICATIONS.filter((cert) => {
      const matchesSubject =
        activeSubject === "ALL SUBJECTS (28)" ||
        cert.subject.toUpperCase() === activeSubject;
      const matchesSearch =
        cert.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cert.skills.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase())) ||
        cert.issuer.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSubject && matchesSearch;
    });
  }, [activeSubject, searchQuery]);

  return (
    <section id="certifications" className="section-padding relative select-none overflow-hidden">
      {/* Background ambient lighting */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full blur-[160px] bg-[var(--color-accent-primary)]/10 z-0" />

      <div className="container-narrow relative z-10">
        <ChapterLabel index={5} classic="Credential Vault (28 Certs)" eva="CREDENTIAL VAULT" className="mb-8" />

        <div className="mb-8">
          <div>
            <RevealText
              as="h2"
              className="text-section-title mb-4 font-display text-[var(--color-starlight)]"
            >
              28 Official Verified Credentials.
            </RevealText>
            <p className="font-body text-base text-[var(--color-silver)] max-w-prose">
              Browse 28 verified professional certifications. Click any tile to inspect multi-issuer credentials (Cisco, IBM, DICT-ITU), view web certificate links, and verify official Credly badges.
            </p>
          </div>

        </div>

        {/* Toolbar: search + subject filter live in one cohesive surface.
            The field keeps a floor width (`sm:basis-64`) instead of a bare
            `flex-1`: next to a 7-button filter row, flex shrank it below the
            width of its own placeholder, which is why the label was clipped
            mid-word. */}
        <div className="glass border border-[var(--color-glass-border)] rounded-2xl p-3 sm:p-3.5 mb-10 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative w-full sm:basis-64 sm:shrink-0 min-w-0">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-ash)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setExpanded(false);
              }}
              placeholder="Search title or issuer…"
              className="w-full min-w-0 pl-10 pr-3 py-2.5 rounded-xl bg-[var(--color-glass-highlight)] border border-[var(--color-glass-border)] font-mono text-[11px] text-[var(--color-starlight)] text-ellipsis placeholder:text-[var(--color-ash)] focus:outline-none focus:border-[var(--color-accent-primary)]/60 transition-colors"
            />
          </div>

          <div className="hidden sm:block w-px self-stretch bg-[var(--color-glass-border)]" />

          <div className="flex flex-wrap gap-1.5">
            {SUBJECT_CATEGORIES.map((cat) => {
              const isActive = activeSubject === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    preserveScrollRef.current = window.scrollY;
                    setActiveSubject(cat);
                    setExpanded(false);
                  }}
                  className={`px-3 py-2 rounded-lg font-mono text-[10.5px] uppercase tracking-wider transition-[color,background-color,transform] duration-200 ease-out cursor-pointer active:scale-[0.97] ${isActive
                    ? "bg-[var(--color-accent-primary)] text-white font-bold"
                    : "text-[var(--color-silver)] hover:text-[var(--color-starlight)] hover:bg-[var(--color-glass-highlight)]"
                    }`}
                  data-cursor-hover
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* Credential Grid */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 hover-focus-container">
          <AnimatePresence initial={false}>
            {(expanded ? filteredCerts : filteredCerts.slice(0, INITIAL_VISIBLE)).map((cert) => {
              const defaultVariant = cert.variants.find((variant) => variant.credlyBadgeId) ?? cert.variants[0];
              const verifiedVariants = cert.variants.filter((variant) => variant.credlyPublicUrl);
              const badgeImageUrl = defaultVariant?.credlyBadgeImageUrl;
              const badgeVariantsToShow = verifiedVariants.filter((variant) => variant.credlyBadgeImageUrl).slice(0, 3);
              const artworkUrl = CERT_ARTWORK_BY_ID[cert.id];

              let badgeNode: ReactNode;
              if (AI_FUNDAMENTALS_CERT_IDS.has(cert.id)) {
                if (badgeVariantsToShow.length > 1) {
                  badgeNode = (
                    <div
                      className="grid gap-7 w-full max-w-[20rem] h-28"
                      style={{ gridTemplateColumns: `repeat(${badgeVariantsToShow.length}, minmax(0, 1fr))` }}
                    >
                      {badgeVariantsToShow.map((variant) => (
                        <div
                          key={variant.id}
                          className="h-full flex items-center justify-center drop-shadow-[0_20px_26px_rgba(0,0,0,0.6)] transition-all will-change-transform transform-gpu duration-500 ease-out group-hover:-translate-y-3 group-hover:scale-105"
                        >
                          {/* Remote badge URLs vary by issuer/CDN; keep native img here. */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={variant.credlyBadgeImageUrl}
                            alt={`${variant.name} badge artwork`}
                            className="h-full w-full object-contain"
                            loading="lazy"
                            decoding="async"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      ))}
                    </div>
                  );
                } else if (badgeImageUrl) {
                  badgeNode = (
                    <div className="w-36 h-36 flex items-center justify-center drop-shadow-[0_22px_28px_rgba(0,0,0,0.6)] transition-all will-change-transform transform-gpu duration-500 ease-out group-hover:-translate-y-3.5 group-hover:scale-105">
                      {/* Remote badge URLs vary by issuer/CDN; keep native img here. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={badgeImageUrl}
                        alt={`${defaultVariant?.name ?? cert.title} badge artwork`}
                        className="h-full w-full object-contain"
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  );
                } else {
                  badgeNode = (
                    <div className={`w-24 h-24 rounded-2xl bg-gradient-to-br ${cert.badgeBgColor} flex items-center justify-center text-white shadow-[0_22px_28px_rgba(0,0,0,0.6)] transition-all will-change-transform transform-gpu duration-500 ease-out group-hover:-translate-y-3.5 group-hover:scale-105`}>
                      <SubjectIcon subject={cert.subject} size={40} />
                    </div>
                  );
                }
              } else if (artworkUrl) {
                const artworkList = Array.isArray(artworkUrl) ? artworkUrl : [artworkUrl];

                badgeNode =
                  artworkList.length > 1 ? (
                    <div
                      className="grid gap-7 w-full max-w-[20rem] h-28"
                      style={{ gridTemplateColumns: `repeat(${artworkList.length}, minmax(0, 1fr))` }}
                    >
                      {artworkList.map((url) => (
                        <div
                          key={url}
                          className="h-full flex items-center justify-center drop-shadow-[0_20px_26px_rgba(0,0,0,0.6)] transition-all will-change-transform transform-gpu duration-500 ease-out group-hover:-translate-y-3 group-hover:scale-105"
                        >
                          {/* Certificate artwork can be remote; preserve native img + no-referrer. */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt={`${cert.title} certificate artwork`}
                            className="h-full w-full object-contain"
                            loading="lazy"
                            decoding="async"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="w-full max-w-[17.5rem] h-28 flex items-center justify-center drop-shadow-[0_22px_28px_rgba(0,0,0,0.6)] transition-all will-change-transform transform-gpu duration-500 ease-out group-hover:-translate-y-3.5 group-hover:scale-105">
                      {/* Certificate artwork can be remote; preserve native img + no-referrer. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={artworkList[0]}
                        alt={`${cert.title} certificate artwork`}
                        className="h-full w-full object-contain"
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  );
              } else {
                badgeNode = (
                  <div className={`w-full max-w-[15rem] h-28 rounded-[1.5rem] bg-gradient-to-br ${cert.badgeBgColor} shadow-[0_16px_28px_-18px_rgba(0,0,0,0.6)] flex items-center justify-center transition-all duration-500 ease-out group-hover:-translate-y-3`}>
                    <SubjectIcon subject={cert.subject} size={44} className="text-white" />
                  </div>
                );
              }

              return (
                /* No entrance, exit or stagger on the tiles. Expanding used to
                   pop each new card in with a scaled, delayed fade; the ask was
                   for the list to simply grow, so the extra cards are present
                   the frame they are added and the only movement is the page
                   reflowing around them. Hover/tap feedback stays.

                   Also no `layout` and no spring: closing the inspector
                   restores the locked scroll offset, so every card's box
                   changes in one frame, which Framer would read as a move and
                   bounce the whole tile set. */
                <motion.div
                  key={cert.id}
                  whileHover={{ scale: 1.02, y: -6 }}
                  whileTap={{ scale: 0.99 }}
                  transition={{ duration: 0.24, ease: EASING }}

                  onClick={() => handleOpenInspector(cert)}
                  data-hoverable
                  data-cursor-hover
                  className="group relative rounded-2xl glass border border-[var(--color-glass-border)] hover:border-[var(--color-accent-primary)]/70 transition-[border-color,box-shadow] duration-500 ease-out flex flex-col overflow-visible cursor-pointer pt-12 hover:z-30 hover:shadow-[0_32px_75px_-16px_rgba(67,97,238,0.55)]"
                >
                  <CredentialCardBody cert={cert} badge={badgeNode} />
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Fade mask + expand button */}
        {filteredCerts.length > INITIAL_VISIBLE && (
          <div className="relative">
            {/* Gradient that fades over the last row when collapsed */}
            <AnimatePresence>
              {!expanded && (
                <motion.div
                  key="fade"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4 }}
                  className="absolute -top-52 inset-x-0 h-56 pointer-events-none z-10"
                  style={{ background: "linear-gradient(to bottom, transparent 0%, var(--color-void) 80%)" }}
                />
              )}
            </AnimatePresence>

            <div className="relative z-20 mt-2 flex flex-col items-center gap-3">
              <motion.button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                data-cursor-hover
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="inline-flex items-center gap-3 rounded-full border border-[var(--color-glass-border)] bg-[var(--color-glass-bg)] backdrop-blur-md px-6 py-3 font-mono text-xs font-bold uppercase tracking-widest text-[var(--color-silver)] hover:border-[var(--color-accent-primary)]/60 hover:text-[var(--color-starlight)] transition-colors duration-200"
              >
                <motion.span
                  animate={{ rotate: expanded ? 180 : 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 24 }}
                  className="inline-block"
                >
                  {expanded ? "↑" : "↓"}
                </motion.span>
                <AnimatePresence mode="wait">
                  <motion.span
                    key={expanded ? "less" : "more"}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.18 }}
                  >
                    {expanded ? "Collapse — show less" : `See all ${filteredCerts.length} credentials`}
                  </motion.span>
                </AnimatePresence>
              </motion.button>
              <AnimatePresence>
                {!expanded && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.2 }}
                    className="font-mono text-[10px] text-[var(--color-ash)]"
                  >
                    Showing {Math.min(INITIAL_VISIBLE, filteredCerts.length)} of {filteredCerts.length}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}

        {filteredCerts.length === 0 && (
          <div className="py-16 text-center glass rounded-3xl border border-[var(--color-glass-border)] p-8">
            <BookOpen size={32} className="mx-auto mb-3 text-[var(--color-ash)]" />
            <h4 className="font-display text-lg font-bold text-[var(--color-starlight)]">No matching certificates found</h4>
            <p className="font-body text-sm text-[var(--color-ash)] mt-1">Try clearing your search query or selecting another category.</p>
          </div>
        )}
      </div>

      {/* PORTAL MODAL — Mounted under document.body to prevent parent hover-focus-container blur */}
      {mounted &&
        typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {selectedCert && currentVariant && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                onClick={() => setSelectedCert(null)}
                className="fixed inset-0 z-[99999] flex items-start justify-center overflow-hidden px-4 py-6 bg-black/65 backdrop-blur-md select-none pointer-events-auto"
              >
                <motion.div
                  initial={{ scale: 0.92, opacity: 0, y: 16 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.92, opacity: 0, y: 16 }}
                  transition={{ type: "spring", stiffness: 360, damping: 30 }}
                  onClick={(e) => e.stopPropagation()}
                  role="dialog"
                  aria-modal="true"
                  aria-label={`${selectedCert.title} credential inspector`}
                  className="relative w-full max-w-6xl my-auto rounded-[1.75rem] p-4 sm:p-5 border border-white/10 shadow-[0_24px_80px_rgba(0,0,0,0.55)] text-white flex flex-col max-h-[calc(100svh-3rem)] overflow-hidden bg-[#0a0a0a] z-[100000]"
                >
                  {/* ── Header: identity only ──────────────────────
                      Priority order in this panel is deliberate:
                        title/issuer → actions → preview → extra info.
                      The two links used to sit UNDER a 42rem-tall preview,
                      i.e. a full screen of scrolling away on a phone, which
                      buried the one thing a recruiter opens this for. */}
                  <div className="flex items-start justify-between gap-4 pb-4 mb-4 border-b border-white/10">
                    <div className="min-w-0 pr-2">
                      <span className="font-mono text-[9px] uppercase tracking-widest text-amber-300 font-bold bg-amber-950/40 px-2.5 py-0.5 rounded-full border border-amber-500/25 inline-flex items-center gap-1 mb-2">
                        <CheckCircle2 size={10} />
                        AUTHENTICATED CREDENTIAL VAULT ({selectedCert.issueDate})
                      </span>
                      <h3 className="font-display text-xl sm:text-[1.75rem] font-bold text-slate-50 leading-tight max-w-3xl">
                        {selectedCert.title}
                      </h3>
                      <p className="font-mono text-[10px] uppercase tracking-widest text-slate-400 mt-1.5">
                        {currentVariant.name}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedCert(null)}
                      aria-label="Close inspector"
                      className="shrink-0 h-10 px-3 sm:px-4 rounded-full bg-white/10 hover:bg-white/15 flex items-center gap-2 text-white/80 hover:text-white transition-[background-color,color,transform] duration-150 ease-out cursor-pointer active:scale-[0.97] border border-white/10 font-mono text-[10px] font-bold uppercase tracking-widest"
                    >
                      <X size={16} />
                      <span className="hidden sm:inline">Close inspector</span>
                    </button>
                  </div>

                  {/* ── Actions: pinned above the scroll area ──────
                      Outside the scroll container on purpose, so they stay
                      reachable no matter how far down the preview is. */}
                  <div className="shrink-0 flex flex-col sm:flex-row items-stretch gap-2.5 pb-4 mb-4 border-b border-white/10">
                    <a
                      href={currentVariant.viewWebUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 inline-flex items-center justify-center gap-2.5 rounded-xl border border-white/15 bg-white/10 px-5 py-3.5 font-mono text-[12px] sm:text-[13px] font-bold uppercase tracking-wide text-white transition-[background-color,border-color,transform,box-shadow] duration-200 ease-out hover:bg-white/20 hover:border-white/25 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97]"
                    >
                      <Globe size={17} className="text-cyan-400 shrink-0" />
                      Visit certificate page
                    </a>
                    {currentVariant.credlyPublicUrl ? (
                      <a
                        href={currentVariant.credlyPublicUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 inline-flex items-center justify-center gap-2.5 rounded-xl border border-amber-400/40 bg-amber-400 px-5 py-3.5 font-mono text-[12px] sm:text-[13px] font-bold uppercase tracking-wide text-black shadow-[0_8px_24px_rgba(251,191,36,0.25)] transition-[background-color,border-color,transform,box-shadow] duration-200 ease-out hover:bg-amber-300 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(251,191,36,0.4)] active:translate-y-0 active:scale-[0.97]"
                      >
                        <BadgeCheck size={17} className="shrink-0" />
                        Verify on Credly
                      </a>
                    ) : (
                      <div className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-5 py-3.5 font-mono text-[11px] uppercase tracking-wide text-slate-500">
                        No Credly badge for this issuer
                      </div>
                    )}
                  </div>

                  {/* Issuer tabs — pinned ABOVE the scroll area, not inside it.
                      They used to live at the top of the scroll panel, so the
                      certificate cross-fade below changed the panel's scroll
                      height mid-animation and reflowed the tab bar. The
                      layoutId pill read that reflow as a move and jumped —
                      the "tab glitch". Pinning the tabs (like the action
                      buttons above) takes them out of any content-driven
                      reflow entirely, so the pill only ever animates between
                      stable tab positions. */}
                  {selectedCert.variants.length > 1 && (
                    <div className="shrink-0 px-1 pb-4 mb-4 border-b border-white/10">
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <span className="font-mono text-[10px] uppercase tracking-[0.32em] text-slate-400">
                          Issued by
                        </span>
                        <span className="font-mono text-[9px] uppercase tracking-wider text-cyan-300 bg-cyan-950/60 border border-cyan-500/40 px-2.5 py-1 rounded-full flex items-center gap-1 shrink-0">
                          <Layers size={10} />
                          {selectedCert.variants.length} issuers
                        </span>
                      </div>

                      {/* Notch-style animated pill tab switcher — spans full width, tabs share it evenly */}
                      <div className="relative flex items-end gap-1 rounded-full bg-white/[0.04] border border-white/10 p-1.5 pt-4 w-full">
                        {selectedCert.variants.map((variant) => {
                          const isTabActive = variant.id === currentVariant.id;
                          return (
                            <button
                              key={variant.id}
                              type="button"
                              onClick={() => setActiveVariantId(variant.id)}
                              className="relative z-10 flex-1 min-w-0 whitespace-nowrap px-3 sm:px-5 py-2.5 rounded-full font-mono text-[10px] sm:text-[11px] font-bold uppercase tracking-wider cursor-pointer"
                            >
                              {isTabActive && (
                                <motion.span
                                  layoutId="issuerTabPill"
                                  transition={TAB_SPRING}
                                  className="absolute inset-0 -top-3 rounded-t-2xl rounded-b-xl bg-[var(--color-accent-primary)] shadow-[0_10px_28px_rgba(67,97,238,0.5)]"
                                />
                              )}
                              <span
                                className={`relative block truncate transition-colors duration-200 ${
                                  isTabActive ? "text-white" : "text-slate-400 hover:text-slate-100"
                                }`}
                              >
                                {variant.name}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="scroll-panel flex-1 min-h-0 pr-1 space-y-4 pb-2">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={currentVariant.id}
                        initial={{ opacity: 0, transform: "translateY(6px)" }}
                        animate={{ opacity: 1, transform: "translateY(0px)" }}
                        exit={{ opacity: 0, transform: "translateY(-6px)" }}
                        transition={{ duration: 0.2, ease: EASING }}
                        className="rounded-3xl border border-white/10 bg-slate-950/70 p-3 sm:p-4 flex flex-col gap-3"
                      >
                        <span className="font-mono text-[10px] uppercase tracking-widest text-slate-400 block">
                          Certificate Preview
                        </span>

                        {/* Aspect-ratio box, not a 42rem min-height: a landscape
                            certificate in a 672px-tall frame left most of the
                            panel empty on phones and pushed everything else off
                            screen. `ScaledFrame` fills this exactly. */}
                        <div className="relative w-full aspect-[4/3] sm:aspect-[16/10] rounded-2xl border border-white/10 bg-black/20 overflow-hidden">
                          <ScaledFrame
                            src={currentVariant.viewWebUrl}
                            title={`${currentVariant.name} certificate preview`}
                          />
                        </div>

                        <p className="font-body text-sm text-slate-300 leading-relaxed">
                          {selectedCert.description}
                        </p>

                        <div className="flex flex-wrap gap-1.5">
                          {selectedCert.skills.map((skill) => (
                            <span
                              key={skill}
                              className="font-mono text-[9px] text-slate-300 bg-white/5 px-2 py-0.5 rounded-md border border-white/10"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </section>
  );
}
