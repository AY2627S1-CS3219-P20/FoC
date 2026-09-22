import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import queryClient from '@/lib/queryClient';
import { AuthProvider } from "@/context/AuthContext";
import LoginPage from '@/pages/LoginPage';
import SupplierPage from '@/pages/SupplierPage';
import ProtectedRoute from '@/components/layout/ProtectedRoute';
import AppLayout from '@/components/layout/AppLayout';
import HomePage from '@/pages/HomePage';

const AppRouter = () => {
    return (
        <BrowserRouter>
            <QueryClientProvider client={queryClient}>
                <AuthProvider>
                    <Routes>
                        <Route path="/" element={<LoginPage />} />

                        {/* Protected routes - redirect to login page if not authenticated */}
                        <Route element={<ProtectedRoute />}>
                            <Route element={<AppLayout />}>
                                <Route path="/home" element={<HomePage />} />
                                <Route path="/suppliers" element={<SupplierPage />} />
                                <Route path="/suppliers/all" element={<SupplierPage />} />
                            </Route>
                        </Route>
                    </Routes>
                </AuthProvider>
            </QueryClientProvider>
        </BrowserRouter>
    );
}

export default AppRouter;
