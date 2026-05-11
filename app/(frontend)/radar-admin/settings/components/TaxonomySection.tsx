'use client';

import React, { useState, useEffect, useCallback } from 'react';

interface TaxonomyTemplate {
    id: string;
    name: string;
    displayName: string;
    description: string;
    formatInstructions: string;
    examplesJson: string;
    outputSchemaJson: string;
    accentColor: string;
    isFactory: boolean;
    active: boolean;
    sortOrder: number;
}

export function TaxonomySection() {
    const [taxonomies, setTaxonomies] = useState<TaxonomyTemplate[]>([]);
    const [expanded, setExpanded] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const [newName, setNewName] = useState('');
    const [newDisplayName, setNewDisplayName] = useState('');
    const [saving, setSaving] = useState<string | null>(null);
    const [dirty, setDirty] = useState<Set<string>>(new Set());

    const fetchTaxonomies = useCallback(async () => {
        const res = await fetch('/api/radar/taxonomies');
        const data = await res.json();
        if (data.success) setTaxonomies(data.taxonomies);
    }, []);

    useEffect(() => { fetchTaxonomies(); }, [fetchTaxonomies]);

    const updateLocal = (id: string, field: string, value: any) => {
        setTaxonomies(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
        setDirty(prev => new Set(prev).add(id));
    };

    const save = async (taxonomy: TaxonomyTemplate) => {
        setSaving(taxonomy.id);
        try {
            await fetch('/api/radar/taxonomies', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: taxonomy.id,
                    displayName: taxonomy.displayName,
                    description: taxonomy.description,
                    formatInstructions: taxonomy.formatInstructions,
                    examplesJson: taxonomy.examplesJson,
                    outputSchemaJson: taxonomy.outputSchemaJson,
                    accentColor: taxonomy.accentColor,
                    active: taxonomy.active,
                }),
            });
            setDirty(prev => { const next = new Set(prev); next.delete(taxonomy.id); return next; });
        } catch (e) {
            console.error('Save failed:', e);
        } finally {
            setSaving(null);
        }
    };

    const create = async () => {
        if (!newName.trim() || !newDisplayName.trim()) return;
        await fetch('/api/radar/taxonomies', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newName.toUpperCase(), displayName: newDisplayName }),
        });
        setNewName('');
        setNewDisplayName('');
        setCreating(false);
        fetchTaxonomies();
    };

    const deleteTaxonomy = async (id: string) => {
        if (!confirm('Supprimer cette taxonomie ?')) return;
        await fetch(`/api/radar/taxonomies?id=${id}`, { method: 'DELETE' });
        fetchTaxonomies();
    };

    const toggleActive = async (taxonomy: TaxonomyTemplate) => {
        updateLocal(taxonomy.id, 'active', !taxonomy.active);
        await fetch('/api/radar/taxonomies', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: taxonomy.id, active: !taxonomy.active }),
        });
    };

    // Parse examples for visual editing
    const getExamples = (json: string): string[] => {
        try { return JSON.parse(json); } catch { return []; }
    };

    const setExamples = (id: string, examples: string[]) => {
        updateLocal(id, 'examplesJson', JSON.stringify(examples));
    };

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-black text-black uppercase tracking-tight">Taxonomy Templates</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Manage news categories, their format, examples, and output schema.</p>
                </div>
                <button 
                    onClick={() => setCreating(!creating)}
                    className="px-4 py-2 bg-black text-white text-xs font-bold rounded-sm hover:bg-zinc-800 transition-all flex items-center gap-2"
                >
                    <span className="material-symbols-outlined text-sm">add</span>
                    New Taxonomy
                </button>
            </div>

            {/* Create Form */}
            {creating && (
                <div className="bg-slate-50 border border-slate-200 rounded-sm p-5 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">System Key</label>
                            <input 
                                value={newName} onChange={(e) => setNewName(e.target.value.toUpperCase())}
                                placeholder="THREAD" className="w-full border border-slate-200 rounded-sm px-3 py-2 text-sm font-mono font-bold uppercase focus:border-black outline-none"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Display Name</label>
                            <input 
                                value={newDisplayName} onChange={(e) => setNewDisplayName(e.target.value)}
                                placeholder="🧵 THREAD" className="w-full border border-slate-200 rounded-sm px-3 py-2 text-sm font-bold focus:border-black outline-none"
                            />
                        </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                        <button onClick={() => setCreating(false)} className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-black">Cancel</button>
                        <button onClick={create} className="px-5 py-2 bg-black text-white text-xs font-bold rounded-sm">Create</button>
                    </div>
                </div>
            )}

            {/* Taxonomy Cards */}
            <div className="space-y-3">
                {taxonomies.map(tax => (
                    <div key={tax.id} className={`border rounded-sm overflow-hidden transition-all ${tax.active ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50/50 opacity-60'}`}>
                        {/* Card Header */}
                        <div className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-slate-50/50 transition-colors" onClick={() => setExpanded(expanded === tax.id ? null : tax.id)}>
                            <div className="flex items-center gap-4">
                                <div className="w-3 h-3 rounded-full border-2" style={{ backgroundColor: tax.accentColor, borderColor: tax.accentColor }} />
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-black text-black">{tax.displayName}</span>
                                        <span className="text-[9px] font-mono font-bold bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded">{tax.name}</span>
                                        {tax.isFactory && <span className="text-[8px] font-bold bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded uppercase">Factory</span>}
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-0.5">{tax.description || 'No description'}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {dirty.has(tax.id) && <span className="text-[9px] font-bold text-amber-500">UNSAVED</span>}
                                <button onClick={(e) => { e.stopPropagation(); toggleActive(tax); }} className={`text-[10px] font-bold px-3 py-1 rounded-sm border transition-all ${tax.active ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-slate-100 border-slate-200 text-slate-400'}`}>
                                    {tax.active ? 'Active' : 'Disabled'}
                                </button>
                                <span className="material-symbols-outlined text-slate-300 text-lg">{expanded === tax.id ? 'expand_less' : 'expand_more'}</span>
                            </div>
                        </div>

                        {/* Expanded Editor */}
                        {expanded === tax.id && (
                            <div className="border-t border-slate-100 p-5 space-y-6">
                                {/* Row 1: Display Name + Color */}
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="col-span-2 space-y-1.5">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase">Display Name</label>
                                        <input value={tax.displayName} onChange={(e) => updateLocal(tax.id, 'displayName', e.target.value)}
                                            className="w-full border border-slate-200 rounded-sm px-3 py-2 text-sm font-bold focus:border-black outline-none" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase">Accent Color</label>
                                        <div className="flex items-center gap-2">
                                            <input type="color" value={tax.accentColor} onChange={(e) => updateLocal(tax.id, 'accentColor', e.target.value)}
                                                className="w-10 h-9 rounded cursor-pointer border-0" />
                                            <input value={tax.accentColor} onChange={(e) => updateLocal(tax.id, 'accentColor', e.target.value)}
                                                className="flex-1 border border-slate-200 rounded-sm px-3 py-2 text-xs font-mono focus:border-black outline-none" />
                                        </div>
                                    </div>
                                </div>

                                {/* Description */}
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Description (used by Researcher for categorization)</label>
                                    <input value={tax.description} onChange={(e) => updateLocal(tax.id, 'description', e.target.value)}
                                        placeholder="Describe when this taxonomy should be used..."
                                        className="w-full border border-slate-200 rounded-sm px-3 py-2 text-xs focus:border-black outline-none" />
                                </div>

                                {/* Format Instructions */}
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Format Instructions (sent to the Editorialist AI)</label>
                                    <textarea value={tax.formatInstructions} onChange={(e) => updateLocal(tax.id, 'formatInstructions', e.target.value)}
                                        rows={6} className="w-full border border-slate-200 rounded-sm px-3 py-2 text-xs font-mono leading-relaxed focus:border-black outline-none resize-y" />
                                </div>

                                {/* Examples Editor */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase">Examples (Few-Shot Learning)</label>
                                        <button onClick={() => setExamples(tax.id, [...getExamples(tax.examplesJson), ''])}
                                            className="text-[10px] font-bold text-black px-2 py-1 border border-slate-200 rounded-sm hover:bg-slate-50">
                                            + Add Example
                                        </button>
                                    </div>
                                    {getExamples(tax.examplesJson).map((ex, i) => (
                                        <div key={i} className="relative">
                                            <div className="absolute top-2 left-2 text-[8px] font-bold text-slate-300 uppercase">#{i + 1}</div>
                                            <textarea value={ex} 
                                                onChange={(e) => {
                                                    const examples = getExamples(tax.examplesJson);
                                                    examples[i] = e.target.value;
                                                    setExamples(tax.id, examples);
                                                }}
                                                rows={3} className="w-full border border-slate-200 rounded-sm pl-8 pr-8 py-2 text-xs leading-relaxed focus:border-black outline-none resize-y bg-slate-50" />
                                            <button onClick={() => {
                                                const examples = getExamples(tax.examplesJson);
                                                examples.splice(i, 1);
                                                setExamples(tax.id, examples);
                                            }} className="absolute top-2 right-2 text-slate-300 hover:text-rose-500">
                                                <span className="material-symbols-outlined text-sm">close</span>
                                            </button>
                                        </div>
                                    ))}
                                    {getExamples(tax.examplesJson).length === 0 && <p className="text-[10px] text-slate-300 italic">No examples configured. The AI will rely solely on format instructions.</p>}
                                </div>

                                {/* Output Schema */}
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Output JSON Schema (expected response format)</label>
                                    <textarea value={tax.outputSchemaJson} onChange={(e) => updateLocal(tax.id, 'outputSchemaJson', e.target.value)}
                                        rows={8} className="w-full border border-slate-200 rounded-sm px-3 py-2 text-xs font-mono leading-relaxed focus:border-black outline-none resize-y bg-slate-50" />
                                </div>

                                {/* Actions */}
                                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                                    <div>
                                        {!tax.isFactory && (
                                            <button onClick={() => deleteTaxonomy(tax.id)} className="text-xs text-rose-400 hover:text-rose-600 font-bold flex items-center gap-1">
                                                <span className="material-symbols-outlined text-sm">delete</span> Delete
                                            </button>
                                        )}
                                    </div>
                                    <button 
                                        onClick={() => save(tax)}
                                        disabled={!dirty.has(tax.id) || saving === tax.id}
                                        className={`px-6 py-2 text-xs font-bold rounded-sm transition-all ${
                                            dirty.has(tax.id) ? 'bg-black text-white hover:bg-zinc-800' : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                                        }`}
                                    >
                                        {saving === tax.id ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
