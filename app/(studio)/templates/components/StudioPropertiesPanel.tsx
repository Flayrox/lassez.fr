'use client';

import React from 'react';
import { useStudio } from './StudioContext';
import { getTemplate } from '../registry';
import { SidebarForm } from './SidebarForm';

const T = {
    bg:         '#141414',
    bgSection:  '#1a1a1a',
    border:     '#2a2a2a',
    borderMid:  '#3a3a3a',
    textPrimary:'#ffffff',
    textMid:    '#aaaaaa',
    textMuted:  '#666666',
};

export function StudioPropertiesPanel() {
    const { activeSlide, patchActive } = useStudio();

    if (!activeSlide) {
        return (
            <aside style={panelStyle}>
                <div style={headerStyle}>
                    <span style={headerLabelStyle}>Propriétés</span>
                </div>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 12, color: T.textMuted, fontFamily: 'Inter, sans-serif' }}>
                        Sélectionnez une slide
                    </span>
                </div>
            </aside>
        );
    }

    const { type: templateType, state: activeState } = activeSlide;
    const patch = (p: any) => patchActive(p);
    const modularTemplate = getTemplate(templateType);

    if (!modularTemplate) return <div className="p-8 text-center text-[#444] text-xs">Template non trouvé</div>;

    const fields = typeof modularTemplate.schema === 'function' ? modularTemplate.schema(activeState) : modularTemplate.schema;

    return (
        <aside style={panelStyle}>
            {/* Header */}
            <div style={headerStyle}>
                <span style={headerLabelStyle}>Propriétés</span>
                <span style={{
                    fontSize: 10, color: T.textMuted,
                    background: '#222', border: `1px solid ${T.border}`,
                    padding: '2px 8px', borderRadius: 8,
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 600,
                }}>
                    {templateType.replace(/_/g, ' ')}
                </span>
            </div>

            {/* Template info */}
            {modularTemplate && (
                <div style={{
                    padding: '12px 16px',
                    borderBottom: `1px solid ${T.border}`,
                    background: T.bgSection,
                }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary, margin: 0, letterSpacing: '-0.01em' }}>
                        {modularTemplate.name}
                    </p>
                    {modularTemplate.description && (
                        <p style={{ fontSize: 11, color: T.textMuted, marginTop: 4, lineHeight: 1.5, fontWeight: 500 }}>
                            {modularTemplate.description}
                        </p>
                    )}
                    {modularTemplate.category && (
                        <span style={{
                            display: 'inline-block',
                            marginTop: 8,
                            fontSize: 10,
                            fontWeight: 700,
                            color: '#888',
                            background: '#222',
                            border: `1px solid ${T.border}`,
                            padding: '2px 8px',
                            borderRadius: 6,
                            textTransform: 'uppercase',
                            letterSpacing: '0.06em',
                        }}>
                            {modularTemplate.category}
                        </span>
                    )}
                </div>
            )}

            {/* Form */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 16, fontFamily: 'Inter, system-ui, sans-serif' }} className="sb">
                {modularTemplate ? (
                    <SidebarForm
                        schema={fields}
                        state={activeState}
                        onPatch={patch}
                    />
                ) : (
                    <div style={{ border: `1px solid #4a1010`, background: '#1a0808', borderRadius: 4, padding: 12 }}>
                        <p style={{ fontSize: 12, color: '#ef4444', fontWeight: 600, margin: 0 }}>Template non enregistré</p>
                        <p style={{ fontSize: 11, color: '#888', marginTop: 4 }}>{templateType}</p>
                    </div>
                )}
            </div>

            {/* Status bar */}
            <div style={{
                height: 32,
                borderTop: `1px solid ${T.border}`,
                display: 'flex',
                alignItems: 'center',
                padding: '0 16px',
                gap: 8,
                flexShrink: 0,
            }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }}></span>
                <span style={{ fontSize: 11, color: T.textMuted, fontFamily: 'Inter, sans-serif' }}>
                    Sauvegarde automatique active
                </span>
            </div>
        </aside>
    );
}

const panelStyle: React.CSSProperties = {
    width: '100%',
    background: T.bg,
    borderLeft: `1px solid ${T.border}`,
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    overflow: 'hidden',
    fontFamily: 'Inter, system-ui, sans-serif',
};

const headerStyle: React.CSSProperties = {
    height: 40,
    borderBottom: `1px solid ${T.border}`,
    display: 'flex',
    alignItems: 'center',
    padding: '0 16px',
    gap: 10,
    justifyContent: 'space-between',
    flexShrink: 0,
};

const headerLabelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: T.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
};

