import fs from 'fs';
import path from 'path';
import { parse } from '@typescript-eslint/typescript-estree';

function resolveAlias(specifier, tsconfigPaths, baseUrl, projectRoot) {
  if (!tsconfigPaths) return null;
  const base = baseUrl ? path.resolve(projectRoot, baseUrl) : projectRoot;
  for (const [key, patterns] of Object.entries(tsconfigPaths)) {
    if (key === specifier) {
      for (const pattern of patterns) {
        return path.resolve(base, pattern);
      }
    } else if (key.endsWith('/*')) {
      const prefix = key.slice(0, -2);
      if (specifier.startsWith(prefix + '/')) {
        const suffix = specifier.slice(prefix.length + 1);
        for (const pattern of patterns) {
          const patPrefix = pattern.slice(0, -2);
          return path.resolve(base, patPrefix, suffix);
        }
      }
    }
  }
  return null;
}

function findFileByPath(resolvedPath, filePathMap) {
  const absolutePath = path.resolve(resolvedPath).toLowerCase().replace(/\\/g, '/');
  if (filePathMap.has(absolutePath)) return filePathMap.get(absolutePath);

  const exts = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
  for (const ext of exts) {
    if (filePathMap.has(absolutePath + ext)) return filePathMap.get(absolutePath + ext);
  }

  for (const ext of exts) {
    const target = (absolutePath + '/index' + ext).replace(/\/+/g, '/');
    if (filePathMap.has(target)) return filePathMap.get(target);
  }

  return null;
}

function traverse(node, visitor) {
  if (!node || typeof node !== 'object') return;
  visitor(node);
  for (const key in node) {
    if (Object.prototype.hasOwnProperty.call(node, key)) {
      const child = node[key];
      if (Array.isArray(child)) {
        for (const item of child) {
          traverse(item, visitor);
        }
      } else if (child && typeof child === 'object') {
        traverse(child, visitor);
      }
    }
  }
}

function resolveSpecifier(specifier, currentFilePath, filePathMap, tsconfigPaths, projectRoot) {
  let resolvedPath = null;
  let status = 'external';
  let resolvedRelativePath = null;

  if (!specifier || typeof specifier !== 'string') {
    return { status: 'external', resolvedPath: null };
  }

  if (specifier.startsWith('.')) {
    resolvedPath = path.resolve(path.dirname(currentFilePath), specifier);
    const foundFile = findFileByPath(resolvedPath, filePathMap);
    if (foundFile) {
      status = 'resolved';
      resolvedRelativePath = foundFile.relativePath;
    } else {
      status = 'broken';
    }
  } else {
    // Check tsconfig alias
    const aliasPath = resolveAlias(specifier, tsconfigPaths, null, projectRoot);
    if (aliasPath) {
      resolvedPath = aliasPath;
      const foundFile = findFileByPath(resolvedPath, filePathMap);
      if (foundFile) {
        status = 'resolved';
        resolvedRelativePath = foundFile.relativePath;
      } else {
        status = 'broken';
      }
    }

    // Fallback for @/ or relative to src/ or root/
    if (status !== 'resolved') {
      let cleanSpec = specifier;
      if (specifier.startsWith('@/')) {
        cleanSpec = specifier.slice(2);
      }
      const candidates = [
        path.resolve(projectRoot, 'src', cleanSpec),
        path.resolve(projectRoot, cleanSpec)
      ];
      for (const cand of candidates) {
        const foundFile = findFileByPath(cand, filePathMap);
        if (foundFile) {
          status = 'resolved';
          resolvedRelativePath = foundFile.relativePath;
          resolvedPath = cand;
          break;
        }
      }
    }

    if (status !== 'resolved') {
      status = 'external';
    }
  }

  return {
    status,
    resolvedPath: resolvedRelativePath || resolvedPath
  };
}

