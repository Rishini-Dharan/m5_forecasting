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
                    <h2 style={{ margin: '0 0 8px 0' }}>Create Account</h2>
                    <p style={{ color: 'var(--text-secondary)' }}>Join the M5 Forecasting Engine</p>
                </div>
                
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

                <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div>
                        <label className="input-label">Email Address</label>
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

                    <div>
                        <label className="input-label">Role</label>
                        <select 
                            name="role" 
                            value={formData.role} 
                            onChange={handleChange} 
                            className="input-field" 
                            required
                        >
                            <option value="USER">Standard User</option>
                            <option value="MANAGER">Store Manager</option>
                            <option value="ADMIN">Administrator</option>
                        </select>
                    </div>

                    <div>
                        <label className="input-label">Store ID (Optional)</label>
                        <input 
                            name="store_id" 
                            value={formData.store_id} 
                            onChange={handleChange} 
                            className="input-field" 
                            placeholder="e.g. CA_1"
                        />
                    </div>
                    
                    <button type="submit" className="btn-primary" style={{ marginTop: '8px' }}>
                        Create Account →
                    </button>
                </form>

                <p style={{ 
                    textAlign: 'center', 
                    marginTop: '24px', 
                    color: 'var(--text-secondary)',
                    fontSize: '14px'
                }}>
                    Already have an account? <Link to="/login" style={{ color: 'var(--accent-gold)', textDecoration: 'none', fontWeight: '500' }}>Log In</Link>
                </p>
            </div>
        </div>
    );
}
