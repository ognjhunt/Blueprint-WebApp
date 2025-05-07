# Deployment Instructions for Blueprint AR

There was an issue with the default build script in `package.json` that contains an invalid esbuild flag `--no-check`. This flag was causing deployment failures.

## How to Deploy

To deploy this application on Replit, please follow these steps:

1. **Use the custom deploy script**:
   
   Instead of relying on the default build process, use the provided `deploy.js` script by running:
   ```
   node deploy.js
   ```
   
   This script correctly builds both the client (with Vite) and the server (with esbuild) without the problematic flag.

2. **After building successfully**, you can deploy using Replit's deployment interface or by running:
   ```
   npm run start
   ```
   to test the production build locally before deployment.

## Common Deployment Issues

If you encounter deployment errors, check the following:

1. Make sure you've run `node deploy.js` first to create a proper build
2. Verify that the `dist` directory contains the built files
3. Ensure all environment variables are properly set in Replit Secrets

## Troubleshooting

If deployment still fails, try:

1. Clearing the previous build by removing the `dist` directory:
   ```
   rm -rf dist
   ```

2. Running the deployment script again:
   ```
   node deploy.js
   ```

3. If problems persist, you may need to manually edit the deployment configuration in Replit's interface to use `node deploy.js` as the build command.