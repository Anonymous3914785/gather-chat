import { useEffect, useRef } from "react";
import { Pencil, Trash2 } from "lucide-react";

interface MessageContextMenuProps {
  x: number;
  y: number;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export function MessageContextMenu({
  x, y, canEdit, onEdit, onDelete, onClose,
}: MessageContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", handleClick, true);
    document.addEventListener("touchstart", handleClick as any, true);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick, true);
      document.removeEventListener("touchstart", handleClick as any, true);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  // Keep menu inside viewport
  const menuWidth = 160;
  const menuHeight = canEdit ? 88 : 48;
  const safeX = Math.min(x, window.innerWidth - menuWidth - 8);
  const safeY = Math.min(y, window.innerHeight - menuHeight - 8);

  return (
    <div
      ref={menuRef}
      style={{ position: "fixed", top: safeY, left: safeX, zIndex: 9999, width: menuWidth }}
      className="bg-popover border border-border rounded-xl shadow-xl py-1 animate-in fade-in zoom-in-95 duration-100 origin-top-left"
    >
      {canEdit && (
        <button
          onClick={() => { onEdit(); onClose(); }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-accent rounded-lg mx-auto transition-colors"
        >
          <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
          Edit message
        </button>
      )}
      <button
        onClick={() => { onDelete(); onClose(); }}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-lg mx-auto transition-colors"
      >
        <Trash2 className="w-3.5 h-3.5" />
        Delete message
      </button>
    </div>
  );
}
