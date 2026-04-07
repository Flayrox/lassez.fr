import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['var(--font-inter)', 'sans-serif'],
                serif: ['var(--font-playfair)', 'serif'],
                mono: ['var(--font-jetbrains)', 'monospace'],
                headline: ['var(--font-newsreader)', 'serif'],
                label: ['var(--font-space-grotesk)', 'sans-serif'],
                body: ['var(--font-space-grotesk)', 'sans-serif'],
            },
            keyframes: {
                marquee: {
                    '0%': { transform: 'translateX(0%)' },
                    '100%': { transform: 'translateX(-100%)' },
                },
            },
            animation: {
                marquee: 'marquee 60s linear infinite',
            },
            colors: {
                'paper': 'var(--paper)',
                'paper-bright': 'var(--paper-bright)',
                'ink': 'var(--ink)',
                'lassez-red': 'var(--red)',
                'lassez-border': 'var(--border)',
                'marker-yellow': '#FEF08A',
            },
            boxShadow: {
                'hard': '4px 4px 0px 0px var(--shadow)',
                'hard-red': '4px 4px 0px 0px var(--red)',
                'hard-xl': '12px 12px 0px 0px var(--shadow)',
                'hard-sm': '2px 2px 0px 0px var(--shadow)',
            }
        },
    },
    plugins: [],
};
export default config;
