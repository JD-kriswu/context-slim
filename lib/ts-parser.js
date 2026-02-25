/**
 * TypeScript/JavaScript parser using regex (MVP)
 * TODO: upgrade to tree-sitter-typescript for accuracy
 */

// Parse TypeScript/JavaScript source file
export function parseTsFile(content) {
  const imports = extractImports(content);
  const exports = extractExports(content);
  const types = extractTypes(content);
  const functions = extractFunctions(content);
  const classes = extractClasses(content);
  
  return { imports, exports, types, functions, classes };
}

// Extract imports
function extractImports(content) {
  const imports = [];
  
  // import { a, b } from 'module'
  // import * as name from 'module'
  // import name from 'module'
  // import 'module'
  const importMatches = content.matchAll(/import\s+(?:(?:\{([^}]+)\}|(\*\s+as\s+\w+)|(\w+))\s+from\s+)?['"]([^'"]+)['"]/g);
  
  for (const m of importMatches) {
    const named = m[1]?.split(',').map(s => s.trim().split(/\s+as\s+/)[0]).filter(Boolean) || [];
    const namespace = m[2]?.replace('* as ', '') || null;
    const defaultImport = m[3] || null;
    const from = m[4];
    
    imports.push({ from, named, namespace, default: defaultImport });
  }
  
  // require('module')
  const requireMatches = content.matchAll(/(?:const|let|var)\s+(\w+)\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/g);
  for (const m of requireMatches) {
    imports.push({ from: m[2], named: [], namespace: null, default: m[1] });
  }
  
  return imports;
}

// Extract exports
function extractExports(content) {
  const exports = [];
  
  // export { a, b }
  const namedExports = content.matchAll(/export\s+\{([^}]+)\}/g);
  for (const m of namedExports) {
    const names = m[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0]).filter(Boolean);
    exports.push(...names);
  }
  
  // export const/let/var/function/class/type/interface
  const declExports = content.matchAll(/export\s+(?:default\s+)?(?:const|let|var|function|class|type|interface|enum)\s+(\w+)/g);
  for (const m of declExports) {
    exports.push(m[1]);
  }
  
  // export default
  if (content.includes('export default')) {
    exports.push('default');
  }
  
  return [...new Set(exports)];
}

// Extract type declarations (interface, type, enum)
function extractTypes(content) {
  const types = [];
  
  // interface Name { ... }
  const ifaceMatches = content.matchAll(/(?:export\s+)?interface\s+(\w+)(?:<[^>]+>)?\s*(?:extends\s+([^{]+))?\s*\{([^}]*)\}/g);
  for (const m of ifaceMatches) {
    const name = m[1];
    const extendsClause = m[2]?.trim() || null;
    const body = m[3];
    const members = parseInterfaceMembers(body);
    types.push({ kind: 'interface', name, extends: extendsClause, members });
  }
  
  // type Name = ...
  const typeMatches = content.matchAll(/(?:export\s+)?type\s+(\w+)(?:<[^>]+>)?\s*=\s*([^;]+)/g);
  for (const m of typeMatches) {
    types.push({ kind: 'type', name: m[1], definition: m[2].trim().slice(0, 100) });
  }
  
  // enum Name { ... }
  const enumMatches = content.matchAll(/(?:export\s+)?enum\s+(\w+)\s*\{([^}]*)\}/g);
  for (const m of enumMatches) {
    const name = m[1];
    const values = m[2].split(',').map(s => s.trim().split('=')[0].trim()).filter(Boolean);
    types.push({ kind: 'enum', name, values });
  }
  
  return types;
}

// Parse interface members
function parseInterfaceMembers(body) {
  const members = [];
  const lines = body.split(/[;\n]/);
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//')) continue;
    
    // Property: name: type or name?: type
    const propMatch = trimmed.match(/^(\w+)(\?)?:\s*(.+)/);
    if (propMatch) {
      members.push({
        kind: 'property',
        name: propMatch[1],
        optional: !!propMatch[2],
        type: propMatch[3]
      });
      continue;
    }
    
    // Method: name(params): returnType
    const methodMatch = trimmed.match(/^(\w+)\s*\(([^)]*)\)\s*:\s*(.+)/);
    if (methodMatch) {
      members.push({
        kind: 'method',
        name: methodMatch[1],
        params: methodMatch[2],
        returnType: methodMatch[3]
      });
    }
  }
  
  return members;
}

