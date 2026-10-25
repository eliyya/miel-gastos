import { defineConfig } from 'vite-plus'

export default defineConfig({
    lint: {
        plugins: ['nextjs', 'react'],
        ignorePatterns: ['.next/**', 'out/**', 'build/**', 'next-env.d.ts'],
    },
    fmt: {
        semi: false,
        singleQuote: true,
        trailingComma: 'all',
        arrowParens: 'avoid',
        tabWidth: 4,
        sortImports: true,
    },
})
