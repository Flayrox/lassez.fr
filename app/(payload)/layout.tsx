/* THIS FILE WAS GENERATED AUTOMATICALLY BY PAYLOAD. */
/* DO NOT MODIFY IT BECAUSE IT COULD BE REWRITTEN AT ANY TIME. */
import config from '@payload-config';
import '@payloadcms/next/css';
import { RootLayout, handleServerFunctions } from '@payloadcms/next/layouts';
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

const Layout = ({ children }: Args) =>
    RootLayout({
        children,
        config,
        importMap,
        serverFunction,
    });

export default Layout;
