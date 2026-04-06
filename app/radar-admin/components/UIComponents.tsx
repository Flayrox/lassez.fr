import React from 'react';

// ─── Infobulle UI ───────────────────────────────────────────────
export function TooltipInfo({ text, position = 'top' }: { text: string; position?: 'top' | 'bottom' }) {
    return (
        <div className="group relative inline-flex items-center justify-center">
            <span className="cursor-help w-3.5 h-3.5 rounded-full border border-stone-300 flex items-center justify-center text-[9px] font-bold text-stone-400 group-hover:bg-stone-200 group-hover:text-stone-700 transition-colors">
                i
            </span>
            <div className={`absolute ${position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'} left-1/2 -translate-x-1/2 w-56 p-2.5 bg-stone-900 font-medium text-stone-100 text-[11px] rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none text-center leading-relaxed backdrop-blur-sm bg-stone-900/95`}>
                {text}
                <div className={`absolute ${position === 'top' ? 'top-full border-t-stone-900/95' : 'bottom-full border-b-stone-900/95'} left-1/2 -translate-x-1/2 border-4 border-transparent`} />
            </div>
        </div>
    );
}

// ─── Petit toggle switch UI ───────────────────────────────────
export function Toggle({ checked, onChange, disabled = false }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
    return (
        <button
            onClick={() => !disabled && onChange(!checked)}
            disabled={disabled}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${checked ? 'bg-rose-600' : 'bg-stone-200'}`}
        >
            <span className={`pointer-events-none inline-block h-5 w-5 translate-y-0.5 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ease-in-out ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
    );
}

// ─── Setting row dans le panneau ──────────────────────────────
export function SettingRow({ label, tooltip, description, children }: { label: string; tooltip?: string; description?: string; children: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between gap-4 py-3.5 border-b border-stone-100 last:border-0">
            <div className="min-w-0 pr-4">
                <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium text-stone-800">{label}</p>
                    {tooltip && <TooltipInfo text={tooltip} />}
                </div>
                {description && <p className="text-xs text-stone-400 mt-1 leading-relaxed">{description}</p>}
            </div>
            <div className="shrink-0">{children}</div>
        </div>
    );
}

// ─── Badge de statut du mode actuel ──────────────────────────
export function StatusBadge({ isAutoApprove, isAutoPilot }: { isAutoApprove: boolean; isAutoPilot: boolean }) {
    if (isAutoApprove && isAutoPilot) return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Mode Fantôme — 100% automatique
        </span>
    );
    if (isAutoPilot) return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            Pilote auto — validation manuelle requise
        </span>
    );
    return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-stone-100 text-stone-500 border border-stone-200">
            <span className="w-1.5 h-1.5 rounded-full bg-stone-400" />
            Mode manuel
        </span>
    );
}