/* THIS FILE WAS GENERATED AUTOMATICALLY BY PAYLOAD. */
/* DO NOT MODIFY IT BECAUSE IT COULD BE REWRITTEN AT ANY TIME. */
import config from '@payload-config';
import '@payloadcms/next/css';
import { handleServerFunctions } from '@payloadcms/next/layouts';
import { RootProvider, ProgressBar } from '@payloadcms/ui';
import React from 'react';

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
    const payloadConfig = await config;
    const supportedLanguages = (payloadConfig.i18n?.supportedLanguages || {}) as Record<string, any>;
    const fallbackLanguage = String(payloadConfig.i18n?.fallbackLanguage || 'en');
    const chosenLanguage = supportedLanguages[fallbackLanguage] ? fallbackLanguage : (Object.keys(supportedLanguages)[0] || 'en');
    const chosenLanguageConfig = supportedLanguages[chosenLanguage] || {};

    const languageOptions = Object.entries(supportedLanguages).map(([value, langConfig]) => ({
        label: String((langConfig as any)?.translations?.general?.thisLanguage || value),
        value,
    })) as any;

    return (
        <>
            <RootProvider
                config={payloadConfig as any}
                dateFNSKey={(chosenLanguageConfig as any)?.dateFNSKey || 'en-US'}
                fallbackLang={payloadConfig.i18n?.fallbackLanguage}
                isNavOpen={true}
                languageCode={chosenLanguage}
                languageOptions={languageOptions}
                locale={undefined}
                permissions={null}
                serverFunction={serverFunction}
                theme={'light'}
                translations={(chosenLanguageConfig as any)?.translations || {}}
                user={null}
            >
                <ProgressBar />
                {children}
            </RootProvider>
            <div id="portal" />
        </>
    );
};

export default Layout;
