#!/usr/bin/env node
/**
 * This script serves as a deployment helper for Replit.
 * It correctly builds the application without the problematic esbuild flags.
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
  console.log('Starting deployment build process...');
  
  // First, build the client with Vite
  console.log('\n=== Building client with Vite ===');
  const clientBuildSuccess = await runCommand('vite build');
  if (!clientBuildSuccess) {
    console.error('Client build failed');
    process.exit(1);
  }

  // Then, build the server with esbuild correctly (without the problematic --no-check flag)
  console.log('\n=== Building server with esbuild ===');
  const serverBuildSuccess = await runCommand('esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist');
  if (!serverBuildSuccess) {
    console.error('Server build failed');
    process.exit(1);
  }

  console.log('\n=== Build completed successfully! ===');
  console.log('The application is now ready for deployment on Replit.');
}

deploy().catch(error => {
  console.error('Deployment build process failed:', error);
  process.exit(1);
});