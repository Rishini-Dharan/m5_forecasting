import React, { useState, useEffect } from 'react';
import { ENDPOINTS } from '../config';
import { extractErrorMessage, toMessage } from '../lib/api';

interface User {
    id: number;
    email: string;
    role: string;
    store_id: string | null;
    created_at: string;
}

export default function AdminPanel() {
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        role: 'STORE_OWNER',
        store_id: ''
    });
    
    const [status, setStatus] = useState<{type: 'error' | 'success', msg: string} | null>(null);
    const [loading, setLoading] = useState(false);
    const [users, setUsers] = useState<User[]>([]);
    const [usersLoading, setUsersLoading] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus(null);
        setLoading(true);

        const token = localStorage.getItem('jwt');

        try {
            const response = await fetch(ENDPOINTS.auth.createUser, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (response.ok) {
                setStatus({ type: 'success', msg: data.message || 'User created successfully!' });
                setFormData({ email: '', password: '', role: 'STORE_OWNER', store_id: '' });
            } else {
                setStatus({ type: 'error', msg: extractErrorMessage(data, 'Failed to create user.') });
            }
        } catch (err: unknown) {
            setStatus({ type: 'error', msg: toMessage(err, 'An error occurred.') });
        } finally {
            setLoading(false);
        }
    };

    const fetchUsers = async () => {
        setUsersLoading(true);
        try {
            const response = await fetch(ENDPOINTS.auth.users, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('jwt') || ''}`
                }
            });
            if (response.ok) {
                const data = await response.json();
                setUsers(data.users || []);
            }
        } catch (err) {
            console.error('Failed to fetch users:', err);
        } finally {
            setUsersLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    return (
        <div className="w-full pb-12 fade-up-enter fade-up-enter-active">
            {/* Page Header */}
            <div className="mb-8 border-b border-white/10 pb-6">
                <h1 className="font-display-lg text-3xl md:text-5xl text-on-surface mb-2 m-0 tracking-tight flex items-center gap-4">
                    <span className="material-symbols-outlined text-primary text-4xl">admin_panel_settings</span>
                    Admin Panel
                </h1>
                <p className="font-body-md text-secondary max-w-2xl m-0">
                    Manage system users and oversee platform access controls.
                </p>
            </div>

            {/* Create User Form */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                <div className="lg:col-span-5 space-y-6">
                    <div className="bg-[#121212] border border-[rgba(255,255,255,0.08)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] p-6 rounded-xl h-full flex flex-col">
                        <div className="mb-6 pb-3 border-b border-white/10 flex items-center gap-3">
                            <span className="material-symbols-outlined text-primary text-[20px]">person_add</span>
                            <h2 className="font-label-caps text-[12px] text-on-surface tracking-widest uppercase m-0">
                                Provision New User
                            </h2>
                        </div>

                        {status && (
                            <div className={`mb-6 p-3 border rounded font-body-sm text-sm ${
                                status.type === 'error' 
                                    ? 'bg-error/10 border-error/30 text-error' 
                                    : 'bg-[#4ade80]/10 border-[#4ade80]/30 text-[#4ade80]'
                            }`}>
                                {status.type === 'error' ? '❌ ' : '✅ '}{status.msg}
                            </div>
                        )}

                        <form onSubmit={handleCreateUser} className="space-y-6 flex-1">
                            <div className="space-y-2">
                                <label className="font-label-caps text-[12px] uppercase tracking-widest text-secondary block">
                                    Email Address
                                </label>
                                <input 
                                    className="bg-transparent border-0 border-b border-white/20 rounded-none text-[#e3e2e2] px-0 py-2 w-full font-mono text-sm transition-all focus:outline-none focus:border-primary focus:shadow-[0_0_4px_rgba(212,175,55,0.5)] focus:pl-2 placeholder:text-white/20" 
                                    name="email" 
                                    type="email"
                                    placeholder="manager@m5.com" 
                                    value={formData.email} onChange={handleChange} required 
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="font-label-caps text-[12px] uppercase tracking-widest text-secondary block">
                                    Temporary Password
                                </label>
                                <input 
                                    className="bg-transparent border-0 border-b border-white/20 rounded-none text-[#e3e2e2] px-0 py-2 w-full font-mono text-sm transition-all focus:outline-none focus:border-primary focus:shadow-[0_0_4px_rgba(212,175,55,0.5)] focus:pl-2 placeholder:text-white/20" 
                                    name="password" 
                                    type="password"
                                    placeholder="••••••••" 
                                    value={formData.password} onChange={handleChange} required 
                                    minLength={8}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="font-label-caps text-[12px] uppercase tracking-widest text-secondary block">
                                    System Role
                                </label>
                                <select 
                                    className="bg-transparent border-0 border-b border-white/20 rounded-none text-[#e3e2e2] px-0 py-2 w-full font-mono text-sm appearance-none transition-all focus:outline-none focus:border-primary focus:shadow-[0_0_4px_rgba(212,175,55,0.5)] focus:pl-2" 
                                    name="role" 
                                    value={formData.role} onChange={handleChange}
                                >
                                    <option value="STORE_OWNER" className="bg-[#1a1c1c]">Store Owner</option>
                                    <option value="ADMIN" className="bg-[#1a1c1c]">Administrator</option>
                                </select>
                            </div>

                            {formData.role === 'STORE_OWNER' && (
                                <div className="space-y-2">
                                    <label className="font-label-caps text-[12px] uppercase tracking-widest text-secondary block">
                                        Assigned Store ID
                                    </label>
                                    <input 
                                        className="bg-transparent border-0 border-b border-white/20 rounded-none text-[#e3e2e2] px-0 py-2 w-full font-mono text-sm transition-all focus:outline-none focus:border-primary focus:shadow-[0_0_4px_rgba(212,175,55,0.5)] focus:pl-2 placeholder:text-white/20" 
                                        name="store_id" 
                                        type="text"
                                        placeholder="e.g. CA_1" 
                                        value={formData.store_id} onChange={handleChange} required 
                                    />
                                    <p className="text-[10px] text-secondary mt-1 uppercase tracking-widest">
                                        Required for Store Owners
                                    </p>
                                </div>
                            )}

                            <div className="pt-6 mt-6 border-t border-white/10">
                                <button 
                                    type="submit" disabled={loading}
                                    className="w-full bg-primary-container text-[#050505] font-label-caps text-[12px] uppercase tracking-widest py-3 px-6 rounded hover:bg-primary transition-colors flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]"
                                >
                                    <span className="material-symbols-outlined text-[18px]">
                                        {loading ? 'sync' : 'how_to_reg'}
                                    </span>
                                    {loading ? 'Provisioning...' : 'Create Account'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>

                {/* User List Column */}
                <div className="lg:col-span-7">
                    <div className="bg-[#121212]/50 border border-[rgba(255,255,255,0.08)] p-6 rounded-xl h-full">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="font-headline-md text-xl text-on-surface m-0 flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">group</span>
                                System Users ({users.length})
                            </h2>
                            <button 
                                onClick={() => fetchUsers()}
                                className="bg-transparent border border-white/10 text-on-surface-variant px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors flex items-center gap-1 text-xs"
                            >
                                <span className="material-symbols-outlined text-[14px]">refresh</span>
                                Refresh
                            </button>
                        </div>

                        {usersLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <span className="material-symbols-outlined text-primary text-[24px] animate-spin">sync</span>
                            </div>
                        ) : users.length === 0 ? (
                            <div className="text-center py-12">
                                <span className="material-symbols-outlined text-secondary text-[48px] mb-2">group_off</span>
                                <p className="font-body-sm text-secondary">No users found.</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {users.map((user) => (
                                    <div 
                                        key={user.id} 
                                        className="bg-[#1a1a1a]/50 rounded-lg p-4 border border-white/5 hover:border-white/10 transition-all flex items-center justify-between"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-3">
                                                <span className="material-symbols-outlined text-primary">
                                                    {user.role === 'ADMIN' ? 'admin_panel_control' : 'person'}
                                                </span>
                                                <div>
                                                    <p className="font-mono text-sm text-on-surface truncate">
                                                        {user.email}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className={`font-label-caps text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full ${
                                                            user.role === 'ADMIN' 
                                                                ? 'bg-primary-container/20 text-primary' 
                                                                : 'bg-blue-500/20 text-blue-400'
                                                        }`}>
                                                            {user.role}
                                                        </span>
                                                        {user.store_id && (
                                                            <span className="font-mono text-[10px] text-secondary">
                                                                Store: {user.store_id}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <span className="material-symbols-outlined text-on-surface-variant/40">
                                            more_horiz
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}