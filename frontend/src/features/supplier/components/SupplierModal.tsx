import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface SupplierModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
}

const SupplierModal = ({
  open, onClose, title, children, icon
}: SupplierModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="indigo"
            className="flex items-center gap-2"
          >
            {icon}
            {title}
          </Button>
        }
      />

      <DialogContent className="w-full md:max-w-2xl! max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
};

export default SupplierModal;
