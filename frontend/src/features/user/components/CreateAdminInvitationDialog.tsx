import { useEffect } from 'react';
import { useForm } from '@tanstack/react-form';
import { MailPlusIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
    createAdminInvitationSchema,
    type CreateAdminInvitationPayload,
} from '../schemas/admin-invitation.schema';

interface CreateAdminInvitationDialogProps {
    isPending: boolean;
    onSubmit: (payload: CreateAdminInvitationPayload) => void;
    onClose: () => void;
}

const CreateAdminInvitationDialog = ({
    isPending,
    onSubmit,
    onClose,
}: CreateAdminInvitationDialogProps) => {
    const form = useForm({
        defaultValues: { email: '' },
        validators: {
            onBlur: createAdminInvitationSchema,
            onSubmit: createAdminInvitationSchema,
        },
        onSubmit: async ({ value }) => {
            onSubmit(createAdminInvitationSchema.parse(value));
        },
    });

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
                aria-labelledby="create-admin-title"
                aria-describedby="create-admin-description"
                className="relative z-10 w-full max-w-md rounded-xl bg-card shadow-xl ring-1 ring-foreground/10"
            >
                <div className="flex items-center justify-between border-b px-4 py-3">
                    <h2 id="create-admin-title" className="font-medium">
                        Create administrator
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

                <form
                    noValidate
                    className="flex flex-col gap-5 p-4"
                    onSubmit={event => {
                        event.preventDefault();
                        form.handleSubmit();
                    }}
                >
                    <div className="flex items-start gap-3">
                        <div className="grid size-9 shrink-0 place-items-center rounded-full bg-indigo-100">
                            <MailPlusIcon className="size-4 text-indigo-800" />
                        </div>
                        <p id="create-admin-description" className="text-sm text-muted-foreground">
                            An activation link will be emailed to the new administrator.
                            <br />
                            Submit the same email again to send a replacement link.
                        </p>
                    </div>

                    <form.Field name="email">
                        {field => {
                            const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

                            return (
                                <Field className="gap-1.5" data-invalid={isInvalid}>
                                    <FieldLabel htmlFor="admin-invitation-email">
                                        Email address
                                    </FieldLabel>
                                    <Input
                                        id="admin-invitation-email"
                                        name={field.name}
                                        type="email"
                                        autoComplete="email"
                                        autoCapitalize="none"
                                        spellCheck={false}
                                        required
                                        autoFocus
                                        disabled={isPending}
                                        value={field.state.value}
                                        onBlur={field.handleBlur}
                                        onChange={event => field.handleChange(event.target.value)}
                                        aria-invalid={isInvalid}
                                        aria-describedby={isInvalid ? 'admin-invitation-email-error' : undefined}
                                        placeholder="admin@example.com"
                                        className="h-10 border-slate-300"
                                    />
                                    {isInvalid && (
                                        <FieldError
                                            id="admin-invitation-email-error"
                                            errors={field.state.meta.errors}
                                        />
                                    )}
                                </Field>
                            );
                        }}
                    </form.Field>

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
                            type="submit"
                            variant="indigo"
                            isLoading={isPending}
                        >
                            Send invitation
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateAdminInvitationDialog;
