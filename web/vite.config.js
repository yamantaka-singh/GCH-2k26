import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  test: {
    // GapLayer imports react-leaflet, which touches the DOM at module scope.
    environment: 'jsdom',
    globals: false,
  },
})
