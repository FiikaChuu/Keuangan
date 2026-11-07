import { AnimatePresence, m, useIsPresent, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

export const sheetSpring = { type: 'spring', stiffness: 420, damping: 38, mass: 0.8 } as const;
export const revealTransition = { duration: 0.22, ease: [0.22, 1, 0.36, 1] } as const;

// Keep layout features out of the initial application bundle.
export const loadMotionFeatures = () =>
  import('./motion-features').then((module) => module.default);

function RevealContent({ children, id }: { children: ReactNode; id?: string }) {
  const reducedMotion = useReducedMotion();
  const isPresent = useIsPresent();
  return (
    <m.div
      id={id}
      className="animated-reveal"
      layout="position"
      initial={{ opacity: 0, y: reducedMotion ? 0 : -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: reducedMotion ? 0 : -8 }}
      transition={reducedMotion ? { duration: 0 } : revealTransition}
      inert={!isPresent}
      aria-hidden={!isPresent || undefined}
    >
      <m.fieldset
        className="reveal-content"
        disabled={!isPresent}
        initial={{ y: reducedMotion ? 0 : -8 }}
        animate={{ y: 0 }}
        exit={{ y: reducedMotion ? 0 : -8 }}
        transition={reducedMotion ? { duration: 0 } : revealTransition}
      >
        {children}
      </m.fieldset>
    </m.div>
  );
}

export function AnimatedReveal({
  open,
  children,
  id,
}: {
  open: boolean;
  children: ReactNode;
  id?: string;
}) {
  return (
    <AnimatePresence initial={false}>
      {open && <RevealContent id={id}>{children}</RevealContent>}
    </AnimatePresence>
  );
}
