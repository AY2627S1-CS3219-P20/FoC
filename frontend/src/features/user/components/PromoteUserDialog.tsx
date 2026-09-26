import { useEffect } from 'react';
import { ShieldCheckIcon, XIcon } from 'lucide-react';
import type { ApiUser } from '@/features/auth/types/auth.types';
import { Button } from '@/components/ui/button';

interface PromoteUserDialogProps {
    user: ApiUser;
    isPending: boolean;
    onConfirm: () => void;
    onClose: () => void;
}

const PromoteUserDialog = ({
    user,
    isPending,
    onConfirm,
    onClose,
}: PromoteUserDialogProps) => {
    useEffect(() => {
        const handleKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !isPending) onClose();
        };

        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [isPending, onClose]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/20" aria-hidden="true" />
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="promote-user-title"
                className="relative z-10 w-full max-w-md rounded-xl bg-card shadow-xl ring-1 ring-foreground/10"
            >
                <div className="flex items-center justify-between border-b px-4 py-3">
                    <h2 id="promote-user-title" className="font-medium">
                        Make user an admin
                    </h2>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={isPending}
                        onClick={onClose}
                        aria-label="Close"
                    >
                        <XIcon />
                    </Button>
                </div>

                <div className="flex flex-col gap-5 p-4">
                    <div className="flex items-start gap-3">
                        <div className="grid size-9 shrink-0 place-items-center rounded-full bg-indigo-100">
                            <ShieldCheckIcon className="size-4 text-indigo-800" />
                        </div>
                        <div className="flex flex-col gap-1">
                            <p className="text-sm">
                                Promote <span className="font-medium">{user.username}</span> to admin?
                            </p>
                            <p className="text-sm text-muted-foreground">
                                This will give {user.email} access to administrator functions.
                            </p>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            disabled={isPending}
                            onClick={onClose}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            variant="indigo"
                            isLoading={isPending}
                            onClick={onConfirm}
                        >
                            Make admin
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PromoteUserDialog;
