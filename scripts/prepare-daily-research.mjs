import {spawnSync} from 'node:child_process';

if (process.env.BLUEPRINT_DAILY_RESEARCH_PACKAGE_BUILD === 'true') {
  const result = spawnSync('python3', ['scripts/install-daily-research.py'], {stdio: 'inherit'});
  if (result.error || result.status !== 0) process.exit(1);
}
