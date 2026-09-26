import { UserRoundIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import ProfileDetailsForm from '@/features/user/components/ProfileDetailsForm';
import useProfile from '@/features/user/hooks/useProfile';

const ProfilePage = () => {
    const { data: user, isPending, isError, error, refetch } = useProfile();

    return (
        <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-5 py-8 md:px-10 md:py-10">
            <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-full bg-indigo-100 text-indigo-900">
                    <UserRoundIcon className="size-5" aria-hidden="true" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">My profile</h1>
                    <p className="text-sm text-slate-600">
                        View and update your account details.
                    </p>
                </div>
            </div>

            <Card className="bg-white">
                <CardHeader className="border-b border-slate-200 pb-4">
                    <CardTitle className="text-lg text-slate-900">Personal information</CardTitle>
                    <CardDescription>
                        Your username and phone number are visible only where needed in Aaron.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isPending && (
                        <div className="flex min-h-48 items-center justify-center gap-2 text-slate-600">
                            <Spinner />
                            <span>Loading profile…</span>
                        </div>
                    )}

                    {isError && !user && (
                        <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-center">
                            <p className="font-medium text-slate-900">Unable to load your profile</p>
                            <p className="max-w-md text-sm text-slate-600">{error.message}</p>
                            <Button variant="outline" onClick={() => void refetch()}>
                                Try again
                            </Button>
                        </div>
                    )}

                    {user && <ProfileDetailsForm user={user} />}
                </CardContent>
            </Card>
        </main>
    );
};

export default ProfilePage;
