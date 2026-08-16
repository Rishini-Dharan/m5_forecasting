import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { API_BASE_URL } from '../config';

export default function LoginPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const fromSignup = location.state?.fromSignup;

    const [formData, setFormData] = useState({ email: '', password: '' });
    const [message, setMessage] = useState<string | null>(fromSignup ? "Account created! Please log in." : null);
    const [error, setError] = useState<string | null>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setMessage(null);

        try {
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const data = await response.json();
            
            if (response.ok) {
                localStorage.setItem('jwt', data.access_token);
                localStorage.setItem('user_role', data.role);
                navigate('/dashboard');
            } else {
                if (Array.isArray(data.detail)) {
                    setError(data.detail[0].msg || 'Validation Error');
                } else {
                    setError(data.detail || 'Login failed');
                }
            }
        } catch (err: any) {
            setError(err.message || 'An error occurred');
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '24px'
        }}>
            
            <div className="glass-panel animate-fade-in" style={{
                padding: '40px',
                width: '100%',
                maxWidth: '440px'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <h2 style={{ margin: '0 0 8px 0' }}>Welcome Back</h2>
                    <p style={{ color: 'var(--text-secondary)' }}>Sign in to M5 Forecasting Engine</p>
                </div>
                
                {message && (
                    <div style={{ 
                        padding: '12px 16px', 
                        backgroundColor: 'rgba(50, 200, 100, 0.1)', 
                        color: '#4ade80', 
                        borderRadius: 'var(--radius-sm)', 
                        border: '1px solid rgba(50, 200, 100, 0.3)',
                        marginBottom: '24px',
                        fontSize: '14px',
                        textAlign: 'center'
                    }}>
                        {message}
                    </div>
                )}
                {error && (
                    <div style={{ 
                        padding: '12px 16px', 
                        backgroundColor: 'rgba(255, 107, 107, 0.1)', 
                        color: '#ff6b6b', 
                        borderRadius: 'var(--radius-sm)', 
                        border: '1px solid rgba(255, 107, 107, 0.3)',
                        marginBottom: '24px',
                        fontSize: '14px',
                        textAlign: 'center'
                    }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div>
                        <label className="input-label">Email</label>
                        <input 
                            type="email"
                            name="email" 
                            value={formData.email} 
                            onChange={handleChange} 
                            className="input-field" 
                            required 
                            autoFocus
                        />
                    </div>
                    
                    <div>
                        <label className="input-label">Password</label>
                        <input 
                            type="password" 
                            name="password" 
                            value={formData.password} 
                            onChange={handleChange} 
                            className="input-field" 
                            required 
                        />
                    </div>
                    
                    <button type="submit" className="btn-primary" style={{ marginTop: '8px' }}>
                        Login →
                    </button>
                </form>

                <p style={{ 
                    textAlign: 'center', 
                    marginTop: '24px', 
                    color: 'var(--text-secondary)',
                    fontSize: '14px'
                }}>
                    Don't have an account? <Link to="/signup" style={{ color: 'var(--accent-gold)', textDecoration: 'none', fontWeight: '500' }}>Sign Up</Link>
                </p>
            </div>
        </div>
    );
}
