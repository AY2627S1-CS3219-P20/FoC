import { useForm } from '@tanstack/react-form';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { ROUTES } from '@/routes/routes';
import { registrationOtpSchema } from '../schemas/register.schema';
import useVerifyRegistration from '../hooks/useVerifyRegistration';

interface RegistrationOtpFormProps {
    challengeId: string;
    email: string;
}

const RegistrationOtpForm = ({ challengeId, email }: RegistrationOtpFormProps) => {
    const { verifyRegistration, isPending } = useVerifyRegistration();
    const form = useForm({
        defaultValues: { otp: '' },
        validators: {
            onBlur: registrationOtpSchema,
            onSubmit: registrationOtpSchema,
        },
        onSubmit: async ({ value }) => {
            const { otp } = registrationOtpSchema.parse(value);
            verifyRegistration({ challengeId, otp });
        },
    });

    return (
        <form
            aria-label="Verify your email"
            noValidate
            className="flex flex-col gap-4"
            onSubmit={event => {
                event.preventDefault();
                form.handleSubmit();
            }}
        >
            <div className="space-y-2 text-center">
                <h2 className="text-lg font-semibold text-indigo-900">Verify your email</h2>
                <p className="text-sm text-slate-600">
                    Enter the 6-digit code sent to <span className="font-medium">{email}</span>.
                </p>
            </div>
            <form.Field name="otp">
                {field => {
                    const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
                    return (
                        <Field data-invalid={isInvalid}>
                            <FieldLabel htmlFor="registration-otp">Verification Code</FieldLabel>
                            <Input
                                id="registration-otp"
                                name={field.name}
                                type="text"
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                maxLength={6}
                                required
                                value={field.state.value}
                                onBlur={field.handleBlur}
                                onChange={event => field.handleChange(event.target.value)}
                                aria-invalid={isInvalid}
                                aria-describedby={`otp-expiry${isInvalid ? ' registration-otp-error' : ''}`}
                                placeholder="123456"
                                className="h-9 border-slate-300 text-center tracking-widest"
                            />
                            {isInvalid && <FieldError id="registration-otp-error" errors={field.state.meta.errors} />}
                        </Field>
                    );
                }}
            </form.Field>
            <p id="otp-expiry" className="text-center text-sm text-slate-600">
                Codes expire after 10 minutes.
            </p>
            <div className="flex flex-col items-center gap-3">
                <Button
                    type="submit"
                    variant="indigo"
                    size="lg"
                    isLoading={isPending}
                >
                    Verify Email
                </Button>
                <Button type="button" variant="linkIndigo" disabled>
                    Resend code
                </Button>
            </div>
            <Link to={ROUTES.LOGIN} className="text-center text-sm text-slate-600 underline hover:text-indigo-500">
                Back to login
            </Link>
        </form>
    );
};

export default RegistrationOtpForm;
