'use client';

import React, { useState, useEffect } from 'react';

interface AdvancedSectionProps {
    form: any;
    updateForm: (key: string, val: any) => void;
}

export function AdvancedSection({ form, updateForm }: AdvancedSectionProps) {
    const [models, setModels] = useState<any[]>([]);

    useEffect(() => {
        try {
            const parsed = JSON.parse(form.availableModelsJson || '[]');
            setModels(Array.isArray(parsed) ? parsed : []);
        } catch (e) {
            setModels([]);
        }
    }, [form.availableModelsJson]);

    const handleAddModel = () => {
        const next = [...models, { value: '', label: '' }];
        setModels(next);
        updateForm('availableModelsJson', JSON.stringify(next));
    };

    const handleRemoveModel = (index: number) => {
        const next = models.filter((_, i) => i !== index);
        setModels(next);
        updateForm('availableModelsJson', JSON.stringify(next));
    };

    const handleUpdateModel = (index: number, field: string, value: string) => {
        const next = [...models];
        next[index][field] = value;
        setModels(next);
        updateForm('availableModelsJson', JSON.stringify(next));
    };

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <h3 className="text-sm font-semibold text-black">Advanced Registry</h3>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Model Management</span>
            </div>

            <div className="bg-slate-50 p-6 rounded-sm border border-slate-100 space-y-4">
                <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-black uppercase tracking-tighter">AI Model Registry</span>
                    <span className="text-[9px] text-slate-400">Configure the list of models available across the entire platform.</span>
                </div>

                <div className="space-y-3">
                    {models.map((model, idx) => (
                        <div key={idx} className="flex gap-2 items-end group">
                            <div className="flex-1 space-y-1">
                                <label className="text-[9px] font-bold text-slate-400 uppercase">Label (UI)</label>
                                <input 
                                    type="text" 
                                    value={model.label} 
                                    onChange={(e) => handleUpdateModel(idx, 'label', e.target.value)}
                                    placeholder="e.g. Gemini 3.1 Pro"
                                    className="w-full bg-white border border-slate-200 rounded-sm px-2 py-1 text-[11px] font-medium outline-none focus:border-black transition-all"
                                />
                            </div>
                            <div className="flex-1 space-y-1">
                                <label className="text-[9px] font-bold text-slate-400 uppercase">Value (API ID)</label>
                                <input 
                                    type="text" 
                                    value={model.value} 
                                    onChange={(e) => handleUpdateModel(idx, 'value', e.target.value)}
                                    placeholder="e.g. gemini-3.1-pro-preview"
                                    className="w-full bg-white border border-slate-200 rounded-sm px-2 py-1 text-[11px] font-mono outline-none focus:border-black transition-all"
                                />
                            </div>
                            <button 
                                onClick={() => handleRemoveModel(idx)}
                                className="p-1.5 text-slate-300 hover:text-rose-500 transition-colors"
                            >
                                <span className="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                        </div>
                    ))}
                </div>

                <button 
                    onClick={handleAddModel}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-slate-300 rounded-sm text-[10px] font-bold text-slate-400 hover:border-black hover:text-black transition-all"
                >
                    <span className="material-symbols-outlined text-[14px]">add</span>
                    Add new model
                </button>
            </div>

            <div className="p-4 bg-amber-50 border border-amber-100 rounded-sm">
                <div className="flex gap-3">
                    <span className="material-symbols-outlined text-amber-500 text-[18px]">warning</span>
                    <div className="space-y-1">
                        <p className="text-[10px] font-bold text-amber-900 uppercase">Critical Warning</p>
                        <p className="text-[10px] text-amber-700 leading-relaxed">
                            Changes to the model registry are immediate across all nodes. Ensure the 'Value' matches a valid Google AI Model ID, or the pipeline will fail.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
