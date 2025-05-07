// Simple build script for large projects
import { execSync } from 'child_process';

console.log('Starting optimized build process...');

// First build the client files with increased memory
try {
  console.log('Building client...');
  execSync('NODE_OPTIONS="--max-old-space-size=4096" npx vite build --minify esbuild', {
    stdio: 'inherit'
  });
  console.log('Client build complete!');
} catch (error) {
  console.error('Error building client:', error.message);
  process.exit(1);
}

// Then build the server files
try {
  console.log('Building server...');
  execSync('npx esbuild --no-check --no-fail server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist', {
    stdio: 'inherit'
  });
  console.log('Server build complete!');
} catch (error) {
  console.error('Error building server:', error.message);
  process.exit(1);
}

console.log('Build completed successfully!');