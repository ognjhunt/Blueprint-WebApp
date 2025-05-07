#!/usr/bin/env node
/**
 * This script creates a temporary package.json file with a corrected build script
 * for Replit deployment. It removes the --no-check flag that's causing build failures.
 */
import fs from 'fs/promises';
import path from 'path';

async function fixPackageJson() {
  try {
    console.log('Reading original package.json...');
    const packageJsonContent = await fs.readFile('package.json', 'utf8');
    const packageJson = JSON.parse(packageJsonContent);
    
    // Create a backup
    await fs.writeFile('package.json.bak', packageJsonContent);
    console.log('Backup created as package.json.bak');
    
    // Fix the build script by removing the --no-check flag
    if (packageJson.scripts && packageJson.scripts.build) {
      const originalBuildScript = packageJson.scripts.build;
      console.log('Original build script:', originalBuildScript);
      
      // Replace the problematic flag
      const fixedBuildScript = originalBuildScript.replace('--no-check', '');
      packageJson.scripts.build = fixedBuildScript;
      
      console.log('Fixed build script:', packageJson.scripts.build);
      
      // Write the fixed package.json
      await fs.writeFile('package.json', JSON.stringify(packageJson, null, 2));
      console.log('package.json updated successfully with fixed build script');
      
      return true;
    } else {
      console.log('Build script not found in package.json!');
      return false;
    }
  } catch (error) {
    console.error('Error fixing package.json:', error);
    return false;
  }
}

async function main() {
  console.log('Starting pre-deployment script...');
  const success = await fixPackageJson();
  
  if (success) {
    console.log('Pre-deployment setup completed successfully!');
    console.log('Now you can proceed with deployment using the standard Replit deployment process.');
    console.log('After deployment, you may restore the original package.json by renaming package.json.bak to package.json.');
  } else {
    console.error('Pre-deployment setup failed!');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Pre-deployment script failed:', error);
  process.exit(1);
});