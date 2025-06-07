#!/usr/bin/env node

/**
 * Fix build script that uses the clean vite configuration without test properties
 */

import { execSync } from 'child_process';

console.log('🔧 Building with clean configuration...');

try {
  // Use the clean vite config for building
  console.log('🏗️ Building client...');
  execSync('npx vite build --config vite.config.build.ts', { stdio: 'inherit' });
  
  console.log('🏗️ Building server...');
  execSync('npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --target=es2015 --outdir=dist', { stdio: 'inherit' });
  
  console.log('✅ Build completed successfully!');
  
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}