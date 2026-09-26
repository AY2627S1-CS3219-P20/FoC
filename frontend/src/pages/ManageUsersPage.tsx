import { type FormEvent, useState } from 'react';
import { SearchIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { ROLES, type Role } from '@/features/auth/types/auth.types';
import useAdminUsers from '@/features/user/hooks/useAdminUsers';

const PAGE_SIZE = 20;

const ManageUsersPage = () => {
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [role, setRole] = useState<Role | ''>('');
    const [page, setPage] = useState(1);

    const usersQuery = useAdminUsers({
        search: search || undefined,
        role: role || undefined,
        page,
        pageSize: PAGE_SIZE,
    });

    const users = usersQuery.data?.users ?? [];
    const total = usersQuery.data?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    const handleSearch = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setSearch(searchInput.trim());
        setPage(1);
    };

    const clearSearch = () => {
        setSearchInput('');
        setSearch('');
        setPage(1);
    };

    return (
        <main className="px-5 py-5 md:px-10 md:py-8">
            <div className="mb-6 flex flex-col gap-1">
                <h1 className="text-xl md:text-2xl font-bold">Manage Users</h1>
                <p className="text-sm text-muted-foreground">
                    Search and review registered user accounts.
                </p>
            </div>

            <section className="rounded-xl bg-card p-4 shadow-md ring-1 ring-foreground/10 md:p-6">
                <form
                    className="mb-5 flex flex-col gap-4 md:flex-row md:items-end"
                    onSubmit={handleSearch}
                >
                    <div className="flex flex-1 flex-col gap-2">
                        <Label htmlFor="user-search">Search users</Label>
                        <div className="flex gap-2">
                            <Input
                                id="user-search"
                                type="search"
                                placeholder="Search by username or email"
                                value={searchInput}
                                onChange={event => setSearchInput(event.target.value)}
                            />
                            <Button type="submit" variant="indigo">
                                <SearchIcon />
                                Search
                            </Button>
                            {(searchInput || search) && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={clearSearch}
                                    aria-label="Clear search"
                                >
                                    <XIcon />
                                </Button>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col gap-2 md:w-48">
                        <Label htmlFor="role-filter">Role</Label>
                        <select
                            id="role-filter"
                            className="h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                            value={role}
                            onChange={event => {
                                setRole(event.target.value as Role | '');
                                setPage(1);
                            }}
                        >
                            <option value="">All roles</option>
                            <option value={ROLES.STUDENT}>Student</option>
                            <option value={ROLES.ADMIN}>Admin</option>
                        </select>
                    </div>
                </form>

                {usersQuery.isLoading && (
                    <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                        <Spinner />
                        Loading users...
                    </div>
                )}

                {usersQuery.isError && (
                    <div className="flex flex-col items-center gap-3 py-12 text-center">
                        <p className="text-sm text-destructive">
                            {usersQuery.error.message}
                        </p>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => void usersQuery.refetch()}
                        >
                            Try again
                        </Button>
                    </div>
                )}

                {!usersQuery.isLoading && !usersQuery.isError && users.length === 0 && (
                    <p className="py-12 text-center text-sm text-muted-foreground">
                        {search || role
                            ? 'No users match the current search and filter.'
                            : 'No user accounts found.'}
                    </p>
                )}

                {!usersQuery.isLoading && !usersQuery.isError && users.length > 0 && (
                    <>
                        <div className="overflow-x-auto rounded-lg border">
                            <table className="w-full min-w-3xl text-left text-sm">
                                <thead className="bg-muted/60 text-muted-foreground">
                                    <tr>
                                        <th className="px-4 py-3 font-medium">Username</th>
                                        <th className="px-4 py-3 font-medium">Email</th>
                                        <th className="px-4 py-3 font-medium">Phone number</th>
                                        <th className="px-4 py-3 font-medium">Role</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {users.map(user => (
                                        <tr key={user.id} className="bg-card">
                                            <td className="px-4 py-3 font-medium">{user.username}</td>
                                            <td className="px-4 py-3">{user.email}</td>
                                            <td className="px-4 py-3">{user.phoneNumber}</td>
                                            <td className="px-4 py-3">
                                                <span
                                                    className={
                                                        user.role === ROLES.ADMIN
                                                            ? 'rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-medium text-indigo-800'
                                                            : 'rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700'
                                                    }
                                                >
                                                    {user.role === ROLES.ADMIN ? 'Admin' : 'Student'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="mt-5 flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                            <p>
                                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
                            </p>
                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={page === 1}
                                    onClick={() => setPage(current => current - 1)}
                                >
                                    Previous
                                </Button>
                                <span className="px-2 text-foreground">
                                    Page {page} of {totalPages}
                                </span>
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={page >= totalPages}
                                    onClick={() => setPage(current => current + 1)}
                                >
                                    Next
                                </Button>
                            </div>
                        </div>
                    </>
                )}
            </section>
        </main>
    );
};

export default ManageUsersPage;
