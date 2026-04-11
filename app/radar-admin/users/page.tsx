'use client';

import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { useRadarAdmin } from '../components/RadarAdminContext';

type UserItem = {
    id: number;
    username: string;
    role: 'admin' | 'editor' | 'viewer';
    is_active: number;
    permissions: Record<string, boolean>;
    created_at: string;
};

const PERM_KEYS = ['radar', 'studio', 'network', 'lab', 'settings', 'users'] as const;

const EMPTY_USER = {
    username: '',
    password: '',
    role: 'viewer' as 'admin' | 'editor' | 'viewer',
    permissions: {
        radar: true,
        studio: false,
        network: false,
        lab: false,
        settings: false,
        users: false
    },
    is_active: true
};

export default function UsersPage() {
    const { isDaemonRunning, countdown } = useRadarAdmin();
    const [users, setUsers] = useState<UserItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState(EMPTY_USER);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/radar/users');
            const data = await res.json();
            if (data.success) setUsers(data.users || []);
            else alert(data.error || 'Erreur chargement utilisateurs.');
        } catch (e) {
            console.error(e);
            alert('Erreur reseau (utilisateurs).');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const patchPerm = (key: string, value: boolean) => {
        if (form.role === 'admin') return;
        setForm(prev => ({ ...prev, permissions: { ...prev.permissions, [key]: value } }));
    };

    const onRoleChange = (role: 'admin' | 'editor' | 'viewer') => {
        if (role === 'admin') {
            setForm(prev => ({
                ...prev,
                role,
                permissions: {
                    radar: true,
                    studio: true,
                    network: true,
                    lab: true,
                    settings: true,
                    users: true
                }
            }));
            return;
        }
        setForm(prev => ({ ...prev, role }));
    };

    const createUser = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/radar/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form)
            });
            const data = await res.json();
            if (!data.success) {
                alert(data.error || 'Creation impossible.');
            } else {
                setForm(EMPTY_USER);
                await fetchUsers();
            }
        } catch (e) {
            console.error(e);
            alert('Erreur reseau creation utilisateur.');
        } finally {
            setSaving(false);
        }
    };

    const updateUser = async (id: number, patch: any) => {
        try {
            const res = await fetch('/api/radar/users', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, ...patch })
            });
            const data = await res.json();
            if (!data.success) {
                alert(data.error || 'Mise a jour impossible.');
                return;
            }
            await fetchUsers();
        } catch (e) {
            console.error(e);
            alert('Erreur reseau mise a jour utilisateur.');
        }
    };

    const deleteUser = async (id: number) => {
        if (!confirm('Supprimer cet utilisateur ?')) return;
        try {
            const res = await fetch('/api/radar/users', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            const data = await res.json();
            if (!data.success) {
                alert(data.error || 'Suppression impossible.');
                return;
            }
            await fetchUsers();
        } catch (e) {
            console.error(e);
            alert('Erreur reseau suppression utilisateur.');
        }
    };

    return (
        <DashboardLayout
            title="ACCES & PERMISSIONS"
            subtitle={countdown || 'Gestion des comptes Radar Admin'}
            isDaemonRunning={isDaemonRunning}
        >
            <div className="max-w-6xl font-label space-y-8">
                <section className="bg-white border-4 border-stone-900 shadow-[10px_10px_0px_0px_#1A1C1C] p-8">
                    <h2 className="text-2xl font-black uppercase tracking-tighter font-headline mb-6">Nouvel utilisateur</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="text-[10px] font-black uppercase text-stone-500 mb-1 block">Username</label>
                            <input value={form.username} onChange={e => setForm(prev => ({ ...prev, username: e.target.value }))} className="w-full bg-stone-50 border-4 border-stone-900 p-3 font-mono text-xs" placeholder="journaliste_1" />
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase text-stone-500 mb-1 block">Password</label>
                            <input type="password" value={form.password} onChange={e => setForm(prev => ({ ...prev, password: e.target.value }))} className="w-full bg-stone-50 border-4 border-stone-900 p-3 font-mono text-xs" placeholder="10+ caracteres" />
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase text-stone-500 mb-1 block">Role</label>
                            <select value={form.role} onChange={e => onRoleChange(e.target.value as any)} className="w-full bg-stone-50 border-4 border-stone-900 p-3 font-black text-xs uppercase">
                                <option value="admin">admin</option>
                                <option value="editor">editor</option>
                                <option value="viewer">viewer</option>
                            </select>
                        </div>
                    </div>

                    <div className="mt-6">
                        <div className="text-[10px] font-black uppercase tracking-widest text-stone-500 mb-2">Permissions</div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {PERM_KEYS.map(key => (
                                <label key={key} className="flex items-center justify-between bg-stone-50 border-2 border-stone-900 p-3">
                                    <span className="text-xs font-black uppercase">{key}</span>
                                    <input type="checkbox" checked={Boolean(form.permissions[key])} disabled={form.role === 'admin'} onChange={e => patchPerm(key, e.target.checked)} />
                                </label>
                            ))}
                        </div>
                    </div>

                    <button onClick={createUser} disabled={saving} className="mt-6 bg-red-700 text-white px-6 py-3 border-4 border-stone-900 font-black uppercase text-xs tracking-widest disabled:opacity-60">
                        {saving ? 'Creation...' : 'Creer le compte'}
                    </button>
                </section>

                <section className="bg-white border-4 border-stone-900 shadow-[10px_10px_0px_0px_#1A1C1C] p-8">
                    <h2 className="text-2xl font-black uppercase tracking-tighter font-headline mb-6">Comptes existants</h2>
                    {loading ? (
                        <div className="text-xs font-black uppercase tracking-widest text-stone-500">Chargement...</div>
                    ) : users.length === 0 ? (
                        <div className="text-xs font-black uppercase tracking-widest text-stone-500">Aucun compte utilisateur en base.</div>
                    ) : (
                        <div className="space-y-4">
                            {users.map(user => (
                                <div key={user.id} className="border-4 border-stone-900 p-4 bg-stone-50">
                                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                        <div>
                                            <div className="text-sm font-black uppercase tracking-tight">{user.username}</div>
                                            <div className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Role: {user.role} | Cree: {new Date(user.created_at).toLocaleString('fr-FR')}</div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                                                Actif
                                                <input
                                                    type="checkbox"
                                                    checked={user.is_active === 1}
                                                    onChange={e => updateUser(user.id, { is_active: e.target.checked })}
                                                />
                                            </label>
                                            <button onClick={() => {
                                                const pwd = prompt(`Nouveau mot de passe pour ${user.username} (10+ caracteres)`);
                                                if (!pwd) return;
                                                updateUser(user.id, { password: pwd });
                                            }} className="px-3 py-2 bg-white border-2 border-stone-900 text-[10px] font-black uppercase">Reset pass</button>
                                            <button onClick={() => deleteUser(user.id)} className="px-3 py-2 bg-red-700 text-white border-2 border-stone-900 text-[10px] font-black uppercase">Supprimer</button>
                                        </div>
                                    </div>

                                    <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-2">
                                        {PERM_KEYS.map(key => (
                                            <label key={key} className="flex items-center justify-between bg-white border-2 border-stone-900 p-2">
                                                <span className="text-[10px] font-black uppercase">{key}</span>
                                                <input
                                                    type="checkbox"
                                                    checked={Boolean(user.permissions?.[key]) || user.role === 'admin'}
                                                    disabled={user.role === 'admin'}
                                                    onChange={e => updateUser(user.id, {
                                                        permissions: { ...user.permissions, [key]: e.target.checked }
                                                    })}
                                                />
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </DashboardLayout>
    );
}
