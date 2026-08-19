import { EntityType, groupNavItems } from '@payloadcms/ui/shared';
import { RenderServerComponent } from '@payloadcms/ui/elements/RenderServerComponent';
import { AdminNavClient } from './AdminNavClient';

/**
 * Nav d'admin personnalisée (admin.components.Nav).
 *
 * Reproduit la sidebar Payload par défaut (mêmes groupes et mêmes liens que
 * `DefaultNav`) et ajoute le lien « Cockpit Radar » DANS le groupe « Radar »,
 * à côté de radar-settings, signals, sources… — au lieu d'un lien isolé tout
 * en bas (afterNavLinks), difficile à trouver et hors de tout groupe.
 */
export default async function AdminNav(props: any) {
    const { i18n, payload, permissions, visibleEntities } = props;
    const { admin: { components: { afterNavLinks, beforeNavLinks } = {} }, collections, globals } = payload.config;

    const groups: any[] = groupNavItems(
        [
            ...collections
                .filter((collection: any) => visibleEntities?.collections?.includes(collection.slug))
                .map((collection: any) => ({ type: EntityType.collection, entity: collection })),
            ...globals
                .filter((global: any) => visibleEntities?.globals?.includes(global.slug))
                .map((global: any) => ({ type: EntityType.global, entity: global })),
        ],
        permissions,
        i18n,
    );

    // Insère le cockpit dans le groupe « Investigation » (celui qui contient
    // radar-settings) ; si absent, crée le groupe.
    const cockpit = { slug: 'radar', type: 'custom', label: 'Cockpit d’investigation' };
    const radarGroup = groups.find((group: any) =>
        group.entities?.some(
            (entity: any) => entity.slug === 'radar-settings' && entity.type === EntityType.global,
        ),
    );
    if (radarGroup) {
        radarGroup.entities.push(cockpit);
    } else {
        groups.push({ label: 'Investigation', entities: [cockpit] });
    }

    const serverProps = { ...props };
    return (
        <AdminNavClient
            groups={groups}
            beforeNavLinks={RenderServerComponent({
                Component: beforeNavLinks,
                importMap: payload.importMap,
                serverProps,
            })}
            afterNavLinks={RenderServerComponent({
                Component: afterNavLinks,
                importMap: payload.importMap,
                serverProps,
            })}
        />
    );
}
