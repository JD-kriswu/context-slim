import { readFile } from 'node:fs/promises';
import { parseJavaFile, generateL0, generateL1 } from '../lib/java-parser.js';

async function testFile(filename) {
  const testFile = new URL(`./fixtures/${filename}`, import.meta.url);
  const content = await readFile(testFile, 'utf-8');

  console.log(`\n=== Parsing ${filename} ===\n`);

  const parsed = parseJavaFile(content);

  console.log('Package:', parsed.pkg);
  console.log('Imports:', parsed.imports.length);
  console.log('Types:', parsed.types.length);

  for (const type of parsed.types) {
    console.log(`\nType: ${type.kind} ${type.name}`);
    console.log('  Visibility:', type.visibility);
    console.log('  Annotations:', type.annotations);
    console.log('  Extends:', type.extends);
    console.log('  Implements:', type.implements);
    console.log('  Fields:', type.fields.map(f => `${f.visibility} ${f.type} ${f.name}`));
    console.log('  Methods:', type.methods.map(m => `${m.visibility} ${m.returnType} ${m.name}()`));
  }

  console.log('\n--- L0 Summary ---');
  console.log(generateL0(`com/example/${filename}`, parsed.types));

  console.log('\n--- L1 Summary ---');
  console.log(generateL1(parsed.pkg, parsed.imports, parsed.types));
}

await testFile('UserService.java');
await testFile('User.java');
