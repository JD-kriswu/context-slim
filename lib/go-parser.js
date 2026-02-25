/**
 * Go parser using regex (MVP)
 * TODO: upgrade to tree-sitter-go for accuracy
 */

// Parse Go source file
export function parseGoFile(content) {
  const pkg = extractPackage(content);
  const imports = extractImports(content);
  const types = extractTypes(content);
  const functions = extractFunctions(content);
  
  return { pkg, imports, types, functions };
}

// Extract package name
function extractPackage(content) {
  const match = content.match(/^package\s+(\w+)/m);
  return match ? match[1] : null;
}

// Extract imports
function extractImports(content) {
  const imports = [];
  
  // Single import: import "fmt"
  const singleMatches = content.matchAll(/^import\s+"([^"]+)"/gm);
  for (const m of singleMatches) {
    imports.push(m[1]);
  }
  
  // Import block: import ( ... )
  const blockMatch = content.match(/import\s*\(\s*([\s\S]*?)\s*\)/);
  if (blockMatch) {
    const lines = blockMatch[1].split('\n');
    for (const line of lines) {
      const m = line.match(/"([^"]+)"/);
      if (m) imports.push(m[1]);
    }
  }
  
  return imports;
}

// Extract type declarations (struct, interface)
function extractTypes(content) {
  const types = [];
  
  // Struct: type Name struct { ... }
  const structMatches = content.matchAll(/type\s+(\w+)\s+struct\s*\{([^}]*)\}/g);
  for (const m of structMatches) {
    const name = m[1];
    const body = m[2];
    const fields = parseStructFields(body);
    types.push({ kind: 'struct', name, fields, methods: [] });
  }
  
  // Interface: type Name interface { ... }
  const ifaceMatches = content.matchAll(/type\s+(\w+)\s+interface\s*\{([^}]*)\}/g);
  for (const m of ifaceMatches) {
    const name = m[1];
    const body = m[2];
    const methods = parseInterfaceMethods(body);
    types.push({ kind: 'interface', name, methods, fields: [] });
  }
  
  // Type alias: type Name = OtherType
  const aliasMatches = content.matchAll(/type\s+(\w+)\s*=\s*(\S+)/g);
  for (const m of aliasMatches) {
    types.push({ kind: 'alias', name: m[1], aliasOf: m[2], fields: [], methods: [] });
  }
  
  return types;
}

// Parse struct fields
function parseStructFields(body) {
  const fields = [];
  const lines = body.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//')) continue;
    
    // Field: Name Type `tag`
    const match = trimmed.match(/^(\w+)\s+(\S+)/);
    if (match) {
      fields.push({ name: match[1], type: match[2] });
    }
  }
  
  return fields;
}

// Parse interface methods
function parseInterfaceMethods(body) {
  const methods = [];
  const lines = body.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//')) continue;
    
    // Method: Name(params) returnType
    const match = trimmed.match(/^(\w+)\s*\(([^)]*)\)\s*(.*)/);
    if (match) {
      methods.push({
        name: match[1],
        params: match[2] || '',
        returnType: match[3] || ''
      });
    }
  }
  
  return methods;
}

// Extract functions and methods
function extractFunctions(content) {
  const functions = [];
  
  // Function: func Name(params) returnType { ... }
  // Method: func (r *Receiver) Name(params) returnType { ... }
  const funcMatches = content.matchAll(/func\s+(?:\((\w+)\s+\*?(\w+)\)\s+)?(\w+)\s*\(([^)]*)\)\s*([^{]*)/g);
  
  for (const m of funcMatches) {
    const receiver = m[2] || null;
    const name = m[3];
    const params = m[4] || '';
    const returnType = m[5]?.trim() || '';
    
    functions.push({
      name,
      receiver,
      params: parseParams(params),
      returnType,
      visibility: name[0] === name[0].toUpperCase() ? 'public' : 'private'
    });
  }
  
  return functions;
}

// Parse function parameters
function parseParams(paramsStr) {
  if (!paramsStr.trim()) return [];
  
  const params = [];
  const parts = paramsStr.split(',');
  
  for (const part of parts) {
    const trimmed = part.trim();
    const match = trimmed.match(/(\w+)\s+(.+)/);
    if (match) {
      params.push({ name: match[1], type: match[2] });
    } else if (trimmed) {
      params.push({ name: '', type: trimmed });
    }
  }
  
  return params;
}

// Generate L0 summary
export function generateL0(filePath, parsed) {
  const parts = [];
  
  if (parsed.types.length > 0) {
    const typeNames = parsed.types.map(t => {
      const prefix = t.kind === 'interface' ? 'I' : t.kind === 'struct' ? 'S' : '';
      return `${prefix}${t.name}`;
    });
    parts.push(typeNames.join(', '));
  }
  
  const publicFuncs = parsed.functions.filter(f => !f.receiver && f.visibility === 'public');
  if (publicFuncs.length > 0) {
    parts.push(`funcs: ${publicFuncs.map(f => f.name).join(', ')}`);
  }
  
  return `${filePath}: ${parts.join(' | ') || '(empty)'}`;
}

// Generate L1 summary
export function generateL1(parsed) {
  const lines = [];
  
  if (parsed.pkg) {
    lines.push(`package ${parsed.pkg}`);
    lines.push('');
  }
  
  // Imports summary
  if (parsed.imports.length > 0) {
    const stdLib = parsed.imports.filter(i => !i.includes('.'));
    const external = parsed.imports.filter(i => i.includes('.'));
    if (stdLib.length) lines.push(`imports: ${stdLib.join(', ')}`);
    if (external.length) lines.push(`external: ${external.length} packages`);
    lines.push('');
  }
  
  // Types
  for (const type of parsed.types) {
    if (type.kind === 'struct') {
      lines.push(`type ${type.name} struct`);
      for (const field of type.fields) {
        lines.push(`  ${field.name} ${field.type}`);
      }
    } else if (type.kind === 'interface') {
      lines.push(`type ${type.name} interface`);
      for (const method of type.methods) {
        lines.push(`  ${method.name}(${method.params}) ${method.returnType}`);
      }
    } else if (type.kind === 'alias') {
      lines.push(`type ${type.name} = ${type.aliasOf}`);
    }
    lines.push('');
  }
  
  // Public functions
  const publicFuncs = parsed.functions.filter(f => f.visibility === 'public');
  for (const func of publicFuncs) {
    const params = func.params.map(p => `${p.name} ${p.type}`.trim()).join(', ');
    if (func.receiver) {
      lines.push(`func (*${func.receiver}) ${func.name}(${params}) ${func.returnType}`);
    } else {
      lines.push(`func ${func.name}(${params}) ${func.returnType}`);
    }
  }
  
  return lines.join('\n');
}