// Extract functions
function extractFunctions(content) {
  const functions = [];
  
  // function name(params): returnType { ... }
  // export function name(params): returnType { ... }
  // async function name(params): returnType { ... }
  const funcMatches = content.matchAll(/(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*(?:<[^>]+>)?\s*\(([^)]*)\)\s*(?::\s*([^{]+))?\s*\{/g);
  
  for (const m of funcMatches) {
    functions.push({
      name: m[1],
      params: parseParams(m[2]),
      returnType: m[3]?.trim() || 'void',
      exported: content.includes(`export function ${m[1]}`) || content.includes(`export async function ${m[1]}`)
    });
  }
  
  // Arrow functions: const name = (params): returnType => ...
  // const name: Type = (params) => ...
  const arrowMatches = content.matchAll(/(?:export\s+)?const\s+(\w+)\s*(?::\s*[^=]+)?\s*=\s*(?:async\s+)?\(([^)]*)\)\s*(?::\s*([^=]+))?\s*=>/g);
  
  for (const m of arrowMatches) {
    functions.push({
      name: m[1],
      params: parseParams(m[2]),
      returnType: m[3]?.trim() || 'unknown',
      exported: content.includes(`export const ${m[1]}`)
    });
  }
  
  return functions;
}

// Extract classes
function extractClasses(content) {
  const classes = [];
  
  // class Name extends Base implements Interface { ... }
  const classMatches = content.matchAll(/(?:export\s+)?(?:abstract\s+)?class\s+(\w+)(?:<[^>]+>)?(?:\s+extends\s+(\w+))?(?:\s+implements\s+([^{]+))?\s*\{/g);
  
  for (const m of classMatches) {
    const name = m[1];
    const extendsClause = m[2] || null;
    const implementsClause = m[3]?.split(',').map(s => s.trim()) || [];
    const isAbstract = content.includes(`abstract class ${name}`);
    const exported = content.includes(`export class ${name}`) || content.includes(`export abstract class ${name}`);
    
    // Extract class body (simplified - just get method signatures)
    const classStart = content.indexOf(`class ${name}`);
    const bodyStart = content.indexOf('{', classStart);
    let braceCount = 1;
    let bodyEnd = bodyStart + 1;
    while (braceCount > 0 && bodyEnd < content.length) {
      if (content[bodyEnd] === '{') braceCount++;
      if (content[bodyEnd] === '}') braceCount--;
      bodyEnd++;
    }
    const classBody = content.slice(bodyStart + 1, bodyEnd - 1);
    
    const methods = extractClassMethods(classBody);
    const properties = extractClassProperties(classBody);
    
    classes.push({
      name,
      extends: extendsClause,
      implements: implementsClause,
      abstract: isAbstract,
      exported,
      methods,
      properties
    });
  }
  
  return classes;
}

// Extract class methods
function extractClassMethods(body) {
  const methods = [];
  
  // method(params): returnType { ... }
  // async method(params): returnType { ... }
  // private/public/protected method(...)
  const methodMatches = body.matchAll(/(?:(public|private|protected)\s+)?(?:(static)\s+)?(?:(async)\s+)?(\w+)\s*\(([^)]*)\)\s*(?::\s*([^{]+))?\s*\{/g);
  
  for (const m of methodMatches) {
    // Skip constructor-like patterns that aren't methods
    if (['if', 'for', 'while', 'switch', 'catch', 'function'].includes(m[4])) continue;
    
    methods.push({
      name: m[4],
      visibility: m[1] || 'public',
      static: !!m[2],
      async: !!m[3],
      params: m[5] || '',
      returnType: m[6]?.trim() || 'void'
    });
  }
  
  return methods;
}

// Extract class properties
function extractClassProperties(body) {
  const properties = [];
  
  // property: type = value
  // private property: type
  const propMatches = body.matchAll(/(?:(public|private|protected)\s+)?(?:(static)\s+)?(?:(readonly)\s+)?(\w+)\s*(?:\?)?:\s*([^;=\n]+)/g);
  
  for (const m of propMatches) {
    // Skip method-like patterns
    if (m[0].includes('(')) continue;
    
    properties.push({
      name: m[4],
      visibility: m[1] || 'public',
      static: !!m[2],
      readonly: !!m[3],
      type: m[5].trim()
    });
  }
  
  return properties;
}

// Parse function parameters
function parseParams(paramsStr) {
  if (!paramsStr?.trim()) return [];
  
  const params = [];
  // Simple split - doesn't handle nested generics well
  const parts = paramsStr.split(',');
  
  for (const part of parts) {
    const trimmed = part.trim();
    const match = trimmed.match(/(\w+)(\?)?(?::\s*(.+))?/);
    if (match) {
      params.push({
        name: match[1],
        optional: !!match[2],
        type: match[3] || 'any'
      });
    }
  }
  
  return params;
}

// Generate L0 summary
export function generateL0(filePath, parsed) {
  const parts = [];
  
  // Classes
  if (parsed.classes.length > 0) {
    parts.push(parsed.classes.map(c => `C:${c.name}`).join(', '));
  }
  
  // Types
  if (parsed.types.length > 0) {
    const typeNames = parsed.types.map(t => {
      const prefix = t.kind === 'interface' ? 'I:' : t.kind === 'enum' ? 'E:' : 'T:';
      return `${prefix}${t.name}`;
    });
    parts.push(typeNames.join(', '));
  }
  
  // Exported functions
  const exportedFuncs = parsed.functions.filter(f => f.exported);
  if (exportedFuncs.length > 0) {
    parts.push(`fn: ${exportedFuncs.map(f => f.name).join(', ')}`);
  }
  
  return `${filePath}: ${parts.join(' | ') || '(empty)'}`;
}

// Generate L1 summary
export function generateL1(parsed) {
  const lines = [];
  
  // Imports summary
  if (parsed.imports.length > 0) {
    const external = parsed.imports.filter(i => !i.from.startsWith('.'));
    const internal = parsed.imports.filter(i => i.from.startsWith('.'));
    if (external.length) lines.push(`imports: ${external.map(i => i.from).join(', ')}`);
    if (internal.length) lines.push(`local: ${internal.length} modules`);
    lines.push('');
  }
  
  // Exports
  if (parsed.exports.length > 0) {
    lines.push(`exports: ${parsed.exports.join(', ')}`);
    lines.push('');
  }
  
  // Types
  for (const type of parsed.types) {
    if (type.kind === 'interface') {
      let decl = `interface ${type.name}`;
      if (type.extends) decl += ` extends ${type.extends}`;
      lines.push(decl);
      for (const member of type.members || []) {
        if (member.kind === 'property') {
          lines.push(`  ${member.name}${member.optional ? '?' : ''}: ${member.type}`);
        } else {
          lines.push(`  ${member.name}(${member.params}): ${member.returnType}`);
        }
      }
    } else if (type.kind === 'type') {
      lines.push(`type ${type.name} = ${type.definition}`);
    } else if (type.kind === 'enum') {
      lines.push(`enum ${type.name} { ${type.values.join(', ')} }`);
    }
    lines.push('');
  }
  
  // Classes
  for (const cls of parsed.classes) {
    let decl = cls.abstract ? 'abstract class' : 'class';
    decl += ` ${cls.name}`;
    if (cls.extends) decl += ` extends ${cls.extends}`;
    if (cls.implements.length) decl += ` implements ${cls.implements.join(', ')}`;
    lines.push(decl);
    
    // Properties
    for (const prop of cls.properties) {
      const mods = [prop.visibility !== 'public' ? prop.visibility : '', prop.static ? 'static' : '', prop.readonly ? 'readonly' : ''].filter(Boolean).join(' ');
      lines.push(`  ${mods} ${prop.name}: ${prop.type}`.replace(/\s+/g, ' ').trim());
    }
    
    // Methods
    for (const method of cls.methods) {
      const mods = [method.visibility !== 'public' ? method.visibility : '', method.static ? 'static' : '', method.async ? 'async' : ''].filter(Boolean).join(' ');
      lines.push(`  ${mods} ${method.name}(${method.params}): ${method.returnType}`.replace(/\s+/g, ' ').trim());
    }
    lines.push('');
  }
  
  // Functions
  const exportedFuncs = parsed.functions.filter(f => f.exported);
  for (const func of exportedFuncs) {
    const params = func.params.map(p => `${p.name}${p.optional ? '?' : ''}: ${p.type}`).join(', ');
    lines.push(`function ${func.name}(${params}): ${func.returnType}`);
  }
  
  return lines.join('\n');
}
