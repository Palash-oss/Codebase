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

function findFileByPath(resolvedPath, files) {
  const absolutePath = path.resolve(resolvedPath);
  let found = files.find(f => f.path === absolutePath);
  if (found) return found;

  const exts = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
  for (const ext of exts) {
    found = files.find(f => f.path === absolutePath + ext);
    if (found) return found;
  }

  for (const ext of exts) {
    found = files.find(f => f.path === path.join(absolutePath, 'index' + ext));
    if (found) return found;
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

export function parseImports(files, tsconfigPaths, projectRoot) {
  const fileMap = new Map();
  for (const file of files) {
    fileMap.set(file.path, file);
  }

  return files.map(file => {
    const imports = [];
    const exports = [];
    const httpMethods = new Set();
    const fetchUrls = [];
    const envVars = [];
    
    // Determine apiRoute
    const apiRoute = file.relativePath.includes('/api/') || file.name.startsWith('route.');

    try {
      const ext = path.extname(file.name).toLowerCase();
      const parsableExts = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'];
      if (!parsableExts.includes(ext)) {
        return {
          ...file,
          imports,
          exports,
          layer: 'Unknown',
          apiRoute,
          lines: file.content ? file.content.split('\n').length : 0,
          envVars,
          fetchUrls,
          httpMethods: []
        };
      }

      const ast = parse(file.content, {
        jsx: true,
        loc: true,
        range: false,
        tokens: false,
        comment: false,
        errorOnUnknownASTType: false
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

          // Resolve specifier
          let resolvedPath = null;
          let status = 'external';
          let resolvedRelativePath = null;

          if (specifier.startsWith('.')) {
            resolvedPath = path.resolve(path.dirname(file.path), specifier);
            const foundFile = findFileByPath(resolvedPath, files);
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
              const foundFile = findFileByPath(resolvedPath, files);
              if (foundFile) {
                status = 'resolved';
                resolvedRelativePath = foundFile.relativePath;
              } else {
                status = 'broken';
              }
            }
            
            // Fallback for @/ or absolute imports relative to src/ or root/
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
                const foundFile = findFileByPath(cand, files);
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

          imports.push({
            specifier,
            type: importType,
            names: importedNames,
            status,
            resolvedPath: resolvedRelativePath || resolvedPath
          });
        }

        // 2. Exports
        if (node.type === 'ExportDefaultDeclaration') {
          let kind = 'default';
          if (node.declaration) {
            if (node.declaration.type === 'FunctionDeclaration') kind = 'function';
            else if (node.declaration.type === 'ClassDeclaration') kind = 'class';
          }
          exports.push({
            name: 'default',
            kind
          });
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
              const kind = decl.kind; // const, let, var
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
          exports.push({
            name: '*',
            kind: 'reexport'
          });
        }

        // 3. fetch() calls
        if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === 'fetch') {
          const firstArg = node.arguments[0];
          if (firstArg && (firstArg.type === 'Literal' || firstArg.type === 'StringLiteral')) {
            fetchUrls.push(firstArg.value);
          } else if (firstArg && firstArg.type === 'TemplateLiteral') {
            // Basic raw string from template literal if it's static
            if (firstArg.quasis.length === 1) {
              fetchUrls.push(firstArg.quasis[0].value.raw);
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

      // API route methods check
      if (apiRoute) {
        const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
        for (const exp of exports) {
          if (methods.includes(exp.name)) {
            httpMethods.add(exp.name);
          }
        }
      }

    } catch (e) {
      console.warn(`[X-RAY] parse warning: ${file.relativePath} - ${e.message}`);
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
