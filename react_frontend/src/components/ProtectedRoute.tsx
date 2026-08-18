import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';

export default function ProtectedRoute({ children }: { children?: React.ReactNode }) {
    const token = localStorage.getItem('jwt');

    if (!token) {
        return <Navigate to="/login" replace />;
    }

    return children ? <>{children}</> : <Outlet />;
}

