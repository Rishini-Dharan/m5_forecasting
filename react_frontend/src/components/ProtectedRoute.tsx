import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';

export default function ProtectedRoute({ children }: { children?: React.ReactNode }) {
    const token = localStorage.getItem('jwt');
    
    if (!token) {
        // If there is no token, redirect immediately to login
        return <Navigate to="/login" replace />;
    }
    
    // If authenticated, render the child routes
    return children ? <>{children}</> : <Outlet />;
}
