import clsx from "clsx";
import { CircleCheck, Info, TriangleAlert, X } from "lucide-react";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type ToastKind = "success" | "error" | "info";
interface Toast {
  id: number;
  kind: ToastKind;
  message: ReactNode;
}

const Ctx = createContext<(kind: ToastKind, message: ReactNode) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((kind: ToastKind, message: ReactNode) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 7000 : 3500);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 z-[2000] flex flex-col gap-2 w-[min(380px,calc(100vw-2rem))]">
        {toasts.map((t) => (
          <div key={t.id} className="card shadow-lg px-4 py-3 flex items-start gap-2.5 text-sm">
            {t.kind === "success" ? (
              <CircleCheck className="h-4 w-4 text-good mt-0.5 shrink-0" />
            ) : t.kind === "error" ? (
              <TriangleAlert className="h-4 w-4 text-bad mt-0.5 shrink-0" />
            ) : (
              <Info className="h-4 w-4 text-brand mt-0.5 shrink-0" />
            )}
            <div className={clsx("flex-1 break-words", t.kind === "error" && "text-ink")}>{t.message}</div>
            <button className="text-muted hover:text-ink" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}>
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const push = useContext(Ctx);
  return {
    success: (m: ReactNode) => push("success", m),
    error: (e: unknown) => push("error", e instanceof Error ? e.message : String(e)),
    info: (m: ReactNode) => push("info", m),
  };
}
