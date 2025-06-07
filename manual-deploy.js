#!/usr/bin/env node
/**
 * This script manually handles the full deployment process
 * by directly running the necessary commands without using package.json scripts.
 */
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

// Function to execute commands and log output
async function runCommand(command) {
  console.log(`\n=== Running: ${command} ===`);
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
async function deploy() {
  console.log('Starting manual deployment process...');
  
  // Step 1: Build the client with Vite directly
  console.log('\n=== Building client with Vite ===');
  const clientBuildSuccess = await runCommand('npx vite build');
  if (!clientBuildSuccess) {
    console.error('Client build failed');
    process.exit(1);
  }

  // Step 2: Build the server with esbuild directly (without the problematic --no-check flag)
  console.log('\n=== Building server with esbuild ===');
  const serverBuildSuccess = await runCommand('npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --target=es2015 --outdir=dist');
  if (!serverBuildSuccess) {
    console.error('Server build failed');
    process.exit(1);
  }

  console.log('\n=== Build completed successfully! ===');
  console.log('The application is now ready for deployment on Replit.');
}

deploy().catch(error => {
  console.error('Deployment process failed:', error);
  process.exit(1);
});