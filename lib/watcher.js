/**
 * Watch mode - monitor file changes and update context incrementally
 */

import chokidar from 'chokidar';
import { readFile, writeFile, mkdir, unlink, readdir } from 'node:fs/promises';
import { join, relative, dirname, extname } from 'node:path';
import { parseJavaFile, generateL0, generateL1 } from './java-parser.js';
import { buildContextIndex, saveIndex } from './search.js';

// Debounce helper
function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

// Update a single file's context
async function updateSingleFile(filePath, projectPath, contextDir) {
  const relativePath = relative(projectPath, filePath);
  const dirPath = dirname(relativePath);
  
  try {
    const content = await readFile(filePath, 'utf-8');
    const parsed = parseJavaFile(content);
    
    // Update L1 overview for this directory
    const overviewDir = join(contextDir, dirPath);
    await mkdir(overviewDir, { recursive: true });
    
    // Read existing overview or create new
    const overviewPath = join(overviewDir, '_overview.md');
    let existingFiles = {};
    
    try {
      const existing = await readFile(overviewPath, 'utf-8');
      // Parse existing overview to preserve other files
      const fileBlocks = existing.split(/^## /m).slice(1);
      for (const block of fileBlocks) {
        const lines = block.split('\n');
        const file = lines[0].trim();
        existingFiles[file] = block;
      }
    } catch (e) {
      // No existing overview
    }
    
    // Update this file's entry
    const l1Content = generateL1(parsed.pkg, parsed.imports, parsed.types);
    existingFiles[relativePath] = `${relativePath}\n\n\`\`\`java\n${l1Content}\`\`\`\n`;
    
    // Write updated overview
    const overviewContent = Object.entries(existingFiles)
      .map(([file, content]) => `## ${content}`)
      .join('\n');
    
    await writeFile(overviewPath, `# ${dirPath || 'root'} Overview (L1)\n\n${overviewContent}`);
    
    return { relativePath, types: parsed.types };
  } catch (err) {
    console.error(`  ✗ ${relativePath}: ${err.message}`);
    return null;
  }
}

// Rebuild L0 index from all L1 overviews
async function rebuildL0Index(contextDir, projectPath) {
  const l0Lines = [];
  
  async function walkOverviews(dir) {
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          await walkOverviews(fullPath);
        } else if (entry.name === '_overview.md') {
          const content = await readFile(fullPath, 'utf-8');
          // Extract file entries from overview
          const matches = content.matchAll(/^## (.+\.java)$/gm);
          for (const match of matches) {
            const filePath = match[1];
            // Extract types from the code block
            const typeMatch = content.match(new RegExp(`## ${filePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?\`\`\`java\\n([\\s\\S]*?)\`\`\``));
            if (typeMatch) {
              const types = [];
              const classMatches = typeMatch[1].matchAll(/(?:class|interface|enum)\s+(\w+)/g);
              for (const cm of classMatches) types.push(cm[1]);
              l0Lines.push(`- ${filePath}${types.length ? ` (${types.join(', ')})` : ''}`);
            }
          }
        }
      }
    } catch (e) {
      // Directory doesn't exist yet
    }
  }
  
  await walkOverviews(contextDir);
  await writeFile(join(contextDir, 'index.md'), `# Project Index (L0)\n\n${l0Lines.join('\n')}\n`);
}

// Start watching
export async function watchContext(projectPath, options) {
  const { output, lang } = options;
  const contextDir = join(projectPath, output);
  
  await mkdir(contextDir, { recursive: true });
  
  const extensions = lang === 'java' ? '.java' : '.java';
  const pattern = `${projectPath}/**/*${extensions}`;
  
  console.log(`Watching ${projectPath} for ${lang} file changes...`);
  console.log('Press Ctrl+C to stop.\n');
  
  // Debounced index rebuild
  const debouncedRebuild = debounce(async () => {
    console.log('  Rebuilding index...');
    await rebuildL0Index(contextDir, projectPath);
    const index = await buildContextIndex(contextDir);
    await saveIndex(index, join(contextDir, 'search-index.json'));
    console.log('  ✓ Index updated\n');
  }, 500);
  
  const watcher = chokidar.watch(pattern, {
    ignored: /(node_modules|\.git|\.context|target|build|dist)/,
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 100,
      pollInterval: 50
    }
  });
  
  watcher
    .on('add', async (path) => {
      console.log(`+ ${relative(projectPath, path)}`);
      await updateSingleFile(path, projectPath, contextDir);
      debouncedRebuild();
    })
    .on('change', async (path) => {
      console.log(`~ ${relative(projectPath, path)}`);
      await updateSingleFile(path, projectPath, contextDir);
      debouncedRebuild();
    })
    .on('unlink', async (path) => {
      console.log(`- ${relative(projectPath, path)}`);
      // TODO: Remove from overview
      debouncedRebuild();
    })
    .on('error', (err) => {
      console.error('Watcher error:', err.message);
    });
  
  // Keep process alive
  return new Promise(() => {});
}
