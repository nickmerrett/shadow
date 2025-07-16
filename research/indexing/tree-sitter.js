#!/usr/bin/env node
/**
 * codebase-analyze.js – cross‑file graph extractor for TypeScript / TSX
 * -------------------------------------------------------------------------
 * • Recursively scans a project folder, ignoring junk (node_modules, .git, dist …)
 * • Tree‑sitter captures definitions, calls, imports, exports in each file
 * • Resolves call edges across relative imports to build an internal call‑graph
 * • Outputs JSON (default) or Graphviz DOT with --dot; optional compiler signatures with --types
 *
 *   $ node codebase-analyze.js ./src                    # JSON to stdout
 *   $ node codebase-analyze.js . --dot | dot -Tsvg -o graph.svg
 *   $ node codebase-analyze.js . --types --out graph.json
 */

const fs   = require('fs');
const path = require('path');
const Parser = require('tree-sitter');
const { typescript: TS, tsx: TSX } = require('tree-sitter-typescript');

// ───────── CLI ───────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
if (!argv.length) {
  console.error('Usage: codebase-analyze.js <root> [--dot] [--png] [--types] [--out <file>]');
  process.exit(1);
}

const rootDir  = path.resolve(argv[0]);
if (!fs.existsSync(rootDir)) {
  console.error(`❌  Directory not found: ${rootDir}`);
  process.exit(1);
}
const WANT_DOT   = argv.includes('--dot');
const WANT_PNG   = argv.includes('--png'); // new flag to render PNG via Graphviz
const WANT_TYPES = argv.includes('--types');
const OUT_PATH = (() => {
  const idx = argv.indexOf('--out');
  return idx !== -1 ? argv[idx + 1] : null;
})();

// ───────── constants ─────────────────────────────────────────────────────
const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '__pycache__', '.next', '.turbo', 'out', '.cache']);
const EXTENSIONS  = ['.ts', '.tsx'];
// Built-in TypeScript primitive types – we don’t create nodes/edges for these
const BUILTIN_TYPES = new Set(['string','number','boolean','any','unknown','void','null','undefined','never','object','bigint','symbol']);

// ───────── parser & query ───────────────────────────────────────────────
const parserTS  = new Parser(); parserTS.setLanguage(TS);
const parserTSX = new Parser(); parserTSX.setLanguage(TSX);

// REPLACE the single-language query with a shared query string + two compiled queries
const QUERY_STR = String.raw`
;;──────────────── definitions ───────────────
(function_declaration name: (identifier) @def.name) @def.node
(lexical_declaration (variable_declarator name: (identifier) @def.name value: (arrow_function))) @def.node
(method_definition name: (property_identifier) @def.name) @def.node
;; type definitions
(interface_declaration (type_identifier) @def.name) @def.node
(type_alias_declaration (type_identifier) @def.name) @def.node

;;──────────────── calls ─────────────────────
(call_expression function: (identifier) @call.name) @call.node
(type_annotation (type_identifier) @type.name)

;;──────────────── imports ───────────────────
;; default import   import foo from 'bar';
(import_statement (import_clause (identifier) @import.alias) source: (string (string_fragment) @import.from))

;; named import w/o alias   import { foo } from 'bar';
(import_statement (import_clause (named_imports (import_specifier name: (identifier) @import.alias))) source: (string (string_fragment) @import.from))

;; named import with alias  import { foo as bar } from 'bar';
(import_statement (import_clause (named_imports (import_specifier name: (identifier) @import.orig alias: (identifier) @import.alias))) source: (string (string_fragment) @import.from))

;; namespace import  import * as utils from 'bar';
(import_statement (import_clause (namespace_import (identifier) @import.alias)) source: (string (string_fragment) @import.from))

;;──────────────── exports ───────────────────
(export_statement declaration: (function_declaration name: (identifier) @export.name))
(export_statement declaration: (interface_declaration (type_identifier) @export.name))
(export_statement declaration: (type_alias_declaration (type_identifier) @export.name))
(export_statement (export_clause (export_specifier name: (identifier) @export.name)))
`;

const queryTS  = new Parser.Query(TS,  QUERY_STR);
const queryTSX = new Parser.Query(TSX, QUERY_STR);

function pos(node){return{line:node.startPosition.row+1,col:node.startPosition.column+1};}

// ───────── directory walk ───────────────────────────────────────────────
function walk(dir, acc=[]) {
  for (const entry of fs.readdirSync(dir, { withFileTypes:true })) {
    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) walk(path.join(dir, entry.name), acc);
    } else if (entry.isFile()) {
      if (EXTENSIONS.some(ext=>entry.name.endsWith(ext))) acc.push(path.join(dir, entry.name));
    }
  }
  return acc;
}

