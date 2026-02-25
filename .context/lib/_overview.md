# lib Overview (L1)

## lib/context.js

```javascript
imports: node:fs/promises, node:path
local: 4 modules

function initContext(projectPath: any, options: any): void
function updateContext(projectPath: any, options: any): void
function queryContext(projectPath: any, keyword: any, options: any): void```

## lib/go-parser.js

```javascript
imports: fmt

exports: parseGoFile, generateL0, generateL1

type Name = OtherType
  const aliasMatches = content.matchAll(/type\s+(\w+)\s*=\s*(\S+)/g)

function parseGoFile(content: any): void
function generateL0(filePath: any, parsed: any): void
function generateL1(parsed: any): void```

## lib/hooks.js

```javascript
imports: node:fs/promises, node:path, node:url

function installHook(projectPath: any): void```

## lib/java-parser.js

```javascript
imports: tree-sitter, tree-sitter-java

exports: parseJavaSource, extractPackage, extractImports, groupImports, extractTypes, extractMethods, extractFields, generateL0, generateL1, parseJavaFile

function parseJavaSource(content: any): void
function extractPackage(tree: any): void
function extractImports(tree: any): void
function groupImports(imports: any): void
function extractTypes(tree: any): void
function extractMethods(body: any): void
function extractFields(body: any): void
function generateL0(filePath: any, types: any): void
function generateL1(pkg: any, imports: any, types: any): void
function parseJavaFile(content: any): void```

## lib/search.js

```javascript
imports: node:fs/promises, node:path

exports: buildIndex, searchIndex

function buildIndex(documents: any): void
function searchIndex(index: any, query: any, topK: any): void
function saveIndex(index: any, path: any): void
function loadIndex(path: any): void
function buildContextIndex(contextDir: any): void```

## lib/ts-parser.js

```javascript
imports: module, module, module, module

exports: a, b, parseTsFile, name, generateL0, generateL1, default

interface Name

type Name = ...
  const typeMatches = content.matchAll(/(?:export\s+)?type\s+(\w+)(?:<[^>]+>)?\s*=\s*([^

enum Name { ... }

class Name extends Base implements Interface

function parseTsFile(content: any): void
function name(params: any): returnType
function name(params: any): returnType
function name(params: any): returnType
function generateL0(filePath: any, parsed: any): void
function generateL1(parsed: any): void```

## lib/watcher.js

```javascript
imports: chokidar, node:fs/promises, node:path
local: 2 modules

function watchContext(projectPath: any, options: any): void```
