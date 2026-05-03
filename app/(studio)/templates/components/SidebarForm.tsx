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
        padding: '7px 10px',
        outline: 'none',
        borderRadius: 4,
        boxSizing: 'border-box',
        transition: 'border-color 0.15s',
    };

    switch (field.type) {
        case 'text':
            return (
                <div>
                    {label}
                    <textarea
                        style={{ ...inputBase, resize: 'vertical', lineHeight: 1.5, minHeight: 58 }}
                        rows={2}
                        value={value ?? ''}
                        onChange={e => onPatch({ [field.key]: e.target.value })}
                        onFocus={e => { e.currentTarget.style.borderColor = T.borderFocus; }}
                        onBlur={e => { e.currentTarget.style.borderColor = T.border; }}
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
                        padding: '5px 10px', borderRadius: 4,
                    }}>
                        <input
                            type="color"
                            style={{ width: 20, height: 20, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                            value={value ?? '#000000'}
                            onChange={e => onPatch({ [field.key]: e.target.value })}
                        />
                        <span style={{ fontSize: 11, fontFamily: 'Inter, monospace', color: T.textMid, textTransform: 'uppercase' }}>
                            {(value ?? '#000000').toUpperCase()}
                        </span>
                    </div>
                </div>
            );

        case 'number':
            return (
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                        {label}
                        <span style={{ fontSize: 11, color: T.textMuted, fontFamily: 'Inter, monospace' }}>{value ?? 0}</span>
                    </div>
                    <input
                        type="range"
                        className="w-full"
                        min={field.props?.min ?? 0}
                        max={field.props?.max ?? 100}
                        step={field.props?.step ?? 1}
                        value={value ?? 0}
                        onChange={e => {
                            const v = parseFloat(e.target.value);
                            onPatch({ [field.key]: isNaN(v) ? 0 : v });
                        }}
                        style={{ width: '100%', accentColor: '#fff' }}
                    />
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
                        onFocus={e => { e.currentTarget.style.borderColor = T.borderFocus; }}
                        onBlur={e => { e.currentTarget.style.borderColor = T.border; }}
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
                        style={{
                            width: 40, height: 22, position: 'relative',
                            background: value ? '#fff' : '#333',
                            border: `1px solid ${value ? '#fff' : T.border}`,
                            borderRadius: 12,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            flexShrink: 0,
                        }}
                    >
                        <div style={{
                            position: 'absolute',
                            top: 2,
                            left: value ? 20 : 2,
                            width: 16, height: 16,
                            borderRadius: '50%',
                            background: value ? '#000' : '#888',
                            transition: 'all 0.2s',
                        }} />
                    </button>
                </div>
            );

        default:
            return null;
    }
}
