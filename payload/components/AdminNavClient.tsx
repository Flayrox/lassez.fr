'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Hamburger, Logout, NavGroup, useConfig, useNav } from '@payloadcms/ui';

const baseClass = 'nav';

type NavEntity = { slug: string; type: 'collections' | 'globals' | 'custom'; label: string };
type NavGroupData = { label: string; entities: NavEntity[] };

/**
 * Partie client de la nav d'admin : mêmes classes CSS que la sidebar Payload
 * native (nav, nav__wrap, nav__link…) pour un rendu identique, avec le lien
 * custom « Cockpit Radar » dans le groupe Radar.
 */
export function AdminNavClient({
    groups,
    beforeNavLinks,
    afterNavLinks,
}: {
    groups: NavGroupData[];
    beforeNavLinks: React.ReactNode;
    afterNavLinks: React.ReactNode;
}) {
    const pathname = usePathname();
    const { config } = useConfig();
    const adminRoute = config.routes.admin;
    const { hydrated, navOpen, navRef, shouldAnimate } = useNav();

    const classes = [baseClass];
    if (navOpen) classes.push(`${baseClass}--nav-open`);
    if (shouldAnimate) classes.push(`${baseClass}--nav-animate`);
    if (hydrated) classes.push(`${baseClass}--nav-hydrated`);

    return (
        <aside className={classes.join(' ')} inert={!navOpen ? true : undefined}>
            <div className={`${baseClass}__scroll`} ref={navRef}>
                <nav className={`${baseClass}__wrap`}>
                    {beforeNavLinks}
                    {groups.map((group) => (
                        <NavGroup key={group.label} label={group.label}>
                            {group.entities.map((entity) => {
                                const href =
                                    entity.type === 'collections'
                                        ? `${adminRoute}/collections/${entity.slug}`
                                        : entity.type === 'globals'
                                          ? `${adminRoute}/globals/${entity.slug}`
                                          : `${adminRoute}/radar`;
                                const id =
                                    entity.type === 'globals'
                                        ? `nav-global-${entity.slug}`
                                        : `nav-${entity.slug}`;
                                const isActive =
                                    pathname === href ||
                                    (pathname?.startsWith(href) &&
                                        (pathname[href.length] === '/' || pathname[href.length] === undefined));
                                return (
                                    <Link
                                        key={entity.slug}
                                        href={href}
                                        id={id}
                                        className={`${baseClass}__link`}
                                        prefetch={false}
                                    >
                                        {isActive && <div className={`${baseClass}__link-indicator`} />}
                                        <span className={`${baseClass}__link-label`}>{entity.label}</span>
                                    </Link>
                                );
                            })}
                        </NavGroup>
                    ))}
                    {afterNavLinks}
                    <div className={`${baseClass}__controls`}>
                        <Logout />
                    </div>
                </nav>
                <div className={`${baseClass}__header`}>
                    <div className={`${baseClass}__header-content`}>
                        <Hamburger closeIcon="collapse" isActive={navOpen} />
                    </div>
                </div>
            </div>
        </aside>
    );
}
