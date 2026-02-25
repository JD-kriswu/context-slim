/**
 * Context generator - scans project and generates L0/L1/L2 summaries
 */

import { readdir, readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { join, relative, dirname, extname } from 'node:path';
import { parseJavaFile, generateL0, generateL1 } from './java-parser.js';
import { buildContextIndex, saveIndex, loadIndex, searchIndex } from './search.js';

// Recursively find all files with given extensions
async function findFiles(dir, extensions, ignore = []) {
  const results = [];
  
  async function walk(currentDir) {
    const entries = await readdir(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);
      const relativePath = relative(dir, fullPath);
      
      // Skip ignored paths
      if (ignore.some(pattern => relativePath.includes(pattern))) continue;
      
      if (entry.isDirectory()) {
        // Skip common non-source directories
        if (['node_modules', '.git', 'target', 'build', 'dist', '.context'].includes(entry.name)) continue;
        await walk(fullPath);
      } else if (extensions.includes(extname(entry.name))) {
        results.push(fullPath);
      }
    }
  }
  
  await walk(dir);
  return results;
}

// Initialize context for a project
export async function initContext(projectPath, options) {
  const { output, lang } = options;
  const contextDir = join(projectPath, output);
  
  console.log(`Scanning ${projectPath} for ${lang} files...`);
  
  // Find source files
  const extensions = lang === 'java' ? ['.java'] : ['.java'];
  const files = await findFiles(projectPath, extensions);
  
  console.log(`Found ${files.length} files`);
  
  // Parse all files
  const l0Lines = [];
  const l1ByDir = {};
  
  for (const filePath of files) {
    const relativePath = relative(projectPath, filePath);
    const dirPath = dirname(relativePath);
    
    try {
      const content = await readFile(filePath, 'utf-8');
      const parsed = parseJavaFile(content);
      
      // Generate L0
      const l0 = generateL0(relativePath, parsed.types);
      l0Lines.push(l0);
      
      // Generate L1 (grouped by directory)
      if (!l1ByDir[dirPath]) l1ByDir[dirPath] = [];
      l1ByDir[dirPath].push({
        file: relativePath,
        content: generateL1(parsed.pkg, parsed.imports, parsed.types)
      });
      
      console.log(`  ✓ ${relativePath}`);
    } catch (err) {
      console.log(`  ✗ ${relativePath}: ${err.message}`);
    }
  }
  
  // Write L0 index
  await mkdir(contextDir, { recursive: true });
  await writeFile(
    join(contextDir, 'index.md'),
    `# Project Index (L0)\n\n${l0Lines.join('\n')}\n`
  );
  console.log(`\nWrote ${contextDir}/index.md`);
  
  // Write L1 overviews by directory
  for (const [dirPath, files] of Object.entries(l1ByDir)) {
    const overviewDir = join(contextDir, dirPath);
    await mkdir(overviewDir, { recursive: true });
    
    const overviewContent = files.map(f => 
      `## ${f.file}\n\n\`\`\`java\n${f.content}\`\`\`\n`
    ).join('\n');
    
    await writeFile(
      join(overviewDir, '_overview.md'),
      `# ${dirPath || 'root'} Overview (L1)\n\n${overviewContent}`
    );
  }
  console.log(`Wrote L1 overviews to ${contextDir}/*/`);
  
  // Generate CLAUDE.md snippet
  const claudeSnippet = `
## Context Structure

This project uses L0/L1/L2 context optimization.

- \`.context/index.md\` - L0: File index (one-liner per file)
- \`.context/*/_overview.md\` - L1: Structure summaries (signatures only)
- Source files - L2: Full code (load on demand)

When exploring the codebase:
1. Start with \`.context/index.md\` to find relevant files
2. Read \`.context/<dir>/_overview.md\` for structure
3. Only load full source when you need implementation details
`;
  
  await writeFile(join(contextDir, 'CLAUDE.md'), claudeSnippet.trim());
  console.log(`Wrote ${contextDir}/CLAUDE.md (copy to project root)`);
  
  // Build search index
  console.log('Building search index...');
  const index = await buildContextIndex(contextDir);
  await saveIndex(index, join(contextDir, 'search-index.json'));
  console.log(`Wrote ${contextDir}/search-index.json (${index.documents.length} documents indexed)`);
  
  console.log('\nDone! Add the CLAUDE.md content to your project root.');
}

// Update context for changed files
export async function updateContext(projectPath, options) {
  // TODO: Implement incremental update
  console.log('Incremental update not yet implemented. Running full init...');
  await initContext(projectPath, options);
}

// Query context by keyword (now uses vector search)
export async function queryContext(projectPath, keyword, options) {
  const { output } = options;
  const contextDir = join(projectPath, output);
  const indexPath = join(contextDir, 'search-index.json');
  
  try {
    // Try vector search first
    const index = await loadIndex(indexPath);
    const results = searchIndex(index, keyword, 10);
    
    if (results.length === 0) {
      console.log(`No matches for "${keyword}"`);
    } else {
      console.log(`Search results for "${keyword}":\n`);
      for (const result of results) {
        const score = (result.score * 100).toFixed(1);
        console.log(`[${score}%] ${result.file}`);
        // Show first few lines of matching content
        const preview = result.text.split('\n').slice(0, 3).join('\n  ');
        console.log(`  ${preview}\n`);
      }
    }
  } catch (err) {
    // Fallback to simple text search
    console.log('(Search index not found, using text search)');
    const indexMdPath = join(contextDir, 'index.md');
    
    try {
      const content = await readFile(indexMdPath, 'utf-8');
      const lines = content.split('\n').filter(line => 
        line.toLowerCase().includes(keyword.toLowerCase())
      );
      
      if (lines.length === 0) {
        console.log(`No matches for "${keyword}"`);
      } else {
        console.log(`Matches for "${keyword}":\n`);
        lines.forEach(line => console.log(line));
      }
    } catch (e) {
      console.error(`Context not initialized. Run 'context-slim init' first.`);
    }
  }
}
