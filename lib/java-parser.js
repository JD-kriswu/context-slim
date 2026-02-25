/**
 * Java parser using tree-sitter for accurate AST parsing
 */

import Parser from 'tree-sitter';
import Java from 'tree-sitter-java';

// Initialize parser
const parser = new Parser();
parser.setLanguage(Java);

// Parse Java source code into AST
export function parseJavaSource(content) {
  return parser.parse(content);
}

// Extract package declaration
export function extractPackage(tree) {
  const query = tree.rootNode.descendantsOfType('package_declaration');
  if (query.length > 0) {
    const scopedId = query[0].descendantsOfType('scoped_identifier')[0];
    if (scopedId) return scopedId.text;
    const id = query[0].descendantsOfType('identifier')[0];
    return id?.text || null;
  }
  return null;
}

// Extract imports
export function extractImports(tree) {
  const imports = [];
  const importDecls = tree.rootNode.descendantsOfType('import_declaration');
  
  for (const decl of importDecls) {
    const isStatic = decl.children.some(c => c.type === 'static');
    const scopedId = decl.descendantsOfType('scoped_identifier')[0];
    const asterisk = decl.descendantsOfType('asterisk')[0];
    
    let path = scopedId?.text || '';
    if (asterisk) path += '.*';
    
    imports.push({ static: isStatic, path });
  }
  
  return imports;
}

// Group imports by top-level package
export function groupImports(imports) {
  const groups = {};
  for (const imp of imports) {
    const parts = imp.path.split('.');
    const group = parts[0];
    if (!groups[group]) groups[group] = [];
    groups[group].push(imp.path);
  }
  return groups;
}

// Extract all type declarations (class, interface, enum, record)
export function extractTypes(tree) {
  const types = [];
  const typeNodes = [
    ...tree.rootNode.descendantsOfType('class_declaration'),
    ...tree.rootNode.descendantsOfType('interface_declaration'),
    ...tree.rootNode.descendantsOfType('enum_declaration'),
    ...tree.rootNode.descendantsOfType('record_declaration')
  ];
  
  for (const node of typeNodes) {
    const type = parseTypeDeclaration(node);
    if (type) types.push(type);
  }
  
  return types;
}

// Parse a single type declaration
function parseTypeDeclaration(node) {
  const kind = node.type.replace('_declaration', '');
  const nameNode = node.childForFieldName('name');
  const name = nameNode?.text || 'Unknown';
  
  // Get modifiers
  const modifiers = node.descendantsOfType('modifiers')[0];
  const visibility = extractVisibility(modifiers);
  const isAbstract = modifiers?.text.includes('abstract') || false;
  const isFinal = modifiers?.text.includes('final') || false;
  
  // Get annotations
  const annotations = extractAnnotations(modifiers);
  
  // Get superclass
  const superclass = node.childForFieldName('superclass');
  const extendsClause = superclass?.text.replace('extends ', '') || null;
  
  // Get interfaces
  const interfaces = node.childForFieldName('interfaces');
  const implementsList = interfaces ? 
    interfaces.descendantsOfType('type_identifier').map(t => t.text) : [];
  
  // Get body
  const body = node.childForFieldName('body');
  
  return {
    kind,
    name,
    visibility,
    modifier: isAbstract ? 'abstract' : (isFinal ? 'final' : null),
    extends: extendsClause,
    implements: implementsList,
    annotations,
    methods: body ? extractMethods(body) : [],
    fields: body ? extractFields(body) : []
  };
}

// Extract visibility modifier
function extractVisibility(modifiers) {
  if (!modifiers) return 'package';
  const text = modifiers.text;
  if (text.includes('public')) return 'public';
  if (text.includes('protected')) return 'protected';
  if (text.includes('private')) return 'private';
  return 'package';
}

// Extract annotations
function extractAnnotations(modifiers) {
  if (!modifiers) return [];
  return modifiers.descendantsOfType('marker_annotation')
    .map(a => '@' + (a.childForFieldName('name')?.text || a.text.slice(1)));
}

// Extract methods from class body
export function extractMethods(body) {
  const methods = [];
  const methodNodes = body.descendantsOfType('method_declaration');
  
  for (const node of methodNodes) {
    // Skip if this is a nested class method
    if (isNestedInClass(node, body)) continue;
    
    const nameNode = node.childForFieldName('name');
    const name = nameNode?.text || 'unknown';
    
    const modifiers = node.children.find(c => c.type === 'modifiers');
    const visibility = extractVisibility(modifiers);
    const isStatic = modifiers?.text.includes('static') || false;
    const isFinal = modifiers?.text.includes('final') || false;
    
    const returnType = node.childForFieldName('type')?.text || 'void';
    const params = extractParameters(node.childForFieldName('parameters'));
    const annotations = extractAnnotations(modifiers);
    
    // Get throws clause
    const throwsClause = node.children.find(c => c.type === 'throws');
    const throwsList = throwsClause ? 
      throwsClause.descendantsOfType('type_identifier').map(t => t.text) : [];
    
    methods.push({
      name,
      visibility,
      static: isStatic,
      final: isFinal,
      returnType,
      params,
      throws: throwsList,
      annotations
    });
  }
  
  return methods;
}

