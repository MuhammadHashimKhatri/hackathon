"use client";

import { useEffect, useRef } from "react";

// Keeps a native <dialog> in sync with a controlled `open` prop.
// Native showModal() gives focus trapping, Esc to close and the top layer for free.
export default function useDialogElement(open, onClose) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const dialogProps = {
    ref,
    onClose: () => onClose?.(),
    // A click whose target is the <dialog> itself landed on the backdrop.
    onClick: (e) => {
      if (e.target === ref.current) onClose?.();
    },
  };

  return dialogProps;
}
