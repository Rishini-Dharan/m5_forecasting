import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { ENDPOINTS } from '../config';
import { extractErrorMessage, toMessage } from '../lib/api';

export default function LoginPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const fromSignup = location.state?.fromSignup;

    const [formData, setFormData] = useState({ email: '', password: '' });
    const [message, setMessage] = useState<string | null>(fromSignup ? "Account created! Please log in." : null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setMessage(null);
        setLoading(true);

        try {
            const response = await fetch(ENDPOINTS.auth.login, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const data = await response.json();
            
            if (response.ok) {
                localStorage.setItem('jwt', data.access_token);
                localStorage.setItem('user_role', data.role);
                localStorage.setItem('store_id', data.store_id || '');
                
                if (data.role === 'STORE_OWNER' && data.store_id) {
                    navigate(`/dashboard/store/${data.store_id}`);
                } else {
                    navigate('/dashboard');
                }
            } else {
                setError(extractErrorMessage(data, 'Login failed'));
            }
        } catch (err: unknown) {
            setError(toMessage(err, 'An error occurred'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col justify-center items-center p-6 bg-background text-on-surface font-body-md relative overflow-hidden">
            {/* Subtle background glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary-container/5 rounded-full blur-[100px] pointer-events-none"></div>

            {/* Back link */}
            <div className="absolute top-8 left-8">
                <Link to="/" className="text-on-surface-variant hover:text-primary transition-colors font-label-caps text-label-caps flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                    Back to Home
                </Link>
            </div>

            <div className="relative z-10 bg-surface-dim/70 backdrop-blur-xl border border-[rgba(212,175,55,0.15)] rounded-2xl p-8 sm:p-12 w-full max-w-[440px] shadow-[0_8px_32px_rgba(0,0,0,0.4)] fade-up-enter fade-up-enter-active">
                <div className="text-center mb-8">
                    <h2 className="font-display-lg text-[32px] font-bold text-on-surface mb-2">Welcome Back</h2>
                    <p className="font-body-md text-on-surface-variant">Sign in to M5 Forecasting Engine</p>
                </div>
                
                {message && (
                    <div role="status" className="mb-6 p-3 bg-[#4ade80]/10 border border-[#4ade80]/30 rounded-lg text-center text-[#4ade80] font-body-sm">
                        {message}
                    </div>
                )}
                {error && (
                    <div role="alert" className="mb-6 p-3 bg-[#ef4444]/10 border border-[#ef4444]/30 rounded-lg text-center text-[#ef4444] font-body-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin} className="flex flex-col gap-5">
                    <div className="flex flex-col gap-1.5">
                        <label className="font-label-caps text-[11px] tracking-widest text-on-surface-variant uppercase" htmlFor="email">EMAIL</label>
                        <input 
                            type="email"
                            id="email"
                            name="email"
                            autoComplete="email" 
                            value={formData.email} 
                            onChange={handleChange} 
                            className="bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary-container transition-colors font-body-md w-full placeholder:text-white/20" 
                            placeholder="name@company.com"
                            required 
                            autoFocus
                        />
                    </div>
                    
                    <div className="flex flex-col gap-1.5">
                        <label className="font-label-caps text-[11px] tracking-widest text-on-surface-variant uppercase" htmlFor="password">PASSWORD</label>
                        <input 
                            type="password"
                            id="password"
                            name="password"
                            autoComplete="current-password" 
                            value={formData.password} 
                            onChange={handleChange} 
                            className="bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary-container transition-colors font-body-md w-full" 
                            placeholder="••••••••"
                            required 
                        />
                    </div>
                    
                    <button 
                        type="submit" 
                        disabled={loading}
                        className="mt-4 w-full bg-primary-container text-[#050505] py-3.5 rounded-lg font-label-caps text-label-caps hover:bg-[#ffe088] transition-all duration-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.3)] disabled:opacity-50"
                    >
                        {loading ? 'Signing in...' : 'Log In'}
                    </button>
                </form>

                <p className="text-center mt-8 text-on-surface-variant font-body-sm">
                    Access restricted to authorized personnel.
                </p>
            </div>
        </div>
    );
}