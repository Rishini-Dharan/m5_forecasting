import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { API_BASE_URL } from '../config';

export default function SignupPage() {
    const navigate = useNavigate();

    const [formData, setFormData] = useState({ email: '', password: '', role: 'USER', store_id: '' });
    const [error, setError] = useState<string | null>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        try {
            const response = await fetch(`${API_BASE_URL}/auth/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (response.ok) {
                // Redirect to login page and show success msg
                navigate('/login', { state: { fromSignup: true } });
            } else {
                if (Array.isArray(data.detail)) {
                    setError(data.detail[0].msg || 'Validation Error');
                } else {
                    setError(data.detail || 'Signup failed');
                }
            }
        } catch (err: any) {
            setError(err.message || 'An error occurred');
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
                    <h2 className="font-display-lg text-[32px] font-bold text-on-surface mb-2">Create Account</h2>
                    <p className="font-body-md text-on-surface-variant">Join the M5 Forecasting Engine</p>
                </div>
                
                {error && (
                    <div className="mb-6 p-3 bg-error/10 border border-error/30 rounded-lg text-center text-error font-body-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSignup} className="flex flex-col gap-5">
                    <div className="flex flex-col gap-1.5">
                        <label className="font-label-caps text-[11px] tracking-widest text-on-surface-variant uppercase">Email Address</label>
                        <input 
                            type="email"
                            name="email" 
                            value={formData.email} 
                            onChange={handleChange} 
                            className="bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary-container transition-colors font-body-md w-full placeholder:text-white/20" 
                            placeholder="name@company.com"
                            required 
                            autoFocus
                        />
                    </div>
                    
                    <div className="flex flex-col gap-1.5">
                        <label className="font-label-caps text-[11px] tracking-widest text-on-surface-variant uppercase">Password</label>
                        <input 
                            type="password" 
                            name="password" 
                            value={formData.password} 
                            onChange={handleChange} 
                            className="bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary-container transition-colors font-body-md w-full"
                            placeholder="••••••••" 
                            required 
                        />
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="font-label-caps text-[11px] tracking-widest text-on-surface-variant uppercase">Role</label>
                        <select 
                            name="role" 
                            value={formData.role} 
                            onChange={handleChange} 
                            className="bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary-container transition-colors font-body-md w-full appearance-none" 
                            required
                        >
                            <option value="USER" className="bg-surface-dim">Standard User</option>
                            <option value="MANAGER" className="bg-surface-dim">Store Manager</option>
                            <option value="ADMIN" className="bg-surface-dim">Administrator</option>
                        </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                        <label className="font-label-caps text-[11px] tracking-widest text-on-surface-variant uppercase">Store ID (Optional)</label>
                        <input 
                            name="store_id" 
                            value={formData.store_id} 
                            onChange={handleChange} 
                            className="bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary-container transition-colors font-body-md w-full placeholder:text-white/20" 
                            placeholder="e.g. CA_1"
                        />
                    </div>
                    
                    <button type="submit" className="mt-4 w-full bg-primary-container text-[#050505] py-3.5 rounded-lg font-label-caps text-label-caps hover:bg-[#ffe088] transition-all duration-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]">
                        Create Account
                    </button>
                </form>

                <p className="text-center mt-8 text-on-surface-variant font-body-sm">
                    Already have an account? <Link to="/login" className="text-primary hover:text-[#ffe088] transition-colors font-semibold">Log In</Link>
                </p>
            </div>
        </div>
    );
}
