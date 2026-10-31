import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative assets + hash navigation work from /Nutrition-Os/ on GitHub Pages.
export default defineConfig({ plugins: [react()], base: './' });
