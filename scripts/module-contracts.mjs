import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const ts=createRequire(import.meta.url)('typescript');
const root=fileURLToPath(new URL('../',import.meta.url));
async function walk(dir){return (await Promise.all((await fs.readdir(dir,{withFileTypes:true})).map(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]))).flat();}
export async function auditModuleContracts(db){
 const rows=(await db.query("SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public'")).rows;
 const tables=new Map();for(const row of rows){if(!tables.has(row.table_name))tables.set(row.table_name,new Set());tables.get(row.table_name).add(row.column_name);}
 const functions=new Set((await db.query("SELECT proname FROM pg_proc JOIN pg_namespace ON pg_namespace.oid=pronamespace WHERE nspname='public'")).rows.map(row=>row.proname));
 const buckets=new Set((await db.query('SELECT id FROM storage.buckets')).rows.map(row=>row.id));
 const issues=[];const modules=[];
 for(const file of (await walk(path.join(root,'src'))).filter(file=>/\.tsx?$/.test(file))){
  const source=await fs.readFile(file,'utf8');const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true);const vars=new Map();const names=new Set(),rpcs=new Set();
  const uncast=node=>{while(node&&(ts.isAsExpression(node)||ts.isParenthesizedExpression(node)))node=node.expression;return node;};
  const variableWalk=node=>{if(ts.isVariableDeclaration(node)&&ts.isIdentifier(node.name)&&node.initializer)vars.set(node.name.text,node.initializer);ts.forEachChild(node,variableWalk);};variableWalk(ast);
  const tableOf=(node,depth=0)=>{node=uncast(node);if(!node||depth>8)return null;if(ts.isIdentifier(node))return tableOf(vars.get(node.text),depth+1);if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&node.expression.name.text==='from'){const arg=uncast(node.arguments[0]);return arg&&ts.isStringLiteral(arg)?arg.text:null;}return node.expression?tableOf(node.expression,depth+1):null;};
  const fieldsOf=(node,depth=0)=>{node=uncast(node);if(!node||depth>4)return[];if(ts.isIdentifier(node))return fieldsOf(vars.get(node.text),depth+1);if(ts.isArrayLiteralExpression(node))return node.elements.flatMap(e=>fieldsOf(e,depth+1));if(ts.isObjectLiteralExpression(node))return node.properties.flatMap(prop=>ts.isSpreadAssignment(prop)?fieldsOf(prop.expression,depth+1):prop.name?[prop.name.getText(ast).replaceAll('"','').replaceAll("'",'')]:[]);return[];};
  const checkColumn=(table,column)=>{if(tables.has(table)&&column!=='*'&&!column.includes('.')&&!tables.get(table).has(column))issues.push({file:path.relative(root,file),table,column});};
  const visit=node=>{
   if(ts.isCallExpression(node)){
    const expression=uncast(node.expression);const method=ts.isPropertyAccessExpression(expression)?expression.name.text:ts.isIdentifier(expression)?expression.text:'';
    if(method==='from'){const arg=uncast(node.arguments[0]);if(arg&&ts.isStringLiteral(arg)&&!buckets.has(arg.text)){names.add(arg.text);if(!tables.has(arg.text))issues.push({file:path.relative(root,file),missingTable:arg.text});}}
    if(method==='rpc'){const arg=uncast(node.arguments[0]);if(arg&&ts.isStringLiteral(arg)){rpcs.add(arg.text);if(!functions.has(arg.text))issues.push({file:path.relative(root,file),missingFunction:arg.text});}}
    if(ts.isPropertyAccessExpression(expression)){
     const table=tableOf(expression.expression);if(table){
      if(['insert','update','upsert'].includes(method))for(const column of fieldsOf(node.arguments[0]))checkColumn(table,column);
      const first=uncast(node.arguments[0]);
      if(first&&ts.isStringLiteral(first)){
       if(['eq','neq','in','is','gte','lte','order'].includes(method))checkColumn(table,first.text);
       if(method==='select')for(const column of first.text.replace(/\w+(?:!\w+)?\([^)]*\)/g,'').split(',').map(x=>x.trim()).filter(Boolean))checkColumn(table,column.split(':').at(-1));
      }
     }
    }
   }
   ts.forEachChild(node,visit);
  };visit(ast);
  if(names.size||rpcs.size)modules.push({file:path.relative(root,file).replaceAll('\\','/'),tables:[...names].sort(),functions:[...rpcs].sort()});
 }
 const report={checkedAt:new Date().toISOString(),scope:'Static source/database contract audit against a locally migrated PostgreSQL database. This does not exercise every UI interaction.',moduleCount:modules.length,issues,modules};
 await fs.mkdir(path.join(root,'docs'),{recursive:true});await fs.writeFile(path.join(root,'docs/module-contract-audit.json'),JSON.stringify(report,null,2));
 if(issues.length)throw new Error('Module contract gaps: '+JSON.stringify(issues));
 return report;
}
