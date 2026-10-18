import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "lucide-react";
import CreateRequestForm from "@/features/order/components/CreateRequestForm";
import { useState } from "react";

const CreateRequestDialog = () => {
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger
                render={
                    <Button
                        type="button"
                        variant="indigo"
                        className="flex items-center gap-2"
                    >
                        <PlusIcon className="stroke-3" />
                        Create Request
                    </Button>
                }
            />

            <DialogContent className="w-full md:max-w-xl! max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Create Request</DialogTitle>
                </DialogHeader>

                <CreateRequestForm onCancel={() => setOpen(false)} />
            </DialogContent>
        </Dialog>
    );
};

export default CreateRequestDialog;