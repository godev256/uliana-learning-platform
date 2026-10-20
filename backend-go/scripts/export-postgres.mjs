// Private read-only migration snapshot. Run with DATABASE_URL in the environment.
import {Client} from 'pg';
import {writeFileSync,mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
const target=resolve(process.argv[2]??'.local/postgres-snapshot.json');
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required');
const client=new Client({connectionString:process.env.DATABASE_URL});
await client.connect();
try{
 await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
 const users=(await client.query('SELECT id,login,role,created_at,password_hash FROM users ORDER BY id')).rows;
 const boards=(await client.query('SELECT * FROM boards ORDER BY student_id,sort_order,id')).rows;
 const pages=(await client.query('SELECT student_id,board_id,number,items FROM pages ORDER BY student_id,board_id,number')).rows;
 const documents=(await client.query('SELECT * FROM documents')).rows;
 const profiles=(await client.query('SELECT * FROM profiles ORDER BY student_id')).rows;
 const assets=(await client.query('SELECT * FROM assets ORDER BY student_id,id,part')).rows;
 const snapshot={version:1,users:users.map(u=>({id:u.id,login:u.login,role:u.role,createdAt:Number(u.created_at),passwordHash:u.password_hash})),boards:boards.map(b=>{
  const objects=pages.filter(p=>p.student_id===b.student_id&&p.board_id===b.id).flatMap(p=>p.items),byId=new Map(objects.map(item=>[item.id,item]));
  if(b.item_order.length!==objects.length||b.item_order.some(id=>!byId.has(id)))throw new Error('Board object order is inconsistent; export aborted');
  const document=documents.find(d=>d.student_id===b.student_id&&d.board_id===b.id);
  return {studentId:b.student_id,topic:{id:b.id,title:b.title,kind:b.kind,sort_order:b.sort_order},notebook:{items:b.item_order.map(id=>byId.get(id)),pageCount:b.page_count},revision:Number(b.revision),...(document?{document:{assetId:document.asset_id,name:document.name,pageCount:document.page_count,pages:[]}}:{})};
 }),profiles:profiles.map(p=>({studentId:p.student_id,schedule:p.schedule,lessons:p.lessons,calendar:p.calendar})),assets:assets.map(a=>({studentId:a.student_id,id:a.id,part:a.part,total:a.total,mime:a.mime,data:a.data.toString('base64')}))};
 await client.query('COMMIT');
 mkdirSync(dirname(target),{recursive:true});writeFileSync(target,JSON.stringify(snapshot),{mode:0o600,flag:'wx'});
 console.log(`Private snapshot: ${users.length} accounts, ${boards.length} boards, ${pages.length} pages, ${assets.length} asset chunks.`);
}finally{await client.end();}
