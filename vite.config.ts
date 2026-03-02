import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { crx } from '@crxjs/vite-plugin';
import { resolve } from 'path';
import manifest from './manifest.json';

export default defineConfig({
    base: '',
    plugins: [
        vue(),
        crx({ manifest }),
    ],
    resolve: {
        alias: {
            '@': '/src',
        },
    },
    build: {},
});
