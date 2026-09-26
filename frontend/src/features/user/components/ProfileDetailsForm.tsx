import { useForm } from '@tanstack/react-form';
import { MailIcon, PhoneIcon, UserIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import type { ApiUser } from '@/features/auth/types/auth.types';
import useUpdateProfile from '../hooks/useUpdateProfile';
import { updateProfileSchema } from '../schemas/profile.schema';

interface ProfileDetailsFormProps {
    user: ApiUser;
}

const ProfileDetailsForm = ({ user }: ProfileDetailsFormProps) => {
    const { updateProfile, isPending } = useUpdateProfile();
    const form = useForm({
        defaultValues: {
            username: user.username,
            phoneNumber: user.phoneNumber,
        },
        validators: {
            onBlur: updateProfileSchema,
            onSubmit: updateProfileSchema,
        },
        onSubmit: async ({ value }) => {
            const payload = updateProfileSchema.parse(value);

            updateProfile(payload, {
                onSuccess: updatedUser => {
                    form.reset({
                        username: updatedUser.username,
                        phoneNumber: updatedUser.phoneNumber,
                    });
                },
            });
        },
    });

    return (
        <form
            aria-label="Profile details"
            noValidate
            className="flex flex-col gap-5"
            onSubmit={event => {
                event.preventDefault();
                form.handleSubmit();
            }}
        >
            <FieldGroup className="gap-4">
                <Field className="gap-1.5">
                    <FieldLabel htmlFor="profile-email">Email address</FieldLabel>
                    <div className="relative">
                        <MailIcon
                            aria-hidden="true"
                            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
                        />
                        <Input
                            id="profile-email"
                            type="email"
                            value={user.email}
                            readOnly
                            aria-readonly="true"
                            className="h-10 border-slate-300 bg-slate-50 pl-9 text-slate-600"
                        />
                    </div>
                    <p className="text-xs text-slate-500">
                        Your current verified email address.
                    </p>
                </Field>

                <form.Field name="username">
                    {field => {
                        const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

                        return (
                            <Field className="gap-1.5" data-invalid={isInvalid}>
                                <FieldLabel htmlFor="profile-username">Username</FieldLabel>
                                <div className="relative">
                                    <UserIcon
                                        aria-hidden="true"
                                        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
                                    />
                                    <Input
                                        id="profile-username"
                                        name={field.name}
                                        type="text"
                                        autoComplete="username"
                                        required
                                        disabled={isPending}
                                        value={field.state.value}
                                        onBlur={field.handleBlur}
                                        onChange={event => field.handleChange(event.target.value)}
                                        aria-invalid={isInvalid}
                                        aria-describedby={isInvalid ? 'profile-username-error' : undefined}
                                        className="h-10 border-slate-300 pl-9"
                                    />
                                </div>
                                {isInvalid && (
                                    <FieldError
                                        id="profile-username-error"
                                        errors={field.state.meta.errors}
                                    />
                                )}
                            </Field>
                        );
                    }}
                </form.Field>

                <form.Field name="phoneNumber">
                    {field => {
                        const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;

                        return (
                            <Field className="gap-1.5" data-invalid={isInvalid}>
                                <FieldLabel htmlFor="profile-phone">Phone number</FieldLabel>
                                <div className="relative">
                                    <PhoneIcon
                                        aria-hidden="true"
                                        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
                                    />
                                    <Input
                                        id="profile-phone"
                                        name={field.name}
                                        type="tel"
                                        inputMode="tel"
                                        autoComplete="tel"
                                        required
                                        disabled={isPending}
                                        value={field.state.value}
                                        onBlur={field.handleBlur}
                                        onChange={event => field.handleChange(event.target.value)}
                                        aria-invalid={isInvalid}
                                        aria-describedby={`profile-phone-help${isInvalid ? ' profile-phone-error' : ''}`}
                                        className="h-10 border-slate-300 pl-9"
                                    />
                                </div>
                                <p id="profile-phone-help" className="text-xs text-slate-500">
                                    Singapore mobile number starting with 8 or 9.
                                </p>
                                {isInvalid && (
                                    <FieldError
                                        id="profile-phone-error"
                                        errors={field.state.meta.errors}
                                    />
                                )}
                            </Field>
                        );
                    }}
                </form.Field>
            </FieldGroup>

            <div className="flex justify-end">
                <Button
                    type="submit"
                    variant="indigo"
                    size="lg"
                    isLoading={isPending}
                >
                    Save changes
                </Button>
            </div>
        </form>
    );
};

export default ProfileDetailsForm;
