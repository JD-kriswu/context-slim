/**
 * Git hooks installer
 */

import { readFile, writeFile, mkdir, chmod, access, constants } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function installHook(projectPath) {
  const gitDir = join(projectPath, '.git');
  const hooksDir = join(gitDir, 'hooks');
  const hookPath = join(hooksDir, 'pre-commit');
  
  // Check if .git exists
  try {
    await access(gitDir, constants.F_OK);
  } catch (e) {
    console.error('Error: Not a git repository (no .git directory)');
    process.exit(1);
  }
  
  // Read hook template
  const templatePath = join(__dirname, '..', 'hooks', 'pre-commit');
  let hookContent;
  try {
    hookContent = await readFile(templatePath, 'utf-8');
  } catch (e) {
    // Inline fallback
    hookContent = `#!/bin/sh
# context-slim pre-commit hook
PROJECT_ROOT=$(git rev-parse --show-toplevel)
if command -v context-slim >/dev/null 2>&1; then
  echo "Updating .context/..."
  context-slim update "$PROJECT_ROOT"
  git add "$PROJECT_ROOT/.context/"
fi
`;
  }
  
  // Check for existing hook
  try {
    const existing = await readFile(hookPath, 'utf-8');
    if (existing.includes('context-slim')) {
      console.log('Hook already installed.');
      return;
    }
    // Append to existing hook
    hookContent = existing + '\n\n# context-slim hook\n' + hookContent.split('\n').slice(1).join('\n');
    console.log('Appending to existing pre-commit hook...');
  } catch (e) {
    // No existing hook
  }
  
  // Write hook
  await mkdir(hooksDir, { recursive: true });
  await writeFile(hookPath, hookContent);
  await chmod(hookPath, 0o755);
  
  console.log(`✓ Installed pre-commit hook at ${hookPath}`);
  console.log('  Context will auto-update on each commit.');
}
