'use client';

import React from 'react';
import { TemplateField } from '../core/types';

interface SidebarFormProps {
    schema: TemplateField[];
    state: any;
    onPatch: (patch: any) => void;
}

const T = {
    border:     '#2a2a2a',
    borderFocus:'#555555',
    bg:         '#1a1a1a',
    bgInput:    '#0f0f0f',
    textPrimary:'#fff',
    textMid:    '#aaa',
    textMuted:  '#666',
};

export function SidebarForm({ schema, state, onPatch }: SidebarFormProps) {
    const groups = schema.reduce((acc, field) => {
        const group = field.group || 'Général';
        if (!acc[group]) acc[group] = [];
        acc[group].push(field);
        return acc;
    }, {} as Record<string, TemplateField[]>);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {Object.entries(groups).map(([groupName, fields]) => (
                <div key={groupName}>
                    {/* Group header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <span style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: T.textMuted,
                            textTransform: 'uppercase',
                            letterSpacing: '0.1em',
                            flexShrink: 0,
                        }}>
                            {groupName}
                        </span>
                        <div style={{ flex: 1, height: 1, background: T.border }}></div>
                    </div>

                    {/* Fields */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {fields.map(field => (
                            <FormField
                                key={field.key}
                                field={field}
                                value={state[field.key]}
                                onPatch={onPatch}
                            />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

function FormField({ field, value, onPatch }: { field: TemplateField; value: any; onPatch: (p: any) => void }) {
    const label = (
        <label style={{
            display: 'block',
            fontSize: 11,
            fontWeight: 500,
            color: T.textMid,
            marginBottom: 5,
            fontFamily: 'Inter, system-ui, sans-serif',
        }}>
            {field.label}
        </label>
    );

    const inputBase: React.CSSProperties = {
        width: '100%',
        background: T.bgInput,
        border: `1px solid ${T.border}`,
        color: T.textPrimary,
        fontSize: 12,
        fontFamily: 'Inter, system-ui, sans-serif',
        padding: '8px 12px',
        outline: 'none',
        borderRadius: 8,
        boxSizing: 'border-box',
        transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
    };

    switch (field.type) {
        case 'text':
            return (
                <div>
                    {label}
                    <textarea
                        style={{ ...inputBase, resize: 'vertical', lineHeight: 1.5, minHeight: 64 }}
                        rows={2}
                        value={value ?? ''}
                        onChange={e => onPatch({ [field.key]: e.target.value })}
                        onFocus={e => { e.currentTarget.style.borderColor = T.borderFocus; e.currentTarget.style.background = '#151515'; }}
                        onBlur={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.background = T.bgInput; }}
                    />
                </div>
            );

        case 'color':
            return (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    {label}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        background: T.bgInput, border: `1px solid ${T.border}`,
                        padding: '5px 12px', borderRadius: 8,
                        transition: 'border-color 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = T.borderFocus; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; }}
                    >
                        <input
                            type="color"
                            style={{ width: 22, height: 22, background: 'none', border: 'none', cursor: 'pointer', padding: 0, borderRadius: 4 }}
                            value={value ?? '#000000'}
                            onChange={e => onPatch({ [field.key]: e.target.value })}
                        />
                        <span style={{ fontSize: 11, fontFamily: 'Inter, monospace', color: T.textMid, textTransform: 'uppercase', fontWeight: 600 }}>
                            {(value ?? '#000000').toUpperCase()}
                        </span>
                    </div>
                </div>
            );

        case 'number':
            return (
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: field.props?.hideSlider ? 0 : 5 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {field.props?.color && (
                                <div style={{ width: 8, height: 8, background: field.props.color, border: '1px solid #444' }} />
                            )}
                            {label}
                        </div>
                        <input
                            type="text"
                            style={{ 
                                width: 50, background: '#000', border: `1px solid ${T.border}`,
                                color: '#fff', fontSize: 10, padding: '2px 4px', borderRadius: 4,
                                textAlign: 'right', fontFamily: 'Inter, monospace'
                            }}
                            value={value ?? 0}
                            onChange={e => {
                                const v = parseFloat(e.target.value.replace(/[^0-9.]/g, ''));
                                onPatch({ [field.key]: isNaN(v) ? 0 : v });
                            }}
                        />
                    </div>
                    {!field.props?.hideSlider && (
                        <input
                            type="range"
                            className="w-full accent-white cursor-pointer"
                            min={field.props?.min ?? 0}
                            max={field.props?.max ?? 100}
                            step={field.props?.step ?? 1}
                            value={value ?? 0}
                            onChange={e => {
                                const v = parseFloat(e.target.value);
                                onPatch({ [field.key]: isNaN(v) ? 0 : v });
                            }}
                            style={{ width: '100%', accentColor: '#fff', height: 4 }}
                        />
                    )}
                </div>
            );

        case 'image':
        case 'video':
            return (
                <div>
                    {label}
                    <input
                        type="text"
                        placeholder="https://..."
                        style={{ ...inputBase }}
                        value={value ?? ''}
                        onChange={e => onPatch({ [field.key]: e.target.value })}
                        onFocus={e => { e.currentTarget.style.borderColor = T.borderFocus; e.currentTarget.style.background = '#151515'; }}
                        onBlur={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.background = T.bgInput; }}
                    />
                </div>
            );

        case 'select':
            return (
                <div>
                    {label}
                    <select
                        style={{ ...inputBase, cursor: 'pointer' }}
                        value={value ?? ''}
                        onChange={e => onPatch({ [field.key]: e.target.value })}
                        onFocus={e => { e.currentTarget.style.borderColor = T.borderFocus; }}
                        onBlur={e => { e.currentTarget.style.borderColor = T.border; }}
                    >
                        {field.options?.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                </div>
            );

        case 'boolean':
            return (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    {label}
                    <button
                        onClick={() => onPatch({ [field.key]: !value })}
                        className="active:scale-90 transition-all duration-150"
                        style={{
                            width: 44, height: 24, position: 'relative',
                            background: value ? '#fff' : '#222',
                            border: `1px solid ${value ? '#fff' : T.border}`,
                            borderRadius: 14,
                            cursor: 'pointer',
                            flexShrink: 0,
                        }}
                    >
                        <div style={{
                            position: 'absolute',
                            top: 3,
                            left: value ? 23 : 3,
                            width: 16, height: 16,
                            borderRadius: '50%',
                            background: value ? '#000' : '#666',
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                        }} />
                    </button>
                </div>
            );

        case 'list':
            const isCompact = field.props?.variant === 'compact';
            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: isCompact ? 10 : 15 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        {label}
                        <button 
                            onClick={() => {
                                const newItem = field.itemSchema?.reduce((acc, f) => {
                                    acc[f.key] = f.type === 'color' ? '#888888' : (f.type === 'number' ? 0 : '');
                                    return acc;
                                }, {} as any);
                                onPatch({ [field.key]: [...(value || []), newItem] });
                            }}
                            style={{
                                background: '#333', border: '1px solid #444', color: '#fff',
                                fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                                cursor: 'pointer', textTransform: 'uppercase'
                            }}
                        >
                            + Ajouter
                        </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: isCompact ? 4 : 8 }}>
                        {(value || []).map((item: any, i: number) => (
                            <div key={i} style={isCompact ? {
                                padding: '4px 0', borderBottom: i === value.length - 1 ? 'none' : `1px solid ${T.border}`,
                                position: 'relative'
                            } : { 
                                background: '#111', border: `1px solid ${T.border}`, 
                                borderRadius: 10, padding: 10, position: 'relative',
                                display: 'flex', flexDirection: 'column', gap: 8
                            }}>
                                <div style={{ position: 'absolute', top: isCompact ? 0 : 8, right: 0, display: 'flex', gap: 4, zIndex: 10 }}>
                                    {!isCompact && (
                                        <>
                                            <button 
                                                onClick={() => {
                                                    if (i === 0) return;
                                                    const newList = [...value];
                                                    [newList[i], newList[i-1]] = [newList[i-1], newList[i]];
                                                    onPatch({ [field.key]: newList });
                                                }}
                                                style={{ background: 'none', border: 'none', color: i === 0 ? '#333' : '#666', fontSize: 10, cursor: i === 0 ? 'default' : 'pointer' }}
                                            >
                                                ▲
                                            </button>
                                            <button 
                                                onClick={() => {
                                                    if (i === value.length - 1) return;
                                                    const newList = [...value];
                                                    [newList[i], newList[i+1]] = [newList[i+1], newList[i]];
                                                    onPatch({ [field.key]: newList });
                                                }}
                                                style={{ background: 'none', border: 'none', color: i === value.length - 1 ? '#333' : '#666', fontSize: 10, cursor: i === value.length - 1 ? 'default' : 'pointer' }}
                                            >
                                                ▼
                                            </button>
                                        </>
                                    )}
                                    <button 
                                        onClick={() => {
                                            const newList = value.filter((_: any, idx: number) => idx !== i);
                                            onPatch({ [field.key]: newList });
                                        }}
                                        style={{
                                            background: 'none', border: 'none', color: '#666',
                                            fontSize: 10, cursor: 'pointer'
                                        }}
                                    >
                                        ✕
                                    </button>
                                </div>
                                
                                {field.itemSchema?.map(subField => (
                                    <FormField
                                        key={subField.key}
                                        field={subField}
                                        value={item[subField.key]}
                                        onPatch={(subPatch) => {
                                            const newList = [...value];
                                            newList[i] = { ...item, ...subPatch };
                                            onPatch({ [field.key]: newList });
                                        }}
                                    />
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            );

        default:
            return null;
    }
}
