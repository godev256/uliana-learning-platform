import { mkdirSync } from 'node:fs';
import { dirname,resolve } from 'node:path';
let connection;
export const production=()=>process.env.VERCEL==='1'||process.env.NODE_ENV==='production';
const schema=[
 `CREATE TABLE IF NOT EXISTS account_users (id TEXT PRIMARY KEY, login TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('teacher','student')), created_at BIGINT NOT NULL)`,
 `CREATE UNIQUE INDEX IF NOT EXISTS single_teacher ON account_users(role) WHERE role='teacher'`,
 `CREATE TABLE IF NOT EXISTS account_sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES account_users(id), expires_at BIGINT NOT NULL)`,
 `CREATE TABLE IF NOT EXISTS account_profiles (student_id TEXT PRIMARY KEY REFERENCES account_users(id), schedule TEXT NOT NULL DEFAULT '[]', lessons TEXT NOT NULL DEFAULT '[]')`,
 `CREATE TABLE IF NOT EXISTS account_calendar (student_id TEXT PRIMARY KEY REFERENCES account_users(id), changes TEXT NOT NULL DEFAULT '[]')`,
 `CREATE TABLE IF NOT EXISTS account_boards (student_id TEXT PRIMARY KEY REFERENCES account_users(id), notebook TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0)`,
 `CREATE TABLE IF NOT EXISTS account_board_groups (student_id TEXT NOT NULL REFERENCES account_users(id), id TEXT NOT NULL, title TEXT NOT NULL, sort_order INTEGER NOT NULL, PRIMARY KEY(student_id,id))`,
 `CREATE TABLE IF NOT EXISTS account_board_topics (student_id TEXT NOT NULL REFERENCES account_users(id), id TEXT NOT NULL, title TEXT NOT NULL, sort_order INTEGER NOT NULL, notebook TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(student_id,id))`,
 `CREATE TABLE IF NOT EXISTS account_topic_documents (student_id TEXT NOT NULL, topic_id TEXT NOT NULL, asset_id TEXT NOT NULL, name TEXT NOT NULL, page_count INTEGER NOT NULL, PRIMARY KEY(student_id,topic_id), FOREIGN KEY(student_id,topic_id) REFERENCES account_board_topics(student_id,id))`,
 `CREATE TABLE IF NOT EXISTS account_assets (student_id TEXT NOT NULL REFERENCES account_users(id), asset_id TEXT NOT NULL, part INTEGER NOT NULL, total INTEGER NOT NULL, mime TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY(student_id,asset_id,part))`,
 `CREATE TABLE IF NOT EXISTS account_attempts (attempt_key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, reset_at BIGINT NOT NULL)`,
];
export async function purgeTrash(query){
 const cutoff=Date.now()-7*86400000;
 await query("DELETE FROM account_topic_documents WHERE EXISTS(SELECT 1 FROM account_board_topics t WHERE t.student_id=account_topic_documents.student_id AND t.id=account_topic_documents.topic_id AND t.id<>'main' AND t.deleted_at<=?)",[cutoff]);
 await query("DELETE FROM account_board_topics WHERE id<>'main' AND deleted_at<=?",[cutoff]);
}
export async function database(){
 if(!connection)connection=(async()=>{
  let query;
  if(process.env.DATABASE_URL){
   const {Pool}=await import('pg');const pool=new Pool({connectionString:process.env.DATABASE_URL,max:3,connectionTimeoutMillis:10000,idleTimeoutMillis:10000});
   query=async(sql,args=[])=>{let n=0;const result=await pool.query(sql.replace(/\?/g,()=>`$${++n}`),args);return result.rows;};
  }else{
   if(production())throw Object.assign(new Error('Storage unavailable'),{status:503});
   const {DatabaseSync}=await import('node:sqlite');const file=process.env.ACCOUNTS_DB_PATH||resolve('.local/accounts.sqlite');mkdirSync(dirname(file),{recursive:true});const sqlite=new DatabaseSync(file);sqlite.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
   query=async(sql,args=[])=>sqlite.prepare(sql).all(...args);
  }
  for(const sql of schema)await query(sql);
  const columns=process.env.DATABASE_URL?await query("SELECT column_name AS name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='account_board_topics'"):await query('PRAGMA table_info(account_board_topics)');
  if(!columns.some(column=>column.name==='deleted_at'))await query('ALTER TABLE account_board_topics ADD COLUMN deleted_at BIGINT');
  if(!columns.some(column=>column.name==='group_id'))await query('ALTER TABLE account_board_topics ADD COLUMN group_id TEXT');
  await purgeTrash(query);
  const timer=setInterval(()=>purgeTrash(query).catch(()=>console.error('Board trash cleanup failed')),60000);timer.unref();
  return {query};
 })().catch(error=>{connection=null;throw error;});
 return connection;
}
