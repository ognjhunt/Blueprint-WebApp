// @vitest-environment node
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { it, expect } from 'vitest';
it('rolls a dependent commit chain back without rewriting history', () => {
  const directory = mkdtempSync(join(tmpdir(), 'release-rollback-'));
  const git = (...args: string[]) => execFileSync('git', args, {cwd:directory,encoding:'utf8'}).trim();
  try {
    git('init'); git('config','user.email','test@example.test'); git('config','user.name','Release test');
    writeFileSync(join(directory,'copy.txt'),'first\n'); git('add','.'); git('commit','-m','first');
    const target = git('rev-parse','HEAD');
    for (const copy of ['second','third']) {
      writeFileSync(join(directory,'copy.txt'),`${copy}\n`); git('add','.'); git('commit','-m',copy);
    }
    execFileSync('node',[resolve('scripts/deploy-rollback.mjs'),'--target',target,'--verify-command','true'],{cwd:directory});
    expect(readFileSync(join(directory,'copy.txt'),'utf8')).toBe('first\n');
    expect(git('rev-list','--count','HEAD')).toBe('5');
  } finally { rmSync(directory,{recursive:true,force:true}); }
});
