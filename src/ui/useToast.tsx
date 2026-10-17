import { useCallback, useEffect, useRef, useState } from 'react';

export interface ToastAction {
  label: string;
  run: () => void;
}

export interface ToastMessage {
  text: string;
  action?: ToastAction;
}

const PLAIN_MS = 4500;
/** A toast with a button stays longer, so there's time to read it and decide. */
const WITH_ACTION_MS = 9000;

export function useToast() {
  const [toast, setToast] = useState<ToastMessage>();
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const dismiss = useCallback(() => {
    clearTimeout(timer.current);
    setToast(undefined);
  }, []);

  const show = useCallback((message: ToastMessage) => {
    clearTimeout(timer.current);
    setToast(message);
    timer.current = setTimeout(() => setToast(undefined), message.action ? WITH_ACTION_MS : PLAIN_MS);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return { toast, show, dismiss };
}

export function Toast({ toast, onDismiss }: { toast?: ToastMessage; onDismiss: () => void }) {
  if (!toast) return null;
  return (
    <div className="toast" role="status">
      <span>{toast.text}</span>
      {toast.action && (
        <button
          onClick={() => {
            onDismiss();
            toast.action!.run();
          }}
        >
          {toast.action.label}
        </button>
      )}
      <button onClick={onDismiss} aria-label="Dismiss">✕</button>
    </div>
  );
}
