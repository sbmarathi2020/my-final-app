import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
            manifest: {
                name: 'Vihaan Tracker',
                short_name: 'Vihaan',
                description: 'Financial Management App',
                theme_color: '#2563eb', // तुमच्या ॲपचा मुख्य निळा रंग
                background_color: '#ffffff',
                display: 'standalone', // यामुळे हे ॲपसारखे दिसेल (ब्राउझर बार दिसणार नाही)
                icons: [
                    {
                        src: 'pwa-192x192.png',
                        sizes: '192x192',
                        type: 'image/png'
                    },
                    {
                        src: 'pwa-512x512.png',
                        sizes: '512x512',
                        type: 'image/png'
                    }
                ]
            }
        })
    ]
});