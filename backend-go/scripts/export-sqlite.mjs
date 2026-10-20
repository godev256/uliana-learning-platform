// Read-only bridge from the previous backend. Run with Node.js 24+.
import {DatabaseSync} from 'node:sqlite';
import {writeFileSync,mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
const source=resolve(process.argv[2]??'../.local/accounts.sqlite'),target=resolve(process.argv[3]??'.local/legacy-snapshot.json');
if(source===target)throw new Error('Source and destination must differ');
const db=new DatabaseSync(source,{readOnly:true});
const tables=new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row=>row.name));
const rows=name=>tables.has(name)?db.prepare(`SELECT * FROM ${name}`).all():[];
const documents=rows('account_topic_documents');
const boards=rows('account_board_topics').map(row=>{const document=documents.find(doc=>doc.student_id===row.student_id&&doc.topic_id===row.id);return {studentId:row.student_id,topic:{id:row.id,title:row.title,kind:document?'pdf':'board',sort_order:row.sort_order},notebook:JSON.parse(row.notebook),revision:row.revision,...(document?{document:{assetId:document.asset_id,name:document.name,pageCount:document.page_count,pages:[]}}:{})};});
for(const row of rows('account_boards'))if(!boards.some(board=>board.studentId===row.student_id&&board.topic.id==='main'))boards.push({studentId:row.student_id,topic:{id:'main',title:'Текущий урок',kind:'board',sort_order:0},notebook:JSON.parse(row.notebook),revision:row.revision});
const calendars=rows('account_calendar');
const snapshot={version:1,users:rows('account_users').map(u=>({id:u.id,login:u.login,role:u.role,createdAt:u.created_at,passwordHash:u.password_hash})),boards,profiles:rows('account_profiles').map(p=>({studentId:p.student_id,schedule:JSON.parse(p.schedule),lessons:JSON.parse(p.lessons),calendar:JSON.parse(calendars.find(c=>c.student_id===p.student_id)?.changes??'[]')})),assets:rows('account_assets').map(a=>({studentId:a.student_id,id:a.asset_id,part:a.part,total:a.total,mime:a.mime,data:a.data}))};
db.close();mkdirSync(dirname(target),{recursive:true});writeFileSync(target,JSON.stringify(snapshot),{mode:0o600,flag:'wx'});console.log(`Exported ${snapshot.users.length} accounts, ${boards.length} boards, ${snapshot.assets.length} asset chunks to a private local snapshot.`);
