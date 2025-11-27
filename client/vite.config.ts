import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
            "@shared": path.resolve(__dirname, "./shared"), // If shared is inside client, or adjust if outside
        },
    },
    server: {
        host: '0.0.0.0',
        port: 5173,
    }
})
