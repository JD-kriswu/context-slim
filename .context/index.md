# Project Index (L0)

bin/cli.js: (empty)
lib/context.js: fn: initContext, updateContext, queryContext
lib/go-parser.js: T:Name | fn: parseGoFile, generateL0, generateL1
lib/hooks.js: fn: installHook
lib/java-parser.js: fn: parseJavaSource, extractPackage, extractImports, groupImports, extractTypes, extractMethods, extractFields, generateL0, generateL1, parseJavaFile
lib/search.js: fn: buildIndex, searchIndex, saveIndex, loadIndex, buildContextIndex
lib/ts-parser.js: C:Name | I:Name, T:Name, E:Name | fn: parseTsFile, name, name, name, generateL0, generateL1
lib/watcher.js: fn: watchContext
test/fixtures/User.java: User, UserBuilder, EUserRole
test/fixtures/UserService.java: UserService
test/test.js: (empty)
