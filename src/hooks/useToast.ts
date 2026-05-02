import { useState } from 'react';

export interface Toast { m: string; t: string }

/**
 * Hook tres simple pour le systeme de toast notifications.
 * Extraite de useAppLogic dans le refactor E (split).
 */
export default function useToast() {
  var [tt, setTt] = useState<Toast | null>(null);
  function nf(m: string, t?: string): void {
    setTt({ m: String(m), t: t || "ok" });
    setTimeout(function () { setTt(null); }, 3e3);
  }
  return { tt: tt, nf: nf };
}