// Check if node is inside a nested class
function isNestedInClass(node, directParent) {
  let parent = node.parent;
  while (parent && parent !== directParent) {
    if (parent.type === 'class_body') return true;
    parent = parent.parent;
  }
  return false;
}

// Extract method parameters
function extractParameters(paramsNode) {
  if (!paramsNode) return [];
  
  const params = [];
  const paramNodes = paramsNode.descendantsOfType('formal_parameter');
  
  for (const param of paramNodes) {
    const type = param.childForFieldName('type')?.text || 'Object';
    const name = param.childForFieldName('name')?.text || 'arg';
    params.push({ type, name });
  }
  
  // Handle spread parameters (varargs)
  const spreadParams = paramsNode.descendantsOfType('spread_parameter');
  for (const param of spreadParams) {
    const typeNode = param.children.find(c => c.type.includes('type') || c.type === 'identifier');
    const nameNode = param.childForFieldName('name') || param.descendantsOfType('identifier').pop();
    const type = (typeNode?.text || 'Object') + '...';
    const name = nameNode?.text || 'args';
    params.push({ type, name });
  }
  
  return params;
}

// Extract fields from class body
export function extractFields(body) {
  const fields = [];
  const fieldNodes = body.descendantsOfType('field_declaration');
  
  for (const node of fieldNodes) {
    // Skip if nested
    if (isNestedInClass(node, body)) continue;
    
    const modifiers = node.children.find(c => c.type === 'modifiers');
    const visibility = extractVisibility(modifiers);
    const isStatic = modifiers?.text.includes('static') || false;
    const isFinal = modifiers?.text.includes('final') || false;
    
    const type = node.childForFieldName('type')?.text || 'Object';
    const declarators = node.descendantsOfType('variable_declarator');
    const annotations = extractAnnotations(modifiers);
    
    for (const decl of declarators) {
      const name = decl.childForFieldName('name')?.text || 'unknown';
      fields.push({
        name,
        type,
        visibility,
        static: isStatic,
        final: isFinal,
        annotations
      });
    }
  }
  
  return fields;
}

// Generate L0 summary (one-liner)
export function generateL0(filePath, types) {
  if (types.length === 0) return `${filePath}: (empty or unparseable)`;
  
  const typesSummary = types.map(t => {
    const prefix = t.kind === 'interface' ? 'I' : t.kind === 'enum' ? 'E' : t.kind === 'record' ? 'R' : '';
    return `${prefix}${t.name}`;
  }).join(', ');
  
  return `${filePath}: ${typesSummary}`;
}

// Generate L1 summary (structure overview)
export function generateL1(pkg, imports, types) {
  const lines = [];
  
  if (pkg) {
    lines.push(`package ${pkg}`);
    lines.push('');
  }
  
  // Summarize imports
  const grouped = groupImports(imports);
  const importSummary = Object.entries(grouped)
    .map(([group, paths]) => `${group}.* (${paths.length})`)
    .join(', ');
  if (importSummary) {
    lines.push(`imports: ${importSummary}`);
    lines.push('');
  }
  
  // Type summaries
  for (const type of types) {
    // Include annotations for searchability
    if (type.annotations.length > 0) {
      lines.push(type.annotations.join(' '));
    }
    
    const modifiers = [type.visibility, type.modifier].filter(Boolean).join(' ');
    let decl = `${modifiers} ${type.kind} ${type.name}`;
    if (type.extends) decl += ` extends ${type.extends}`;
    if (type.implements.length) decl += ` implements ${type.implements.join(', ')}`;
    
    lines.push(decl);
    
    // Fields (public/protected only for L1)
    const visibleFields = type.fields.filter(f => ['public', 'protected'].includes(f.visibility));
    for (const field of visibleFields) {
      const mods = [field.static ? 'static' : '', field.final ? 'final' : ''].filter(Boolean).join(' ');
      lines.push(`  ${mods} ${field.type} ${field.name}`.replace(/\s+/g, ' ').trim());
    }
    
    // Methods (public/protected only for L1)
    const visibleMethods = type.methods.filter(m => ['public', 'protected'].includes(m.visibility));
    for (const method of visibleMethods) {
      const mods = [method.static ? 'static' : ''].filter(Boolean).join(' ');
      const params = method.params.map(p => `${p.type} ${p.name}`).join(', ');
      lines.push(`  ${mods} ${method.returnType} ${method.name}(${params})`.replace(/\s+/g, ' ').trim());
    }
    
    lines.push('');
  }
  
  return lines.join('\n');
}

// Main parse function
export function parseJavaFile(content) {
  const tree = parseJavaSource(content);
  const pkg = extractPackage(tree);
  const imports = extractImports(tree);
  const types = extractTypes(tree);
  
  return { pkg, imports, types };
}
