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

  const exts = [
    '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
    '.py', '.go', '.rs', '.java', '.kt', '.cs', '.php',
    '.c', '.cpp', '.h', '.hpp', '.cc', '.rb'
  ];
  for (const ext of exts) {
    if (filePathMap.has(absolutePath + ext)) return filePathMap.get(absolutePath + ext);
  }

  for (const ext of exts) {
    const target = (absolutePath + '/index' + ext).replace(/\/+/g, '/');
    if (filePathMap.has(target)) return filePathMap.get(target);
    const modTarget = (absolutePath + '/mod' + ext).replace(/\/+/g, '/');
    if (filePathMap.has(modTarget)) return filePathMap.get(modTarget);
    const initTarget = (absolutePath + '/__init__' + ext).replace(/\/+/g, '/');
    if (filePathMap.has(initTarget)) return filePathMap.get(initTarget);
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
        path.resolve(projectRoot, cleanSpec),
        path.resolve(projectRoot, 'lib', cleanSpec),
        path.resolve(projectRoot, 'app', cleanSpec),
        path.resolve(projectRoot, 'pkg', cleanSpec),
        path.resolve(projectRoot, 'internal', cleanSpec)
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
    const relLower = file.relativePath.toLowerCase();
    const apiRoute = relLower.includes('/api/') ||
                     relLower.includes('/routes/') ||
                     relLower.includes('/controllers/') ||
                     file.name.startsWith('route.');

    const ext = path.extname(file.name).toLowerCase();
    const jsExts = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'];

    // 1. JavaScript & TypeScript (AST Parsing via ESTree)
    if (jsExts.includes(ext) && file.content) {
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

    // 2. Multi-Language Parsing Pipeline (Python, Go, Rust, Java, C#, PHP, C/C++, Ruby)
    if (file.content) {
      const content = file.content;

      // --- PYTHON (.py) ---
      if (ext === '.py') {
        // Imports: from x.y import z, import foo, import foo as bar
        const pyImportRegex = /^\s*(?:from\s+([a-zA-Z0-9_\.]+)\s+import\s+([^\n]+)|import\s+([a-zA-Z0-9_\.]+))/gm;
        let m;
        while ((m = pyImportRegex.exec(content)) !== null) {
          const modPath = m[1] || m[3];
          let importedItems = ['*'];
          if (m[2]) {
            const rawItems = m[2].split('#')[0].replace(/[\(\)\s]/g, '');
            importedItems = rawItems.split(',').filter(Boolean);
          }
          if (modPath) {
            let relativeCandidate = './' + modPath.replace(/\./g, '/');
            if (modPath.startsWith('.')) {
              relativeCandidate = modPath.replace(/\./g, '/');
            }
            const { status, resolvedPath } = resolveSpecifier(relativeCandidate, file.path, filePathMap, tsconfigPaths, projectRoot);
            imports.push({
              specifier: modPath,
              type: 'python',
              names: importedItems,
              status: status === 'resolved' ? 'resolved' : 'external',
              resolvedPath: status === 'resolved' ? resolvedPath : null
            });
          }
        }

        // Python Functions / Classes — with parameters (for LLD function signatures)
        const pyFunctions = [];
        const pyClasses = [];
        const pyRoutes = []; // [{method, path, functionName}]

        // Parse class definitions
        const pyClassRegex = /^class\s+([a-zA-Z0-9_]+)(?:\s*\([^)]*\))?\s*:/gm;
        let mc;
        while ((mc = pyClassRegex.exec(content)) !== null) {
          pyClasses.push(mc[1]);
          exports.push({ name: mc[1], kind: 'class' });
        }

        // Parse function definitions with their parameters
        // Matches: def func_name(param1, param2, ...) or def func_name(self, param1):
        const pyFuncRegex = /^(    )?def\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)/gm;
        let mf;
        while ((mf = pyFuncRegex.exec(content)) !== null) {
          const isMethod = !!mf[1]; // indented = method inside class
          const funcName = mf[2];
          const rawParams = mf[3];
          // Clean params: remove self, type hints, defaults, *args, **kwargs
          const params = rawParams
            .split(',')
            .map(p => p.trim().split(':')[0].split('=')[0].trim())
            .filter(p => p && p !== 'self' && p !== 'cls' && !p.startsWith('*') && !p.startsWith('**') && p !== '');
          pyFunctions.push({ name: funcName, params, isMethod });
          if (!isMethod) {
            exports.push({ name: funcName, kind: 'function' });
          }
        }

        // Parse Flask/FastAPI route decorators and pair with the NEXT function name
        // @app.route('/path', methods=['GET','POST'])
        // @app.get('/path'), @router.post('/path'), @bp.route('/path')
        const pyRouteDecoratorRegex = /@(?:[a-zA-Z_][a-zA-Z0-9_]*)(?:\.[a-zA-Z_][a-zA-Z0-9_]*)?\.(?:(get|post|put|delete|patch|route)\s*\(|route\s*\()\s*['"]([^'"]+)['"]/gi;
        const lines = content.split('\n');
        for (let li = 0; li < lines.length; li++) {
          const line = lines[li];
          // Match decorator
          const decMatch = line.match(/@(?:[a-zA-Z_][a-zA-Z0-9_]*)(?:\.[a-zA-Z_][a-zA-Z0-9_]*)?\.(?:get|post|put|delete|patch|route)\s*\(['"]([^'"]+)['"]/i);
          if (decMatch) {
            const routePath = decMatch[1];
            // Detect HTTP method from decorator name
            const methodMatch = line.match(/\.(get|post|put|delete|patch|route)/i);
            let method = methodMatch ? methodMatch[1].toUpperCase() : 'GET';
            // For @app.route look for methods=[...]
            if (method === 'ROUTE') {
              const methodsInDec = line.match(/methods=\[([^\]]+)\]/);
              method = methodsInDec ? methodsInDec[1].split(',')[0].replace(/['"/]/g, '').trim().toUpperCase() : 'GET';
            }
            // Look ahead for the def line
            for (let j = li + 1; j < Math.min(li + 5, lines.length); j++) {
              const defMatch = lines[j].match(/^(?:async\s+)?def\s+([a-zA-Z0-9_]+)/);
              if (defMatch) {
                pyRoutes.push({ method, path: routePath, functionName: defMatch[1] });
                httpMethods.add(method);
                break;
              }
            }
          }
        }

        // SQLAlchemy / Pydantic / Peewee / Django ORM field extraction
        // For schema/model files: extract class name + field names
        const pySchema = [];
        const modelClassRegex = /^class\s+([a-zA-Z0-9_]+)\s*\(([^)]+)\)\s*:/gm;
        let ms;
        while ((ms = modelClassRegex.exec(content)) !== null) {
          const className = ms[1];
          const baseClass = ms[2];
          const isModel = /Base|Model|Schema|BaseModel|db\.Model|Document|Resource|Serializer/.test(baseClass);
          if (isModel) {
            // Extract field lines that follow: field_name = Column(...) or field_name: Type
            const classStart = ms.index;
            const classContent = content.slice(classStart, classStart + 2000);
            const fieldRegex = /^    ([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:=\s*(?:Column|db\.Column|models\.|CharField|IntField|FloatField|BooleanField|DateField|ForeignKeyField|relationship|Field)|:\s*(?:str|int|float|bool|Optional|List|UUID))/gm;
            const fields = [];
            let mfield;
            while ((mfield = fieldRegex.exec(classContent)) !== null) {
              if (!['__tablename__', 'id', 'Meta', 'Config'].includes(mfield[1])) {
                fields.push(mfield[1]);
              }
            }
            // Always include 'id' if class is a model
            pySchema.push({ model: className, base: baseClass, fields: ['id', ...fields] });
          }
        }

        // Attach extracted data to file-level properties
        if (pyRoutes.length > 0) {
          file.routes = pyRoutes;
          file.apiRoute = true;
        }
        if (pyFunctions.length > 0) file.functions = pyFunctions;
        if (pyClasses.length > 0) file.classes = pyClasses;
        if (pySchema.length > 0) file.schema = pySchema;

        // Python Env Vars: os.getenv('FOO') or os.environ.get('FOO')
        const pyEnvRegex = /os\.(?:getenv|environ\.get|environ\[['"])\s*\(?\s*['"]([A-Z0-9_]+)['"]/g;
        let m3;
        while ((m3 = pyEnvRegex.exec(content)) !== null) {
          if (!envVars.includes(m3[1])) envVars.push(m3[1]);
        }
        // Also dotenv style: KEY = os.getenv("KEY") or just any UPPER_CASE string after getenv
        const dotenvRegex = /(?:getenv|environ)\(["']([A-Z0-9_]{3,})["']/g;
        let md;
        while ((md = dotenvRegex.exec(content)) !== null) {
          if (!envVars.includes(md[1])) envVars.push(md[1]);
        }
      }

      // --- GO (.go) ---
      if (ext === '.go') {
        // Imports: import "fmt" or import ("foo" "bar")
        const goBlockRegex = /import\s*\(\s*([\s\S]*?)\s*\)/g;
        let m;
        while ((m = goBlockRegex.exec(content)) !== null) {
          const block = m[1];
          const lines = block.split('\n');
          for (const line of lines) {
            const specMatch = line.match(/"([^"]+)"/);
            if (specMatch) {
              const spec = specMatch[1];
              const { status, resolvedPath } = resolveSpecifier('./' + spec, file.path, filePathMap, tsconfigPaths, projectRoot);
              imports.push({ specifier: spec, type: 'go', names: [], status, resolvedPath });
            }
          }
        }
        const goSingleRegex = /import\s+"([^"]+)"/g;
        while ((m = goSingleRegex.exec(content)) !== null) {
          const spec = m[1];
          if (!imports.some(i => i.specifier === spec)) {
            const { status, resolvedPath } = resolveSpecifier('./' + spec, file.path, filePathMap, tsconfigPaths, projectRoot);
            imports.push({ specifier: spec, type: 'go', names: [], status, resolvedPath });
          }
        }

        // Go Exports: Functions/Types starting with Capital Letter
        const goExportRegex = /^func\s+([A-Z][a-zA-Z0-9_]+)|^type\s+([A-Z][a-zA-Z0-9_]+)/gm;
        while ((m = goExportRegex.exec(content)) !== null) {
          exports.push({ name: m[1] || m[2], kind: m[1] ? 'function' : 'struct' });
        }

        // Go HTTP handlers (Gin, Echo, Fiber): r.GET('/path', handler)
        const goRouteRegex = /\.(GET|POST|PUT|DELETE|PATCH)\s*\(\s*["']([^"']+)["']/gi;
        while ((m = goRouteRegex.exec(content)) !== null) {
          httpMethods.add(m[1].toUpperCase());
          fetchUrls.push(m[2]);
        }
      }

      // --- RUST (.rs) ---
      if (ext === '.rs') {
        // use crate::foo::bar; or mod foo;
        const rustUseRegex = /^\s*(?:pub\s+)?use\s+([^;]+);|^\s*(?:pub\s+)?mod\s+([a-zA-Z0-9_]+);/gm;
        let m;
        while ((m = rustUseRegex.exec(content)) !== null) {
          const spec = m[1] || m[2];
          if (spec) {
            const cleanSpec = spec.replace(/^crate::/, './').replace(/::/g, '/');
            const { status, resolvedPath } = resolveSpecifier(cleanSpec, file.path, filePathMap, tsconfigPaths, projectRoot);
            imports.push({ specifier: spec, type: 'rust', names: [], status, resolvedPath });
          }
        }

        // Rust Public Functions/Structs: pub fn foo(), pub struct Bar
        const rustExportRegex = /pub\s+(?:fn|struct|enum|trait)\s+([a-zA-Z0-9_]+)/g;
        while ((m = rustExportRegex.exec(content)) !== null) {
          exports.push({ name: m[1], kind: 'pub' });
        }
      }

      // --- JAVA & KOTLIN (.java, .kt) ---
      if (ext === '.java' || ext === '.kt') {
        const javaImportRegex = /^\s*import\s+([a-zA-Z0-9_\.]+);?/gm;
        let m;
        while ((m = javaImportRegex.exec(content)) !== null) {
          const spec = m[1];
          const cleanSpec = './' + spec.replace(/\./g, '/');
          const { status, resolvedPath } = resolveSpecifier(cleanSpec, file.path, filePathMap, tsconfigPaths, projectRoot);
          imports.push({ specifier: spec, type: 'java', names: [], status, resolvedPath });
        }

        // Spring Boot route annotations
        const springRouteRegex = /@(Get|Post|Put|Delete|Patch)Mapping\s*\(\s*(?:value\s*=\s*)?["']([^"']+)["']/gi;
        while ((m = springRouteRegex.exec(content)) !== null) {
          httpMethods.add(m[1].toUpperCase());
          fetchUrls.push(m[2]);
        }
      }

      // --- C# (.cs) ---
      if (ext === '.cs') {
        const csUsingRegex = /^\s*using\s+(?:static\s+)?([a-zA-Z0-9_\.]+);/gm;
        let m;
        while ((m = csUsingRegex.exec(content)) !== null) {
          const spec = m[1];
          const cleanSpec = './' + spec.replace(/\./g, '/');
          const { status, resolvedPath } = resolveSpecifier(cleanSpec, file.path, filePathMap, tsconfigPaths, projectRoot);
          imports.push({ specifier: spec, type: 'csharp', names: [], status, resolvedPath });
        }

        // ASP.NET Route Attributes: [HttpGet("api/users")]
        const csRouteRegex = /\[Http(Get|Post|Put|Delete|Patch)\s*\(\s*["']([^"']+)["']\)/gi;
        while ((m = csRouteRegex.exec(content)) !== null) {
          httpMethods.add(m[1].toUpperCase());
          fetchUrls.push(m[2]);
        }
      }

      // --- PHP (.php) ---
      if (ext === '.php') {
        const phpUseRegex = /^\s*(?:use|require|require_once|include|include_once)\s+['"]?([a-zA-Z0-9_\\/\.]+)/gm;
        let m;
        while ((m = phpUseRegex.exec(content)) !== null) {
          const spec = m[1];
          const cleanSpec = './' + spec.replace(/\\/g, '/');
          const { status, resolvedPath } = resolveSpecifier(cleanSpec, file.path, filePathMap, tsconfigPaths, projectRoot);
          imports.push({ specifier: spec, type: 'php', names: [], status, resolvedPath });
        }
      }

      // --- C / C++ (.c, .cpp, .h, .hpp, .cc) ---
      if (['.c', '.cpp', '.h', '.hpp', '.cc'].includes(ext)) {
        const cppIncludeRegex = /^\s*#include\s+["<]([^">]+)[">]/gm;
        let m;
        while ((m = cppIncludeRegex.exec(content)) !== null) {
          const spec = m[1];
          const { status, resolvedPath } = resolveSpecifier('./' + spec, file.path, filePathMap, tsconfigPaths, projectRoot);
          imports.push({
            specifier: spec,
            type: 'cpp',
            names: [],
            status: status === 'resolved' ? 'resolved' : 'external',
            resolvedPath: status === 'resolved' ? resolvedPath : null
          });
        }
      }

      // --- RUBY (.rb) ---
      if (ext === '.rb') {
        const rbRequireRegex = /^\s*(?:require|require_relative)\s+['"]([^'"]+)['"]/gm;
        let m;
        while ((m = rbRequireRegex.exec(content)) !== null) {
          const spec = m[1];
          const { status, resolvedPath } = resolveSpecifier(spec.startsWith('.') ? spec : './' + spec, file.path, filePathMap, tsconfigPaths, projectRoot);
          imports.push({ specifier: spec, type: 'ruby', names: [], status, resolvedPath });
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
      envVars,
      // New deep-extraction fields (populated for Python files)
      routes:    file.routes    || [],  // [{method, path, functionName}]
      functions: file.functions || [],  // [{name, params, isMethod}]
      classes:   file.classes   || [],  // [string]
      schema:    file.schema    || [],  // [{model, base, fields}]
    };

  });
}

