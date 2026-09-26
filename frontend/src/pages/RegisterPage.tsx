import { useState } from 'react';
import Logo from '@/assets/logo.png';
import { Card } from '@/components/ui/card';
import RegisterForm from '@/features/auth/components/RegisterForm';
import RegistrationOtpForm from '@/features/auth/components/RegistrationOtpForm';
import type { PendingRegistrationChallenge } from '@/features/auth/types/auth.types';

const RegisterPage = () => {
    const [pendingRegistration, setPendingRegistration] = useState<PendingRegistrationChallenge | null>(null);

    return (
        <main className="flex min-h-screen flex-col items-center justify-center gap-5 px-4 py-10">
            <h1 className="sr-only">Create an Aaron account</h1>
            <div className="flex items-center gap-2" aria-hidden="true">
                <img src={Logo} alt="" />
                <p className="text-2xl font-bold text-indigo-900">Aaron</p>
            </div>
            <Card className="w-full max-w-sm rounded-2xl p-6!">
                {pendingRegistration ? (
                    <RegistrationOtpForm email={pendingRegistration.email} />
                ) : (
                    <RegisterForm onRegistrationStarted={setPendingRegistration} />
                )}
            </Card>
        </main>
    );
};

export default RegisterPage;
