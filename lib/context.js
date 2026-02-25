/**
 * Context generator - scans project and generates L0/L1/L2 summaries
 * Supports: Java, Go, TypeScript/JavaScript
 */

import { readdir, readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { join, relative, dirname, extname } from 'node:path';
import { parseJavaFile, generateL0 as generateJavaL0, generateL1 as generateJavaL1 } from './java-parser.js';
import { parseGoFile, generateL0 as generateGoL0, generateL1 as generateGoL1 } from './go-parser.js';
import { parseTsFile, generateL0 as generateTsL0, generateL1 as generateTsL1 } from './ts-parser.js';
import { buildContextIndex, saveIndex, loadIndex, searchIndex } from './search.js';

// Language configurations
const LANG_CONFIG = {
  java: {
    extensions: ['.java'],
    parse: parseJavaFile,
    generateL0: (path, parsed) => generateJavaL0(path, parsed.types),
    generateL1: (parsed) => generateJavaL1(parsed.pkg, parsed.imports, parsed.types),
    codeBlock: 'java'
  },
  go: {
    extensions: ['.go'],
    parse: parseGoFile,
    generateL0: generateGoL0,
    generateL1: generateGoL1,
    codeBlock: 'go'
  },
  typescript: {
    extensions: ['.ts', '.tsx'],
    parse: parseTsFile,
    generateL0: generateTsL0,
    generateL1: generateTsL1,
    codeBlock: 'typescript'
  },
  javascript: {
    extensions: ['.js', '.jsx', '.mjs'],
    parse: parseTsFile,  // Same parser works for JS
    generateL0: generateTsL0,
    generateL1: generateTsL1,
    codeBlock: 'javascript'
  }
};

// Auto-detect language from project
async function detectLanguage(projectPath) {
  const indicators = {
    java: ['pom.xml', 'build.gradle', 'build.gradle.kts'],
    go: ['go.mod', 'go.sum'],
    typescript: ['tsconfig.json'],
    javascript: ['package.json']
  };
  
  for (const [lang, files] of Object.entries(indicators)) {
    for (const file of files) {
      try {
        await stat(join(projectPath, file));
        return lang;
      } catch (e) {
        // File doesn't exist
      }
    }
  }
  
  return null;
}

// Get all supported extensions for multi-language mode
function getAllExtensions() {
  const exts = new Set();
  for (const config of Object.values(LANG_CONFIG)) {
    config.extensions.forEach(e => exts.add(e));
  }
  return [...exts];
}

// Get language config by file extension
function getLangByExt(ext) {
  for (const [lang, config] of Object.entries(LANG_CONFIG)) {
    if (config.extensions.includes(ext)) {
      return { lang, config };
    }
  }
  return null;
}

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
        if (['node_modules', '.git', 'target', 'build', 'dist', '.context', 'vendor', '__pycache__'].includes(entry.name)) continue;
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
  const { output } = options;
  let { lang } = options;
  const contextDir = join(projectPath, output);
  
  // Auto-detect or use 'all' for multi-language
  if (!lang || lang === 'auto') {
    lang = await detectLanguage(projectPath);
    if (lang) {
      console.log(`Auto-detected language: ${lang}`);
    } else {
      lang = 'all';
      console.log('No specific language detected, scanning all supported files...');
    }
  }
  
  // Determine extensions to scan
  const extensions = lang === 'all' ? getAllExtensions() : (LANG_CONFIG[lang]?.extensions || ['.java']);
  
  console.log(`Scanning ${projectPath} for ${lang === 'all' ? 'all supported' : lang} files...`);
  
  // Find source files
  const files = await findFiles(projectPath, extensions);
  
  console.log(`Found ${files.length} files`);
  
  // Parse all files
  const l0Lines = [];
  const l1ByDir = {};
  
  for (const filePath of files) {
    const relativePath = relative(projectPath, filePath);
    const dirPath = dirname(relativePath);
    const ext = extname(filePath);
    
    // Get appropriate parser
    const langInfo = getLangByExt(ext);
    if (!langInfo) continue;
    
    const { config } = langInfo;
    
    try {
      const content = await readFile(filePath, 'utf-8');
      const parsed = config.parse(content);
      
      // Generate L0
      const l0 = config.generateL0(relativePath, parsed);
      l0Lines.push(l0);
      
      // Generate L1 (grouped by directory)
      if (!l1ByDir[dirPath]) l1ByDir[dirPath] = { files: [], codeBlock: config.codeBlock };
      l1ByDir[dirPath].files.push({
        file: relativePath,
        content: config.generateL1(parsed),
        codeBlock: config.codeBlock
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
  for (const [dirPath, data] of Object.entries(l1ByDir)) {
    const overviewDir = join(contextDir, dirPath);
    await mkdir(overviewDir, { recursive: true });
    
    const overviewContent = data.files.map(f => 
      `## ${f.file}\n\n\`\`\`${f.codeBlock}\n${f.content}\`\`\`\n`
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
