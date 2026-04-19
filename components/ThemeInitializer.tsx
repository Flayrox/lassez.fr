'use client';

import { useEffect } from 'react';

export default function ThemeInitializer() {
    useEffect(() => {
        const isRedTheme = localStorage.getItem('theme') === 'red';

        if (isRedTheme) {
            document.body.classList.add('theme-red');
        } else {
            document.body.classList.remove('theme-red');
        }
    }, []);

    return null;
}