export function parseImports(files, projectRoot, tsconfigPaths = null) {
  const filePathMap = new Map();
  for (const file of files) {
    const norm = path.resolve(file.path).toLowerCase().replace(/\\/g, '/');
    filePathMap.set(norm, file);
  }

  return files.map(file => {
    const imports = [];
    const exports = [];
    const httpMethods = new Set();
    const fetchUrls = [];
    const envVars = [];
    
    // Determine apiRoute
    const apiRoute = file.relativePath.includes('/api/') || file.name.startsWith('route.');
    const ext = path.extname(file.name).toLowerCase();
    const parsableExts = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'];

    if (parsableExts.includes(ext) && file.content) {
      try {
        const ast = parse(file.content, {
          jsx: true,
          loc: true,
          range: false,
          tokens: false,
          comment: false,
          errorOnUnknownASTType: false,
          sourceType: 'module'
        });

        traverse(ast, node => {
          // 1. Imports from ImportDeclaration
          if (node.type === 'ImportDeclaration') {
            const specifier = node.source.value;
            let importType = 'side-effect';
            const importedNames = [];

            if (node.specifiers && node.specifiers.length > 0) {
              const first = node.specifiers[0];
              if (first.type === 'ImportDefaultSpecifier') {
                importType = 'default';
              } else if (first.type === 'ImportNamespaceSpecifier') {
                importType = 'namespace';
              } else {
                importType = 'named';
              }

              for (const spec of node.specifiers) {
                if (spec.type === 'ImportSpecifier') {
                  importedNames.push(spec.imported.name);
                } else if (spec.type === 'ImportDefaultSpecifier') {
                  importedNames.push('default');
                } else if (spec.type === 'ImportNamespaceSpecifier') {
                  importedNames.push('*');
                }
              }
            }

            const { status, resolvedPath } = resolveSpecifier(specifier, file.path, filePathMap, tsconfigPaths, projectRoot);
            imports.push({
              specifier,
              type: importType,
              names: importedNames,
              status,
              resolvedPath
            });
          }

          // 2. Exports
          if (node.type === 'ExportDefaultDeclaration') {
            let kind = 'default';
            if (node.declaration) {
              if (node.declaration.type === 'FunctionDeclaration') kind = 'function';
              else if (node.declaration.type === 'ClassDeclaration') kind = 'class';
            }
            exports.push({ name: 'default', kind });
          } else if (node.type === 'ExportNamedDeclaration') {
            if (node.declaration) {
              const decl = node.declaration;
              if (decl.type === 'FunctionDeclaration' && decl.id) {
                exports.push({ name: decl.id.name, kind: 'function' });
              } else if (decl.type === 'ClassDeclaration' && decl.id) {
                exports.push({ name: decl.id.name, kind: 'class' });
              } else if (decl.type === 'TSTypeAliasDeclaration' && decl.id) {
                exports.push({ name: decl.id.name, kind: 'type' });
              } else if (decl.type === 'TSInterfaceDeclaration' && decl.id) {
                exports.push({ name: decl.id.name, kind: 'interface' });
              } else if (decl.type === 'VariableDeclaration') {
                const kind = decl.kind;
                for (const varDecl of decl.declarations) {
                  if (varDecl.id && varDecl.id.name) {
                    exports.push({ name: varDecl.id.name, kind });
                  }
                }
              }
            }
            if (node.specifiers) {
              const isReexport = !!node.source;
              for (const spec of node.specifiers) {
                exports.push({
                  name: spec.exported.name,
                  kind: isReexport ? 'reexport' : (spec.exported.name === 'default' ? 'default' : 'const')
                });
              }
            }
          } else if (node.type === 'ExportAllDeclaration') {
            exports.push({ name: '*', kind: 'reexport' });
          }

          // 3. Call Expressions (fetch, require, dynamic import)
          if (node.type === 'CallExpression') {
            if (node.callee.type === 'Identifier' && node.callee.name === 'fetch') {
              const firstArg = node.arguments[0];
              if (firstArg && (firstArg.type === 'Literal' || firstArg.type === 'StringLiteral')) {
                fetchUrls.push(firstArg.value);
              } else if (firstArg && firstArg.type === 'TemplateLiteral') {
                if (firstArg.quasis.length === 1) {
                  fetchUrls.push(firstArg.quasis[0].value.raw);
                }
              }
            } else if (node.callee.type === 'Identifier' && node.callee.name === 'require') {
              const firstArg = node.arguments[0];
              if (firstArg && (firstArg.type === 'Literal' || firstArg.type === 'StringLiteral')) {
                const specifier = firstArg.value;
                const { status, resolvedPath } = resolveSpecifier(specifier, file.path, filePathMap, tsconfigPaths, projectRoot);
                imports.push({
                  specifier,
                  type: 'require',
                  names: [],
                  status,
                  resolvedPath
                });
              }
            } else if (node.callee.type === 'Import') { // dynamic import()
              const firstArg = node.arguments[0];
              if (firstArg && (firstArg.type === 'Literal' || firstArg.type === 'StringLiteral')) {
                const specifier = firstArg.value;
                const { status, resolvedPath } = resolveSpecifier(specifier, file.path, filePathMap, tsconfigPaths, projectRoot);
                imports.push({
                  specifier,
                  type: 'dynamic',
                  names: [],
                  status,
                  resolvedPath
                });
              }
            }
          }

          // 4. process.env references
          if (node.type === 'MemberExpression' && node.object.type === 'MemberExpression') {
            const obj = node.object;
            if (obj.object.type === 'Identifier' && obj.object.name === 'process' &&
                obj.property.type === 'Identifier' && obj.property.name === 'env') {
              if (node.property.type === 'Identifier') {
                envVars.push(node.property.name);
              } else if (node.property.type === 'Literal') {
                envVars.push(node.property.value);
              }
            }
          }
        });
      } catch (e) {
        console.warn(`[X-RAY] AST parse warning: ${file.relativePath} - ${e.message}`);
      }
    }

    // Fallback regex import extraction for non-JS or unparsable files (Python, Go, Java, C/C++, CSS, etc.)
    if (file.content && imports.length === 0) {
      const content = file.content;
      // JS / TS regex fallback (import ... from '...', require('...'))
      const jsImportRegex = /(?:import\s+[\s\S]*?\s+from\s+['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\))/g;
      let m;
      while ((m = jsImportRegex.exec(content)) !== null) {
        const spec = m[1] || m[2];
        if (spec && !imports.some(i => i.specifier === spec)) {
          const { status, resolvedPath } = resolveSpecifier(spec, file.path, filePathMap, tsconfigPaths, projectRoot);
          imports.push({ specifier: spec, type: 'static', names: [], status, resolvedPath });
        }
      }

      // Python import fallback (import foo, from bar import baz)
      if (ext === '.py') {
        const pyRegex = /^\s*(?:from\s+([a-zA-Z0-9_\.]+)\s+import|import\s+([a-zA-Z0-9_\.]+))/gm;
        while ((m = pyRegex.exec(content)) !== null) {
          const spec = m[1] || m[2];
          if (spec && !imports.some(i => i.specifier === spec)) {
            const { status, resolvedPath } = resolveSpecifier('./' + spec.replace(/\./g, '/'), file.path, filePathMap, tsconfigPaths, projectRoot);
            imports.push({ specifier: spec, type: 'python', names: [], status, resolvedPath });
          }
        }
      }

      // Go import fallback
      if (ext === '.go') {
        const goRegex = /import\s+(?:\(\s*([\s\S]*?)\s*\)|"([^"]+)")/g;
        while ((m = goRegex.exec(content)) !== null) {
          const specs = m[1] ? m[1].match(/"([^"]+)"/g) : [m[2]];
          if (specs) {
            specs.forEach(rawSpec => {
              const spec = rawSpec.replace(/"/g, '');
              if (spec && !imports.some(i => i.specifier === spec)) {
                imports.push({ specifier: spec, type: 'go', names: [], status: 'external', resolvedPath: null });
              }
            });
          }
        }
      }
    }

    // API route methods check
    if (apiRoute) {
      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
      for (const exp of exports) {
        if (methods.includes(exp.name)) {
          httpMethods.add(exp.name);
        }
      }
    }

    return {
      ...file,
      imports,
      exports,
      apiRoute,
      httpMethods: Array.from(httpMethods),
      fetchUrls,
      envVars
    };
  });
}
