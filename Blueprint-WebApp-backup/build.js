#!/usr/bin/env node

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Function to execute commands and log output
async function runCommand(command) {
  console.log(`Running: ${command}`);
  try {
    const { stdout, stderr } = await execAsync(command);
    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);
    return true;
  } catch (error) {
    console.error(`Error executing command: ${command}`);
    console.error(error.message);
    return false;
  }
}

// Main build function
async function build() {
  // Build the client with Vite
  const clientBuildSuccess = await runCommand('vite build');
  if (!clientBuildSuccess) {
    console.error('Client build failed');
    process.exit(1);
  }

  // Build the server with esbuild (without the problematic --no-check flag)
  const serverBuildSuccess = await runCommand('esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist');
  if (!serverBuildSuccess) {
    console.error('Server build failed');
    process.exit(1);
  }

  console.log('Build completed successfully!');
}

build().catch(error => {
  console.error('Build process failed:', error);
  process.exit(1);
});