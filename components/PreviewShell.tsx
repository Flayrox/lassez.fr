'use client';

import React from 'react';
import Link from 'next/link';

type PreviewShellProps = {
    title: string;
    publishedHref: string;
    statusLabel: string;
    updatedAt?: string | null;
    children: React.ReactNode;
};

function formatDateTime(value?: string | null) {
    if (!value) return 'mise à jour inconnue';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'mise à jour inconnue';

    return new Intl.DateTimeFormat('fr-FR', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(date);
}

export default function PreviewShell({ title, publishedHref, statusLabel, updatedAt, children }: PreviewShellProps) {
    return (
        <section className="mb-8 rounded-[2rem] border border-amber-300 bg-[#fff8e4] shadow-[0_30px_90px_rgba(0,0,0,0.10)] overflow-hidden">
            <div className="sticky top-0 z-40 border-b border-amber-200 bg-black/95 px-4 py-3 text-white backdrop-blur">
                <div className="mx-auto flex max-w-5xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono uppercase tracking-[0.22em]">
                        <span className="rounded-full bg-amber-400 px-3 py-1 font-black text-black">Preview éditoriale</span>
                        <span className="rounded-full border border-white/20 px-3 py-1 text-white/85">{statusLabel}</span>
                        <span className="text-white/65">{title}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono uppercase tracking-[0.22em]">
                        <span className="text-white/60">{formatDateTime(updatedAt)}</span>
                        <button
                            type="button"
                            onClick={() => window.location.reload()}
                            className="rounded-full border border-white/15 bg-white/10 px-3 py-1 font-black text-white transition-colors hover:bg-white/20"
                        >
                            Rafraîchir
                        </button>
                        <Link
                            href={publishedHref}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full bg-white px-3 py-1 font-black text-black transition-colors hover:bg-amber-200"
                        >
                            Ouvrir publié
                        </Link>
                    </div>
                </div>
            </div>

            <div className="mx-auto max-w-5xl px-3 py-3 md:px-4 md:py-4">
                <div className="rounded-[1.5rem] border border-amber-200 bg-paper-bright shadow-[0_12px_50px_rgba(0,0,0,0.06)] overflow-hidden">
                    {children}
                </div>
            </div>
        </section>
    );
}