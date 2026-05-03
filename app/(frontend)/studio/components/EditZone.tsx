'use client';

import React, { useRef, useEffect } from 'react';
import { BrutToolbar } from './BrutToolbar';

export function EditZone({ html, onChange, label = 'EDIT', className, style, stickerPos = '-top-4 left-0' }: {
    html: string; onChange: (h: string) => void;
    label?: string; className?: string; style?: React.CSSProperties; stickerPos?: string;
}) {
    const zoneRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (zoneRef.current && !zoneRef.current.contains(document.activeElement) && zoneRef.current.innerHTML !== html)
            zoneRef.current.innerHTML = html;
    }, [html]);
    return (
        <div className="edit-zone" style={{ position: 'relative' }}>
            <BrutToolbar containerRef={zoneRef} />
            <div className="edit-overlay"></div>
            <div className={`edit-sticker ${stickerPos}`} onClick={() => zoneRef.current?.focus()}>✎ {label}</div>
            <div ref={zoneRef} contentEditable suppressContentEditableWarning className={className} style={style}
                onInput={() => { if (zoneRef.current) onChange(zoneRef.current.innerHTML); }} />
        </div>
    );
}
