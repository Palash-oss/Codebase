/**
 * schemaParser.js
 * 
 * Dedicated database schema extractor for CodebaseX-Ray.
 * Parses schema files to extract accurate table/model definitions with:
 *   - Column names, data types
 *   - Primary Keys (PK)
 *   - Foreign Keys (FK) with referenced table+column
 *   - Unique constraints, Nullable flags
 *   - Inter-table relationships (1:1, 1:N, N:M)
 * 
 * Supported ORMs/Schema formats:
 *   - Prisma (.prisma)
 *   - Raw SQL / Migrations (.sql)
 *   - TypeORM (TypeScript decorators)
 *   - Drizzle ORM (pgTable/sqliteTable/mysqlTable)
 *   - Mongoose Schema (JavaScript/TypeScript)
 *   - SQLAlchemy (Python)
 *   - Django ORM (Python models.py)
 */

/**
 * Main entry point: parse all files and extract schema information.
 * @param {Array} files - Array of file objects from fileScanner
 * @returns {Array<TableSchema>} - Array of table schema objects
 */
export function parseSchemas(files) {
  const allTables = [];

  for (const file of files) {
    if (!file.content || file.content.trim() === '') continue;

    const ext = (file.extension || '').toLowerCase();
    const name = (file.name || '').toLowerCase();
    const relPath = (file.relativePath || '').toLowerCase().replace(/\\/g, '/');
    const content = file.content;

    // Ignore python/JS system & test files
    if (name === '__init__.py' || name === 'conftest.py' || name === 'setup.py' ||
        name.startsWith('test_') || name.endsWith('_test.py') ||
        relPath.includes('/tests/') || relPath.includes('/test/')) {
      continue;
    }

    let tables = [];

    // Route to the right parser
    if (ext === '.prisma') {
      tables = parsePrisma(content, file.relativePath);
    } else if (ext === '.sql') {
      tables = parseSQL(content, file.relativePath);
    } else if ((ext === '.ts' || ext === '.js') && hasTypeORMSignature(content)) {
      tables = parseTypeORM(content, file.relativePath);
    } else if ((ext === '.ts' || ext === '.js') && hasDrizzleSignature(content)) {
      tables = parseDrizzle(content, file.relativePath);
    } else if ((ext === '.ts' || ext === '.js') && hasMongooseSignature(content)) {
      tables = parseMongoose(content, file.relativePath);
    } else if (ext === '.py' && hasSQLAlchemySignature(content)) {
      tables = parseSQLAlchemy(content, file.relativePath);
    } else if (ext === '.py' && hasDjangoSignature(content)) {
      tables = parseDjango(content, file.relativePath);
    } else if (hasEmbeddedSQLSignature(content)) {
      tables = parseSQL(content, file.relativePath);
    }

    for (const t of tables) {
      if (t.tableName && t.columns && t.columns.length > 0) {
        allTables.push(t);
      }
    }
  }

  // Post-process: resolve FK relationships between all detected tables
  resolveRelationships(allTables);

  return allTables;
}

// ─────────────────────────────────────────────────────────────────────────────
// SIGNATURE DETECTORS
// ─────────────────────────────────────────────────────────────────────────────

function hasTypeORMSignature(content) {
  return /@Entity\b/.test(content) || /@PrimaryColumn\b/.test(content) || /@PrimaryGeneratedColumn\b/.test(content);
}

