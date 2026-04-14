/* THIS FILE WAS GENERATED AUTOMATICALLY BY PAYLOAD. */
/* DO NOT MODIFY IT BECAUSE IT COULD BE REWRITTEN AT ANY TIME. */
import config from '@payload-config';
import '@payloadcms/next/css';
import { getNavPrefs } from '@payloadcms/next/dist/elements/Nav/getNavPrefs.js';
import { getRequestTheme } from '@payloadcms/next/dist/utilities/getRequestTheme.js';
import { handleServerFunctions } from '@payloadcms/next/layouts';
import { RootProvider, ProgressBar } from '@payloadcms/ui';
import { getClientConfig } from '@payloadcms/ui/utilities/getClientConfig';
import { rtlLanguages } from '@payloadcms/translations';
import { initReq } from '@payloadcms/next/dist/utilities/initReq.js';
import React from 'react';

import { importMap } from './admin/importMap.js';
import './custom.scss';

type Args = {
    children: React.ReactNode;
};

const serverFunction = async (
    ...args: Parameters<typeof handleServerFunctions>
) => {
    'use server';

    return handleServerFunctions(...args);
};

const Layout = async ({ children }: Args) => {
    const {
        cookies,
        headers,
        languageCode,
        permissions,
        req,
        req: {
            payload: {
                config: payloadConfig,
            },
        },
    } = await initReq({
        configPromise: config,
        importMap,
        key: 'PayloadLayoutWithoutNestedDocument',
    });

    const theme = getRequestTheme({
        config: payloadConfig,
        cookies,
        headers,
    });

    const _dir = rtlLanguages.includes(languageCode) ? 'RTL' : 'LTR';

    const languageOptions = Object.entries(payloadConfig.i18n.supportedLanguages || {}).reduce((acc, [language, languageConfig]) => {
        if (Object.keys(payloadConfig.i18n.supportedLanguages || {}).includes(language)) {
            acc.push({
                label: (languageConfig as any).translations.general.thisLanguage,
                value: language,
            });
        }
        return acc;
    }, [] as any[]);

    const navPrefs = await getNavPrefs(req);

    const clientConfig = getClientConfig({
        config: payloadConfig,
        i18n: req.i18n,
        importMap: req.payload.importMap,
        user: req.user,
    });

    return (
        <>
            <RootProvider
                config={clientConfig}
                dateFNSKey={req.i18n.dateFNSKey}
                fallbackLang={payloadConfig.i18n.fallbackLanguage}
                isNavOpen={navPrefs?.open ?? true}
                languageCode={languageCode}
                languageOptions={languageOptions}
                locale={req.locale}
                permissions={req.user ? permissions : null}
                serverFunction={serverFunction}
                theme={theme}
                translations={req.i18n.translations}
                user={req.user}
            >
                <ProgressBar />
                {children}
            </RootProvider>
            <div id="portal" />
        </>
    );
};

export default Layout;
