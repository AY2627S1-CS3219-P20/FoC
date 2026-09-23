import { useEffect } from "react";
import { XIcon } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";

interface SupplierModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}

const SupplierModal = ({ open, onClose, title, children, className }: SupplierModalProps) => {
  useEffect(() => {
    if (!open) return;

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 z-50 bg-black/10" aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "relative z-50 max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-card text-card-foreground shadow-md ring-1 ring-foreground/10 [--card-spacing:--spacing(4)]",
          className,
        )}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-base leading-snug font-medium">{title}</h2>
          <Button type="button" variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
            <XIcon />
          </Button>
        </div>
        <div className="px-4 py-4">{children}</div>
      </div>
    </div>
  );
};

export default SupplierModal;
