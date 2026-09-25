import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import queryClient from '@/lib/queryClient';
import { AuthProvider } from "@/context/AuthContext";
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import SupplierPage from '@/pages/SupplierPage';
import ProtectedRoute from '@/routes/ProtectedRoute';
import AppLayout from '@/components/layout/AppLayout';
import HomePage from '@/pages/HomePage';
import { ROLES } from '@/features/auth/types/auth.types';
import { ROUTES } from './routes';
import ManageSuppliersPage from '@/pages/ManageSuppliersPage';
import ManageUsersPage from '@/pages/ManageUsersPage';
import RoleRoute from '@/routes/RoleRoute';
import ManageSupplierTypesPage from '@/pages/ManageSupplierTypesPage';

const AppRouter = () => {
    return (
        <BrowserRouter>
            <QueryClientProvider client={queryClient}>
                <AuthProvider>
                    <Routes>
                        <Route path={ROUTES.LOGIN} element={<LoginPage />} />
                        <Route path={ROUTES.REGISTER} element={<RegisterPage />} />

                        {/* Protected routes - redirect to login page if not authenticated */}
                        <Route element={<ProtectedRoute />}>
                            <Route element={<AppLayout />}>
                                <Route element={<RoleRoute allowedRoles={[ROLES.STUDENT, ROLES.ADMIN]} />}>
                                    <Route path={ROUTES.HOME} element={<HomePage />} />
                                    <Route path={ROUTES.SUPPLIERS} element={<SupplierPage />} />
                                </Route>

                                <Route element={<RoleRoute allowedRoles={[ROLES.ADMIN]} />}>
                                    <Route path={ROUTES.ADMIN.MANAGE_USERS} element={<ManageUsersPage />} />
                                    <Route path={ROUTES.ADMIN.MANAGE_SUPPLIERS} element={<ManageSuppliersPage />} />
                                    <Route path={ROUTES.ADMIN.MANAGE_SUPPLIER_TYPES} element={<ManageSupplierTypesPage />} />
                                </Route>
                            </Route>
                        </Route>
                    </Routes>
                </AuthProvider>
            </QueryClientProvider>
        </BrowserRouter>
    );
}

export default AppRouter;
