import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import queryClient from '@/lib/queryClient';
import { AuthProvider } from "@/context/AuthContext";
import LoginPage from '@/pages/LoginPage';

const AppRouter = () => {
    return (
        <BrowserRouter>
            <QueryClientProvider client={queryClient}>
                <AuthProvider>
                    <Routes>
                        <Route
                            path="/"
                            element={<LoginPage />}
                        />
                    </Routes>
                </AuthProvider>
            </QueryClientProvider>
        </BrowserRouter>
    );
}

export default AppRouter;
