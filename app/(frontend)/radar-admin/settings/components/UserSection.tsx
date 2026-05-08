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
        <div className="space-y-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <h3 className="text-sm font-semibold text-black">Access control</h3>
                <button className="text-[11px] font-medium text-slate-400 hover:text-black transition-all">
                    + Invite user
                </button>
            </div>

            <div className="border border-slate-200 rounded-sm overflow-hidden bg-white shadow-sm">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-500 font-medium">
                            <th className="px-4 py-2">Identity</th>
                            <th className="px-4 py-2">Role</th>
                            <th className="px-4 py-2">Status</th>
                            <th className="px-4 py-2">Activity</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                        {loading ? (
                            <tr><td colSpan={4} className="py-8 text-center text-slate-400">Loading directory...</td></tr>
                        ) : users.length === 0 ? (
                            <tr><td colSpan={4} className="py-8 text-center text-slate-400 italic">No administrative identities found.</td></tr>
                        ) : (
                            users.map(user => (
                                <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-4 py-2">
                                        <div className="flex items-center gap-2">
                                            <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center font-bold text-[9px] text-slate-500">
                                                {user.email[0].toUpperCase()}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-bold text-black">{user.name || 'Anonymous'}</span>
                                                <span className="text-[9px] text-slate-400">{user.email}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-2">
                                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[9px] font-bold rounded-sm">
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2">
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-1 h-1 rounded-full bg-emerald-500 shadow-[0_0_3px_rgba(16,185,129,0.5)]" />
                                            <span className="text-[10px] font-medium text-slate-500">Authorized</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-2 text-slate-400 text-[10px]">
                                        {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
