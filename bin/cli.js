#!/usr/bin/env node

import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { initContext, updateContext, queryContext } from '../lib/context.js';
import { watchContext } from '../lib/watcher.js';
import { installHook } from '../lib/hooks.js';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    help: { type: 'boolean', short: 'h' },
    output: { type: 'string', short: 'o', default: '.context' },
    lang: { type: 'string', short: 'l', default: 'java' },
    top: { type: 'string', short: 'n', default: '5' },
  }
});

const [command, ...args] = positionals;

if (values.help || !command) {
  console.log(`
context-slim - L0/L1/L2 context optimization for LLM coding assistants

Usage:
  context-slim init [path]              Scan project and generate L0/L1 summaries
  context-slim update [path]            Update summaries for changed files
  context-slim watch [path]             Watch for changes and update incrementally
  context-slim query <keyword> [path]   Search context by keyword (vector search)
  context-slim hook [path]              Install git pre-commit hook

Options:
  -o, --output <dir>   Output directory (default: .context)
  -l, --lang <lang>    Language: java (default: java)
  -n, --top <num>      Number of results for query (default: 5)
  -h, --help           Show this help
`);
  process.exit(0);
}

try {
  switch (command) {
    case 'init': {
      const projectPath = resolve(args[0] || '.');
      await initContext(projectPath, values);
      break;
    }
    case 'update': {
      const projectPath = resolve(args[0] || '.');
      await updateContext(projectPath, values);
      break;
    }
    case 'watch': {
      const projectPath = resolve(args[0] || '.');
      await watchContext(projectPath, values);
      break;
    }
    case 'hook': {
      const projectPath = resolve(args[0] || '.');
      await installHook(projectPath);
      break;
    }
    case 'query': {
      const keyword = args[0];
      const projectPath = resolve(args[1] || '.');
      if (!keyword) {
        console.error('Usage: context-slim query <keyword> [path]');
        process.exit(1);
      }
      await queryContext(projectPath, keyword, { ...values, top: parseInt(values.top) });
      break;
    }
    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}