function hasDrizzleSignature(content) {
  return /(?:pgTable|sqliteTable|mysqlTable|integer|text|serial|varchar|boolean|timestamp)\s*\(/.test(content) &&
    /from\s+['"]drizzle-orm/.test(content);
}

function hasMongooseSignature(content) {
  return /new\s+Schema\s*\(/.test(content) || /mongoose\.Schema/.test(content);
}

function hasSQLAlchemySignature(content) {
  return /(?:Column\s*\(|Integer|String|ForeignKey|relationship|declarative_base|Base\.metadata)/.test(content) &&
    /(?:from\s+sqlalchemy|import\s+sqlalchemy|db\.Model)/.test(content);
}

function hasDjangoSignature(content) {
  return /models\.(Model|CharField|IntegerField|ForeignKey|AutoField|TextField|BooleanField|DateTimeField)/.test(content);
}

function hasEmbeddedSQLSignature(content) {
  return /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["'`]?\w+["'`]?\s*\(/i.test(content);
}

// ─────────────────────────────────────────────────────────────────────────────
// PRISMA PARSER
// ─────────────────────────────────────────────────────────────────────────────

function parsePrisma(content, filePath) {
  const tables = [];
  // Match model blocks: model User { ... }
  const modelRegex = /^model\s+(\w+)\s*\{([^}]+)\}/gm;
  let match;

  while ((match = modelRegex.exec(content)) !== null) {
    const modelName = match[1];
    const body = match[2];
    const columns = [];

    const lines = body.split('\n').filter(l => l.trim() && !l.trim().startsWith('//') && !l.trim().startsWith('@@'));

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Field line: fieldName  Type  attributes...
      // e.g.: id       String   @id @default(uuid())
      // e.g.: userId   String?  @relation(fields: [userId], references: [id])
      const fieldMatch = trimmed.match(/^(\w+)\s+([\w\[\]?]+)\s*(.*)?$/);
      if (!fieldMatch) continue;

      const fieldName = fieldMatch[1];
      let fieldType = fieldMatch[2].replace('?', '').replace('[]', '');
      const attrs = fieldMatch[3] || '';
      const isNullable = fieldMatch[2].includes('?');
      const isArray = fieldMatch[2].includes('[]');

      // Skip relation fields that are just references (no @id, just model names)
      // e.g. "posts  Post[]" — these are virtual relation fields, not real columns
      if (isArray && !attrs.includes('@relation')) continue;
      if (!attrs.includes('@') && /^[A-Z]/.test(fieldType) && !['String', 'Int', 'Float', 'Boolean', 'DateTime', 'Json', 'Bytes', 'BigInt', 'Decimal'].includes(fieldType)) continue;

      const isPK = /@id\b/.test(attrs);
      const isUnique = /@unique\b/.test(attrs) || isPK;

      // FK detection: @relation(fields: [localField], references: [refField])
      let isFK = false;
      let referencesTable = null;
      let referencesColumn = null;
      if (attrs.includes('@relation')) {
        // Look for the fields and references in the relation attribute
        const fieldsMatch = attrs.match(/fields:\s*\[(\w+)\]/);
        const refsMatch = attrs.match(/references:\s*\[(\w+)\]/);
        if (fieldsMatch && refsMatch) {
          // This is the FK field itself — find the relation model name from the field type
          referencesTable = fieldType;
          referencesColumn = refsMatch[1];
          isFK = true;
        }
      }

      columns.push({
        name: fieldName,
        type: mapPrismaType(fieldType),
        isPK,
        isFK,
        isUnique,
        isNullable,
        referencesTable,
        referencesColumn
      });
    }

    // Second pass: find FK fields (ones with @relation but the companion ID field)
    // e.g. author   User   @relation(fields: [authorId], references: [id])
    //      authorId String
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.includes('@relation')) continue;
      const fieldsMatch = trimmed.match(/fields:\s*\[(\w+)\]/);
      const refsMatch = trimmed.match(/references:\s*\[(\w+)\]/);
      const typeMatch = trimmed.match(/^\w+\s+(\w+)/);
      if (fieldsMatch && refsMatch && typeMatch) {
        const fkFieldName = fieldsMatch[1];
        const refTable = typeMatch[1];
        const refCol = refsMatch[1];
        // Mark the actual ID column as FK
        const fkCol = columns.find(c => c.name === fkFieldName);
        if (fkCol) {
          fkCol.isFK = true;
          fkCol.referencesTable = refTable;
          fkCol.referencesColumn = refCol;
        }
      }
    }

    if (columns.length > 0) {
      tables.push({
        tableName: modelName,
        file: filePath,
        dbType: 'prisma',
        columns,
        relations: []
      });
    }
  }

  return tables;
}

function mapPrismaType(t) {
  const map = {
    String: 'VARCHAR', Int: 'INT', Float: 'FLOAT', Boolean: 'BOOLEAN',
    DateTime: 'TIMESTAMP', Json: 'JSONB', Bytes: 'BYTES', BigInt: 'BIGINT', Decimal: 'DECIMAL'
  };
  return map[t] || t.toUpperCase();
}

// ─────────────────────────────────────────────────────────────────────────────
// SQL PARSER (CREATE TABLE statements)
// ─────────────────────────────────────────────────────────────────────────────

function parseSQL(content, filePath) {
  const tables = [];
  // Match CREATE TABLE blocks (with optional IF NOT EXISTS)
  const tableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["'`]?(\w+)["'`]?\s*\(([^;]+)\)/gim;
  let match;

  while ((match = tableRegex.exec(content)) !== null) {
    const tableName = match[1];
    const body = match[2];
    const columns = [];
    const tablePKs = new Set();

    // First pass: find table-level PRIMARY KEY constraints
    const pkConstraintRegex = /PRIMARY\s+KEY\s*\(([^)]+)\)/gi;
    let pkMatch;
    while ((pkMatch = pkConstraintRegex.exec(body)) !== null) {
      pkMatch[1].split(',').forEach(col => tablePKs.add(col.trim().replace(/["'`]/g, '')));
    }

    // Parse each column definition line
    const lines = body.split(',').map(l => l.trim()).filter(Boolean);
    for (const line of lines) {
      const upperLine = line.toUpperCase().trim();
      // Skip constraint lines that aren't column defs
      if (upperLine.startsWith('CONSTRAINT') || upperLine.startsWith('PRIMARY KEY') ||
          upperLine.startsWith('UNIQUE') || upperLine.startsWith('INDEX') ||
          upperLine.startsWith('KEY ') || upperLine.startsWith('CHECK')) continue;

      // Column: name type [constraints...]
      const colMatch = line.match(/^["'`]?(\w+)["'`]?\s+(\w+(?:\s*\([^)]*\))?)(.*)?$/i);
      if (!colMatch) continue;

      const colName = colMatch[1];
      const colType = colMatch[2].trim();
      const rest = (colMatch[3] || '').toUpperCase();

      const isPK = rest.includes('PRIMARY KEY') || tablePKs.has(colName);
      const isUnique = rest.includes('UNIQUE') || isPK;
      const isNullable = !rest.includes('NOT NULL') && !isPK;

      // FK detection: REFERENCES table(column)
      let isFK = false;
      let referencesTable = null;
      let referencesColumn = null;
      const fkMatch = line.match(/REFERENCES\s+["'`]?(\w+)["'`]?\s*\(\s*["'`]?(\w+)["'`]?\s*\)/i);
      if (fkMatch) {
        isFK = true;
        referencesTable = fkMatch[1];
        referencesColumn = fkMatch[2];
      }

      // Also infer FK from naming conventions if not explicit
      if (!isFK && !isPK && (colName.endsWith('_id') || colName.endsWith('Id'))) {
        const inferredTable = colName.replace(/_id$/i, '').replace(/Id$/, '');
        if (inferredTable && inferredTable !== colName) {
          isFK = true;
          referencesTable = capitalize(inferredTable);
          referencesColumn = 'id';
        }
      }

      columns.push({
        name: colName,
        type: normalizeType(colType),
        isPK,
        isFK,
        isUnique,
        isNullable,
        referencesTable,
        referencesColumn
      });
    }

    if (columns.length > 0) {
      tables.push({
        tableName: capitalize(tableName),
        file: filePath,
        dbType: 'sql',
        columns,
        relations: []
      });
    }
  }

  return tables;
}

function normalizeType(t) {
  const upper = t.toUpperCase().replace(/\s*\([^)]*\)/, '');
  const map = {
    'INT': 'INT', 'INTEGER': 'INT', 'BIGINT': 'BIGINT', 'SMALLINT': 'SMALLINT',
    'SERIAL': 'SERIAL', 'BIGSERIAL': 'BIGSERIAL',
    'VARCHAR': 'VARCHAR', 'CHARACTER VARYING': 'VARCHAR', 'TEXT': 'TEXT', 'CHAR': 'CHAR',
    'BOOLEAN': 'BOOLEAN', 'BOOL': 'BOOLEAN',
    'FLOAT': 'FLOAT', 'DOUBLE PRECISION': 'FLOAT', 'REAL': 'FLOAT', 'NUMERIC': 'DECIMAL', 'DECIMAL': 'DECIMAL',
    'TIMESTAMP': 'TIMESTAMP', 'TIMESTAMPTZ': 'TIMESTAMP', 'DATE': 'DATE', 'TIME': 'TIME',
    'UUID': 'UUID', 'JSON': 'JSON', 'JSONB': 'JSONB', 'BYTEA': 'BYTES'
  };
  return map[upper] || upper;
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPEORM PARSER (TypeScript decorators)
// ─────────────────────────────────────────────────────────────────────────────

function parseTypeORM(content, filePath) {
  const tables = [];
  // Find @Entity() decorated classes
  const entityRegex = /@Entity\s*\([^)]*\)\s*(?:export\s+)?class\s+(\w+)/g;
  let entityMatch;

  while ((entityMatch = entityRegex.exec(content)) !== null) {
    const className = entityMatch[1];
    // Extract class body
    const classStart = entityMatch.index;
    const classBody = extractClassBody(content, classStart);
    const columns = [];

    // Find decorated properties
    const propRegex = /(@(?:PrimaryGeneratedColumn|PrimaryColumn|Column|ManyToOne|OneToMany|OneToOne|ManyToMany|JoinColumn|CreateDateColumn|UpdateDateColumn|DeleteDateColumn)\s*\([^)]*\))\s*(?:\n\s*(?:@\w+[^)]*\)\s*\n\s*)?)?(?:readonly\s+|public\s+|protected\s+|private\s+)?(\w+)(?:\?|!)?:\s*([\w<>[\],\s|]+)/g;
    let propMatch;

    while ((propMatch = propRegex.exec(classBody)) !== null) {
      const decorator = propMatch[1];
      const fieldName = propMatch[2];
      const fieldType = propMatch[3].trim();

      const isPK = /@PrimaryGeneratedColumn\b/.test(decorator) || /@PrimaryColumn\b/.test(decorator);
      const isNullable = /nullable:\s*true/.test(decorator) || fieldName.endsWith('?');
      const isUnique = /unique:\s*true/.test(decorator) || isPK;

      // FK detection from @ManyToOne / @JoinColumn / naming
      let isFK = false;
      let referencesTable = null;
      let referencesColumn = 'id';

      if (/@ManyToOne\b/.test(decorator) || /@OneToOne\b/.test(decorator)) {
        // ManyToOne(() => User, ...) 
        const refMatch = decorator.match(/\(\)\s*=>\s*(\w+)/);
        if (refMatch) {
          isFK = true;
          referencesTable = refMatch[1];
        }
      } else if (!isPK && (fieldName.endsWith('Id') || fieldName.endsWith('_id'))) {
        const inferred = fieldName.replace(/Id$/, '').replace(/_id$/, '');
        if (inferred) { isFK = true; referencesTable = capitalize(inferred); }
      }

      // Map TS types to SQL types
      let sqlType = mapTSType(fieldType);

      columns.push({
        name: fieldName,
        type: sqlType,
        isPK,
        isFK,
        isUnique,
        isNullable,
        referencesTable,
        referencesColumn: isFK ? referencesColumn : null
      });
    }

    if (columns.length > 0) {
      tables.push({
        tableName: className,
        file: filePath,
        dbType: 'typeorm',
        columns,
        relations: []
      });
    }
  }

  return tables;
}

// ─────────────────────────────────────────────────────────────────────────────
// DRIZZLE ORM PARSER
// ─────────────────────────────────────────────────────────────────────────────

function parseDrizzle(content, filePath) {
  const tables = [];
  // Match: export const users = pgTable('users', { ... })
  const tableRegex = /(?:export\s+const\s+(\w+)\s*=\s*)?(?:pgTable|sqliteTable|mysqlTable)\s*\(\s*['"](\w+)['"]\s*,\s*\{([^}]+)\}/g;
  let match;

  while ((match = tableRegex.exec(content)) !== null) {
    const varName = match[1] || match[2];
    const tableName = match[2];
    const body = match[3];
    const columns = [];

    const fieldRegex = /(\w+)\s*:\s*(serial|integer|bigint|text|varchar|boolean|timestamp|uuid|json|jsonb|real|numeric|date|time|char|smallint)\s*\(([^)]*)\)([^,]*)/gi;
    let fieldMatch;

    while ((fieldMatch = fieldRegex.exec(body)) !== null) {
      const fieldName = fieldMatch[1];
      const fieldType = fieldMatch[2].toUpperCase();
      const attrs = fieldMatch[4] || '';

      const isPK = /\.primaryKey\b/.test(attrs) || fieldType === 'SERIAL';
      const isUnique = /\.unique\b/.test(attrs) || isPK;
      const isNullable = !isPK;

      // FK: references(() => otherTable.col)
      let isFK = false, referencesTable = null, referencesColumn = null;
      const refMatch = attrs.match(/\.references\s*\(\s*\(\)\s*=>\s*(\w+)\.(\w+)/);
      if (refMatch) {
        isFK = true;
        referencesTable = capitalize(refMatch[1]);
        referencesColumn = refMatch[2];
      } else if (!isPK && (fieldName.endsWith('Id') || fieldName.endsWith('_id'))) {
        const inferred = fieldName.replace(/Id$/, '').replace(/_id$/, '');
        if (inferred) { isFK = true; referencesTable = capitalize(inferred); referencesColumn = 'id'; }
      }

      columns.push({
        name: fieldName,
        type: fieldType,
        isPK,
        isFK,
        isUnique,
        isNullable,
        referencesTable,
        referencesColumn
      });
    }

    if (columns.length > 0) {
      tables.push({
        tableName: capitalize(tableName),
        file: filePath,
        dbType: 'drizzle',
        columns,
        relations: []
      });
    }
  }

  return tables;
}

// ─────────────────────────────────────────────────────────────────────────────
// MONGOOSE PARSER
// ─────────────────────────────────────────────────────────────────────────────

function parseMongoose(content, filePath) {
  const tables = [];

  // Find Schema constructor calls and the variable they are assigned to
  // e.g.: const userSchema = new mongoose.Schema({ ... }) or new Schema({ ... })
  const schemaRegex = /(?:const|let|var)\s+(\w+)\s*=\s*new\s+(?:mongoose\.)?Schema\s*\(\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/g;
  let match;

  while ((match = schemaRegex.exec(content)) !== null) {
    const schemaVarName = match[1];
    const body = match[2];

    // Derive model name from schema variable name: userSchema → User
    const modelName = deriveMongooseModelName(schemaVarName, content);
    const columns = [];

    // Add implicit _id primary key for MongoDB
    columns.push({
      name: '_id',
      type: 'ObjectId',
      isPK: true,
      isFK: false,
      isUnique: true,
      isNullable: false,
      referencesTable: null,
      referencesColumn: null
    });

    // Parse field definitions: fieldName: Type or fieldName: { type: Type, required: true, ref: 'Model' }
    const fieldLines = body.split('\n');
    for (const line of fieldLines) {
      const trimmed = line.trim().replace(/,$/, '');
      if (!trimmed || trimmed.startsWith('//')) continue;

      // Simple field: name: String
      const simpleMatch = trimmed.match(/^(\w+)\s*:\s*(String|Number|Boolean|Date|Buffer|Mixed|ObjectId|mongoose\.Schema\.Types\.\w+)\s*$/i);
      if (simpleMatch && simpleMatch[1] !== '_id') {
        columns.push({
          name: simpleMatch[1],
          type: mapMongooseType(simpleMatch[2]),
          isPK: false,
          isFK: false,
          isUnique: false,
          isNullable: true,
          referencesTable: null,
          referencesColumn: null
        });
        continue;
      }

      // Object field: name: { type: ObjectId, ref: 'User', required: true }
      const objMatch = trimmed.match(/^(\w+)\s*:\s*\{([^}]+)\}/);
      if (objMatch && objMatch[1] !== '_id') {
        const fieldName = objMatch[1];
        const fieldBody = objMatch[2];
        const typeMatch = fieldBody.match(/type\s*:\s*([\w.]+)/);
        const refMatch = fieldBody.match(/ref\s*:\s*['"](\w+)['"]/);
        const requiredMatch = fieldBody.match(/required\s*:\s*true/);
        const uniqueMatch = fieldBody.match(/unique\s*:\s*true/);

        const isFK = !!refMatch;
        const fieldType = typeMatch ? mapMongooseType(typeMatch[1]) : 'MIXED';

        columns.push({
          name: fieldName,
          type: fieldType,
          isPK: false,
          isFK,
          isUnique: !!uniqueMatch,
          isNullable: !requiredMatch,
          referencesTable: refMatch ? refMatch[1] : null,
          referencesColumn: isFK ? '_id' : null
        });
      }
    }

    if (columns.length > 1) { // more than just _id
      tables.push({
        tableName: modelName,
        file: filePath,
        dbType: 'mongoose',
        columns,
        relations: []
      });
    }
  }

  return tables;
}

function deriveMongooseModelName(schemaVar, fullContent) {
  // Try to find: mongoose.model('ModelName', schemaVar)
  const modelCallRegex = new RegExp(`mongoose\\.model\\s*\\(\\s*['"]([^'"]+)['"]\\s*,\\s*${schemaVar}\\b`);
  const m = fullContent.match(modelCallRegex);
  if (m) return m[1];
  // Fallback: strip 'Schema' suffix and capitalize
  return capitalize(schemaVar.replace(/Schema$/i, '').replace(/schema$/i, ''));
}

function mapMongooseType(t) {
  const lower = t.toLowerCase().replace('mongoose.schema.types.', '');
  const map = {
    'string': 'VARCHAR', 'number': 'FLOAT', 'boolean': 'BOOLEAN',
    'date': 'TIMESTAMP', 'buffer': 'BYTES', 'mixed': 'MIXED',
    'objectid': 'ObjectId', 'array': 'ARRAY'
  };
  return map[lower] || t.toUpperCase();
}

// ─────────────────────────────────────────────────────────────────────────────
// SQLALCHEMY PARSER (Python)
// ─────────────────────────────────────────────────────────────────────────────

function parseSQLAlchemy(content, filePath) {
  const tables = [];

  // Match SQLAlchemy model classes
  const classRegex = /^class\s+(\w+)\s*\(([^)]+)\)\s*:/gm;
  let classMatch;

  while ((classMatch = classRegex.exec(content)) !== null) {
    const className = classMatch[1];
    const baseClass = classMatch[2];

    // Exclude Pydantic DTOs (BaseModel, RootModel) and non-DB classes unless they define __tablename__
    if (/BaseModel|RootModel|GenericModel|Pydantic\b/.test(baseClass) && !/__tablename__/.test(content)) continue;
    if (!/Base|db\.Model|DeclarativeBase|AbstractConcreteBase|SQLModel|Model/.test(baseClass)) continue;

    // Extract the class body (next lines until next class or end)
    const classStart = classMatch.index + classMatch[0].length;
    const nextClassMatch = /^class\s+\w+/m.exec(content.slice(classStart));
    const classBody = nextClassMatch
      ? content.slice(classStart, classStart + nextClassMatch.index)
      : content.slice(classStart);

    // Skip Pydantic DTOs or helper schemas that do not declare columns or tables
    if (!classBody.includes('Column') && !classBody.includes('mapped_column') && !classBody.includes('__tablename__')) {
      continue;
    }

    // Determine custom table name if __tablename__ exists
    let tableName = className;
    const tableNameMatch = classBody.match(/__tablename__\s*=\s*['"](\w+)['"]/);
    if (tableNameMatch) {
      tableName = tableNameMatch[1];
    }

    const columns = [];

    // Column definitions: field_name = Column(Type, ...) OR field_name: Mapped[...] = mapped_column(Type, ...)
    const colRegex = /(\w+)\s*(?::\s*Mapped\[[^\]]+\])?\s*=\s*(?:db\.)?(?:Column|mapped_column)\s*\(([^)]*)\)/g;
    let colMatch;

    while ((colMatch = colRegex.exec(classBody)) !== null) {
      const fieldName = colMatch[1];
      if (['__tablename__', 'metadata', 'query'].includes(fieldName)) continue;

      const colBody = colMatch[2];
      const isPK = /primary_key\s*=\s*True/.test(colBody);
      const isUnique = /unique\s*=\s*True/.test(colBody) || isPK;
      const isNullable = /nullable\s*=\s*False/.test(colBody) ? false : !isPK;

      // Type
      const typeMatch = colBody.match(/^(Integer|String|Float|Boolean|DateTime|Text|BigInteger|Numeric|Date|Time|JSON|LargeBinary|UUID|ARRAY)\b/i);
      const sqlType = typeMatch ? typeMatch[1].toUpperCase() : 'TEXT';

      // FK: ForeignKey('table.column')
      let isFK = false, referencesTable = null, referencesColumn = null;
      const fkMatch = colBody.match(/ForeignKey\s*\(\s*['"](\w+)\.(\w+)['"]/);
      if (fkMatch) {
        isFK = true;
        referencesTable = capitalize(fkMatch[1]);
        referencesColumn = fkMatch[2];
      } else if (!isPK && (fieldName.endsWith('_id') || fieldName.endsWith('_fk'))) {
        const inferred = fieldName.replace(/_id$/, '').replace(/_fk$/, '');
        if (inferred) { isFK = true; referencesTable = capitalize(inferred); referencesColumn = 'id'; }
      }

      columns.push({
        name: fieldName,
        type: sqlType === 'STRING' ? 'VARCHAR' : sqlType,
        isPK,
        isFK,
        isUnique,
        isNullable,
        referencesTable,
        referencesColumn
      });
    }

    if (columns.length > 0) {
      tables.push({
        tableName,
        file: filePath,
        dbType: 'sqlalchemy',
        columns,
        relations: []
      });
    }
  }

  return tables;
}

// ─────────────────────────────────────────────────────────────────────────────
// DJANGO ORM PARSER (Python)
// ─────────────────────────────────────────────────────────────────────────────

function parseDjango(content, filePath) {
  const tables = [];

  const classRegex = /^class\s+(\w+)\s*\(([^)]*models\.Model[^)]*)\)\s*:/gm;
  let classMatch;

  while ((classMatch = classRegex.exec(content)) !== null) {
    const className = classMatch[1];
    const classStart = classMatch.index + classMatch[0].length;
    const nextClassMatch = /^class\s+\w+/m.exec(content.slice(classStart));
    const classBody = nextClassMatch
      ? content.slice(classStart, classStart + nextClassMatch.index)
      : content.slice(classStart);

    const columns = [];

    // Implicit PK
    columns.push({
      name: 'id',
      type: 'INT',
      isPK: true,
      isFK: false,
      isUnique: true,
      isNullable: false,
      referencesTable: null,
      referencesColumn: null
    });

    // Field definitions: field_name = models.FieldType(...)
    const fieldRegex = /(\w+)\s*=\s*models\.(AutoField|BigAutoField|CharField|TextField|IntegerField|BigIntegerField|FloatField|DecimalField|BooleanField|DateField|DateTimeField|TimeField|EmailField|URLField|SlugField|UUIDField|JSONField|FileField|ImageField|ForeignKey|OneToOneField|ManyToManyField)\s*\(([^)]*)\)/g;
    let fieldMatch;

    while ((fieldMatch = fieldRegex.exec(classBody)) !== null) {
      const fieldName = fieldMatch[1];
      const fieldType = fieldMatch[2];
      const fieldArgs = fieldMatch[3];

      if (['id', 'objects', 'Meta'].includes(fieldName)) continue;

      const isPK = fieldType === 'AutoField' || fieldType === 'BigAutoField';
      const isNullable = /null\s*=\s*True/.test(fieldArgs);
      const isUnique = /unique\s*=\s*True/.test(fieldArgs) || isPK;

      let isFK = false, referencesTable = null, referencesColumn = 'id';
      if (fieldType === 'ForeignKey' || fieldType === 'OneToOneField') {
        isFK = true;
        // ForeignKey('ModelName', ...) or ForeignKey(ModelName, ...)
        const refMatch = fieldArgs.match(/^['"]?(\w+)['"]?\s*,/) || fieldArgs.match(/^(\w+)\b/);
        if (refMatch && refMatch[1] !== 'self') {
          referencesTable = refMatch[1];
        }
      }

      columns.push({
        name: fieldName + (isFK ? '_id' : ''),
        type: mapDjangoType(fieldType),
        isPK,
        isFK,
        isUnique,
        isNullable,
        referencesTable,
        referencesColumn: isFK ? referencesColumn : null
      });
    }

    if (columns.length > 1) {
      tables.push({
        tableName: className,
        file: filePath,
        dbType: 'django',
        columns,
        relations: []
      });
    }
  }

  return tables;
}

function mapDjangoType(t) {
  const map = {
    AutoField: 'INT', BigAutoField: 'BIGINT', CharField: 'VARCHAR', TextField: 'TEXT',
    IntegerField: 'INT', BigIntegerField: 'BIGINT', FloatField: 'FLOAT', DecimalField: 'DECIMAL',
    BooleanField: 'BOOLEAN', DateField: 'DATE', DateTimeField: 'TIMESTAMP', TimeField: 'TIME',
    EmailField: 'VARCHAR', URLField: 'VARCHAR', SlugField: 'VARCHAR', UUIDField: 'UUID',
    JSONField: 'JSONB', FileField: 'VARCHAR', ImageField: 'VARCHAR',
    ForeignKey: 'INT', OneToOneField: 'INT', ManyToManyField: 'INT[]'
  };
  return map[t] || 'TEXT';
}

// ─────────────────────────────────────────────────────────────────────────────
// POST-PROCESSING: Relationship inference & resolution
// ─────────────────────────────────────────────────────────────────────────────

function normalizeName(s) {
  if (!s) return '';
  return s.replace(/([a-z0-9])([A-Z])/g, '$1_$2')
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '');
}

function resolveRelationships(tables) {
  const tableMap = new Map();

  for (const t of tables) {
    const norm = normalizeName(t.tableName);
    if (!tableMap.has(norm)) tableMap.set(norm, t);

    // Add singular/plural normalized variants
    if (norm.endsWith('s')) {
      const singular = norm.slice(0, -1);
      if (!tableMap.has(singular)) tableMap.set(singular, t);
      if (norm.endsWith('es')) {
        const singularEs = norm.slice(0, -2);
        if (!tableMap.has(singularEs)) tableMap.set(singularEs, t);
      }
    } else {
      const plural = norm + 's';
      if (!tableMap.has(plural)) tableMap.set(plural, t);
      const pluralEs = norm + 'es';
      if (!tableMap.has(pluralEs)) tableMap.set(pluralEs, t);
    }
  }

  for (const table of tables) {
    for (const col of table.columns) {
      if (!col.isFK || !col.referencesTable) continue;

      const refNorm = normalizeName(col.referencesTable);
      const refTable = tableMap.get(refNorm);

      if (refTable) {
        col.referencesTable = refTable.tableName; // Normalize referenced table name to target exact table
      }

      // Determine cardinality (heuristic: FK column being unique → 1:1, otherwise 1:N)
      const cardinality = col.isUnique ? '1:1' : '1:N';

      const exists = table.relations.some(
        r => r.fromColumn === col.name && r.toTable === col.referencesTable
      );
      if (!exists) {
        table.relations.push({
          type: cardinality,
          fromTable: table.tableName,
          fromColumn: col.name,
          toTable: col.referencesTable,
          toColumn: col.referencesColumn || 'id'
        });
      }
    }

    // Detect M:N via junction table heuristic (table has exactly 2 FK columns and nothing else meaningful)
    const fkCols = table.columns.filter(c => c.isFK);
    const nonFkNonPk = table.columns.filter(c => !c.isFK && !c.isPK);
    if (fkCols.length === 2 && nonFkNonPk.length <= 2) {
      table.relations.forEach(r => { r.type = 'N:M'; });
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function capitalize(s) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function mapTSType(t) {
  const clean = t.replace(/\s*\|.*/, '').replace(/\[\]/, '').trim();
  const map = {
    string: 'VARCHAR', number: 'INT', boolean: 'BOOLEAN',
    Date: 'TIMESTAMP', Buffer: 'BYTES', any: 'MIXED', object: 'JSONB',
    String: 'VARCHAR', Number: 'INT', Boolean: 'BOOLEAN'
  };
  return map[clean] || clean.toUpperCase();
}

function extractClassBody(content, startIdx) {
  // Find the opening brace of the class and extract until matching close
  let braceDepth = 0;
  let started = false;
  let result = '';
  for (let i = startIdx; i < content.length; i++) {
    const ch = content[i];
    if (ch === '{') { braceDepth++; started = true; }
    if (started) result += ch;
    if (ch === '}') { braceDepth--; if (started && braceDepth === 0) break; }
  }
  return result;
}
