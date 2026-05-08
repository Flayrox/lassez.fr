'use client';

import React, { useEffect, useState } from 'react';

export function UserSection() {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchUsers = async () => {
        try {
            const res = await fetch('/api/radar/users');
            const data = await res.json();
            if (data.success) setUsers(data.users);
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    return (
        <div className="space-y-10">
            <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 mb-1">Access Control</h3>
                <p className="text-[11px] text-slate-500 font-medium italic">Manage identities and permissions for the Cortex Administration.</p>
            </div>

            <div className="space-y-4">
                <div className="flex justify-between items-center mb-6">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Authorized Personnel</h4>
                    <button className="px-4 py-2 bg-black text-white text-[10px] font-bold uppercase rounded-lg hover:bg-zinc-800 transition-all">
                        Invite Agent
                    </button>
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Identity</th>
                                <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Role</th>
                                <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Last Activity</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-10 text-center text-slate-400 text-[10px] font-bold uppercase animate-pulse">
                                        Loading Secure Identity Matrix...
                                    </td>
                                </tr>
                            ) : users.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-10 text-center text-slate-400 text-[10px] font-bold uppercase">
                                        No secondary agents configured.
                                    </td>
                                </tr>
                            ) : (
                                users.map(user => (
                                    <tr key={user.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-black text-[10px] text-slate-600">
                                                    {user.email[0].toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-slate-900">{user.name || 'Anonymous Agent'}</p>
                                                    <p className="text-[10px] text-slate-400 font-medium">{user.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[9px] font-black rounded uppercase">
                                                {user.role}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
                                                <span className="text-[10px] font-bold text-slate-600 uppercase">Authorized</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                                            {user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never'}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
