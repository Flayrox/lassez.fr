/* THIS FILE WAS GENERATED AUTOMATICALLY BY PAYLOAD. */
/* DO NOT MODIFY IT BECAUSE IT COULD BE REWRITTEN AT ANY TIME. */
import config from '@payload-config';
import '@payloadcms/next/css';
import { RootLayout, handleServerFunctions } from '@payloadcms/next/layouts';
import React from 'react';

import './custom.scss';
import { importMap } from './admin/importMap.js';

type Args = {
    children: React.ReactNode;
};

const serverFunction = async (
    ...args: Parameters<typeof handleServerFunctions>
) => {
    'use server';

    const [serverFnArgs] = args;

    return handleServerFunctions({
        ...serverFnArgs,
        config,
        importMap,
    });
};

const Layout = ({ children }: Args) =>
    RootLayout({
        children,
        config,
        importMap,
        serverFunction,
    });

export default Layout;