// ───────── per‑file analysis ────────────────────────────────────────────
function analyzeFile(file) {
  const src  = fs.readFileSync(file, 'utf8');
  const tree = (file.endsWith('.tsx') ? parserTSX : parserTS).parse(src);

  const currentQuery = file.endsWith('.tsx') ? queryTSX : queryTS;

  const defs=[], defByNode=new Map(), calls=[], imports=[], exports=[], typeUses=[];

  for (const m of currentQuery.matches(tree.rootNode)) {
    const caps = Object.create(null);
    for (const c of m.captures) {
      const key = c.name; (caps[key] ||= []).push(c.node);
    }

    // defs
    if (caps['def.name']) {
      const name = src.slice(caps['def.name'][0].startIndex, caps['def.name'][0].endIndex);
      const node = caps['def.node'][0];
      const id   = `${file}:${node.startPosition.row}:${node.startPosition.column}`;
      // grab a short one-line snippet of the definition for display
      const snippet = src
        .slice(node.startIndex, Math.min(node.startIndex + 120, src.length))
        .split('\n')[0]
        .replace(/\s+/g, ' ');

      const def  = { id, file, name, snippet, kind: node.type, ...pos(node) };
      defs.push(def); defByNode.set(node.id, def);
    }

    // calls
    if (caps['call.name']) {
      const name = src.slice(caps['call.name'][0].startIndex, caps['call.name'][0].endIndex);
      calls.push({ name, node:caps['call.node'][0], pos:pos(caps['call.name'][0]) });
    }

    // type uses
    if (caps['type.name']) {
      const name = src.slice(caps['type.name'][0].startIndex, caps['type.name'][0].endIndex);
      const node = caps['type.node'] ? caps['type.node'][0] : caps['type.name'][0];
      typeUses.push({ name, node, pos: pos(caps['type.name'][0]) });
    }

    // imports
    if (caps['import.from']) {
      const module = src.slice(caps['import.from'][0].startIndex, caps['import.from'][0].endIndex).replace(/['"]/g,'');
      const alias  = caps['import.alias'] ? src.slice(caps['import.alias'][0].startIndex, caps['import.alias'][0].endIndex) : null;
      const orig   = caps['import.orig']  ? src.slice(caps['import.orig' ][0].startIndex, caps['import.orig' ][0].endIndex)  : (alias || 'default');
      if (alias) imports.push({ alias, orig, module });
    }

    // exports
    if (caps['export.name']) {
      const name = src.slice(caps['export.name'][0].startIndex, caps['export.name'][0].endIndex);
      exports.push(name);
    }
  }

  // link calls to enclosing defs
  for (const call of calls) {
    let cur = call.node.parent;
    while (cur && !defByNode.has(cur.id)) cur = cur.parent;
    call.from = cur ? defByNode.get(cur.id).id : `<${path.relative(rootDir,file)}:top>`;
    delete call.node;
  }

  // link type uses to enclosing defs
  for (const tu of typeUses) {
    let cur = tu.node.parent;
    while (cur && !defByNode.has(cur.id)) cur = cur.parent;
    tu.from = cur ? defByNode.get(cur.id).id : `<${path.relative(rootDir,file)}:top>`;
    delete tu.node;
  }
  return { defs, calls, imports, exports, typeUses };
}

// ───────── resolve relative imports ─────────────────────────────────────
function resolveImport(currFile, impPath) {
  if (!impPath.startsWith('.')) return null; // skip packages for now
  const base = path.resolve(path.dirname(currFile), impPath);
  for (const ext of EXTENSIONS) {
    const cand = base + ext; if (fs.existsSync(cand)) return cand;
  }
  for (const ext of EXTENSIONS) {
    const cand = path.join(base, 'index' + ext); if (fs.existsSync(cand)) return cand;
  }
  return null;
}

// ───────── main pipeline ────────────────────────────────────────────────
console.time('scan');
const files = walk(rootDir);
console.log(`Parsing ${files.length} files …`);

const fileData = new Map();
files.forEach(f=>fileData.set(f, analyzeFile(f)));

// build maps
const defById=new Map(), defsByFile=new Map();
for(const [file,{defs}] of fileData){
  const m=new Map(); defs.forEach(d=>{m.set(d.name,d); defById.set(d.id,d);});
  defsByFile.set(file,m);
}
const importMapByFile=new Map(), exportSetByFile=new Map();
for(const [file,{imports,exports}] of fileData){
  const m=new Map(); imports.forEach(i=>m.set(i.alias,i)); importMapByFile.set(file,m);
  exportSetByFile.set(file,new Set(exports));
}

// build edges
const edges=[], externCalls=[], externTypes=[];
for(const [file,{calls}] of fileData){
  const aliasMap = importMapByFile.get(file);
  for(const call of calls){
    let target = null;
    // same file
    if(defsByFile.get(file)?.has(call.name)) target = defsByFile.get(file).get(call.name);
    // imported
    else if(aliasMap?.has(call.name)){
      const imp = aliasMap.get(call.name);
      const targetFile = resolveImport(file, imp.module);
      if(targetFile && exportSetByFile.get(targetFile)?.has(imp.orig)){
        target = defsByFile.get(targetFile)?.get(imp.orig);
      }
    }
    if(target) edges.push({from:call.from, to:target.id});
    else externCalls.push({from:call.from, to:call.name});
  }
}

// add edges for type uses ➜ type definitions
for(const [file,{typeUses}] of fileData){
  const aliasMap = importMapByFile.get(file);
  for(const tu of typeUses){
    if(BUILTIN_TYPES.has(tu.name)) continue;
    let target = null;
    // same file
    if(defsByFile.get(file)?.has(tu.name)) target = defsByFile.get(file).get(tu.name);
    // imported
    else if(aliasMap?.has(tu.name)){
      const imp = aliasMap.get(tu.name);
      const targetFile = resolveImport(file, imp.module);
      if(targetFile && exportSetByFile.get(targetFile)?.has(imp.orig)){
        target = defsByFile.get(targetFile)?.get(imp.orig);
      }
    }
    if(target) edges.push({from:tu.from, to:target.id});
    else externTypes.push({from:tu.from, to:tu.name});
  }
}
console.timeEnd('scan');
console.log(`Found ${defById.size} defs, ${edges.length} internal edges, ${externCalls.length} external calls, ${externTypes.length} external types.`);

// ───────── optional TypeScript signatures ───────────────────────────────
if(WANT_TYPES){
  try{
    const { Project } = require('ts-morph');
    const proj = new Project({ tsConfigFilePath: findTsconfig(rootDir) });
    for(const def of defById.values()){
      const sf = proj.getSourceFile(def.file); if(!sf) continue;
      const fn = sf.getFunctions().find(f=>f.getName()===def.name);
      if(fn){
        const sig = fn.getSignature();
        def.signature = sig ? sig.getDeclaration().getText().replace(/\s+/g,' ').slice(0,120)+'…' : undefined;
      }
    }
  }catch(e){ console.warn('⚠️  --types failed:',e.message); }
}
function findTsconfig(start){
  let dir=path.resolve(start);
  while(dir!==path.dirname(dir)){
    if(fs.existsSync(path.join(dir,'tsconfig.json'))) return path.join(dir,'tsconfig.json');
    dir=path.dirname(dir);
  }
  return undefined;
}

// ───────── output ───────────────────────────────────────────────────────
function output(content){
  if(OUT_PATH) fs.writeFileSync(OUT_PATH,content,'utf8');
  else process.stdout.write(content);
}

if (WANT_DOT || WANT_PNG) {
  let dot = 'digraph G {\n  rankdir=LR; node [shape=box,fontname="Fira Code"]\n';

  const esc = (str='') => str.replace(/"/g, '\\"');

  for (const def of defById.values()) {
    const label = esc(`${def.name}\n${def.snippet || ''}`);
    const shape = /interface_declaration|type_alias_declaration/.test(def.kind) ? 'ellipse' : 'box';
    dot += `  "${def.id}" [label="${label}" shape=${shape}];\n`;
  }
  for (const e of edges) dot += `  "${e.from}" -> "${e.to}";\n`;
  for (const e of externCalls) dot += `  "${e.from}" -> "${e.to}" [style=dashed];\n`;
  for (const e of externTypes) dot += `  "${e.from}" -> "${e.to}" [style=dashed,color=blue];\n`;
  dot += '}\n';

  if (WANT_PNG) {
    const { execSync } = require('child_process');
    try {
      const pngBuf = execSync('dot -Tpng', { input: dot });
      const outFile = OUT_PATH ? (OUT_PATH.endsWith('.png') ? OUT_PATH : `${OUT_PATH}.png`) : 'graph.png';
      fs.writeFileSync(outFile, pngBuf);
      console.log(`🖼  PNG graph written to ${outFile}`);
    } catch (err) {
      console.error('❌  Failed to run Graphviz dot – ensure it is installed and on PATH.');
      process.exit(1);
    }
  } else {
    output(dot);
  }
} else {
  output(JSON.stringify({ nodes: [...defById.values()], edges, externCalls, externTypes }, null, 2));
}
