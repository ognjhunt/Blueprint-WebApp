# Deployment Instructions for Blueprint AR

There is an issue with the default build script in `package.json` that contains an invalid esbuild flag `--no-check`. This flag is causing deployment failures. We've provided several solutions to fix this issue.

## Method 1: Pre-Deployment Script (Recommended)

This method fixes the package.json file before deployment:

1. **Run the pre-deployment script**:
   ```
   node pre-deploy.js
   ```
   This creates a backup of your package.json and modifies the build script to remove the problematic flag.

2. **Deploy your application** using Replit's deployment interface.

3. **Restore your original package.json** after deployment (optional):
   ```
   mv package.json.bak package.json
   ```

## Method 2: Manual Deployment

If Method 1 doesn't work, use the manual deployment script:

1. **Run the manual deployment script**:
   ```
   node manual-deploy.js
   ```
   
   This script bypasses package.json and correctly builds both the client and server components without the problematic flag.

2. **Deploy from the Replit interface** after the script successfully completes.

## Method 3: Fixing Deployment in Replit's Interface

If you prefer to use Replit's deployment interface directly:

1. Start the deployment process in Replit
2. When prompted for a build command, replace the default with:
   ```
   npx vite build && npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist
   ```
3. Continue with the deployment process

## Troubleshooting

If you encounter deployment errors:

1. Clear the previous build by removing the `dist` directory:
   ```
   rm -rf dist
   ```

2. Try a different method from those listed above

3. Ensure all environment variables are properly set in Replit Secrets

4. If you're still facing issues, check the deployment logs for specific error messages