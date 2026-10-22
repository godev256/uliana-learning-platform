import {randomUUID} from 'node:crypto';
import {database,production} from './database.js';
import {hash,validLogin,validPassword,passwordHash,checkPassword,newToken,sessionCookie,readToken} from './security.js';
const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
const safeUser=user=>({id:user.id,login:user.login,role:user.role});
const localSetup=req=>!production()&&['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket?.remoteAddress);
async function bodyOf(req){
 if(req.body&&typeof req.body==='object'){if(Buffer.byteLength(JSON.stringify(req.body))>3500000)fail(413,'Слишком большой запрос.');return req.body;}
 let data='',bytes=0;for await(const chunk of req){bytes+=Buffer.byteLength(chunk);if(bytes>3500000)fail(413,'Слишком большой запрос.');data+=chunk;}
 try{return data?JSON.parse(data):{};}catch{fail(400,'Некорректный запрос.');}
}
function checkOrigin(req){
 if(req.headers['sec-fetch-site']==='cross-site')fail(403,'Запрос отклонён.');
 const origin=req.headers.origin;
 if(!origin)fail(403,'Откройте кабинет на сайте.');
 let host;try{host=new URL(origin).host;}catch{fail(403,'Запрос отклонён.');}
 if(host!==req.headers.host)fail(403,'Запрос отклонён.');
 if(!String(req.headers['content-type']).startsWith('application/json'))fail(415,'Некорректный запрос.');
}
function validateProfile(body){
 const schedule=body.schedule,lessons=body.lessons,calendar=body.calendar;
 if(!Array.isArray(schedule)||schedule.length>14||schedule.some(row=>!Number.isInteger(row.day)||row.day<0||row.day>6||!/^([01]\d|2[0-3]):[0-5]\d$/.test(row.time)||!Number.isInteger(row.duration)||row.duration<15||row.duration>180))fail(400,'Проверьте расписание.');
 if(!Array.isArray(lessons)||lessons.length>500||lessons.some(row=>!/^\d{4}-\d{2}-\d{2}$/.test(row.date)||(!Number.isFinite(Date.parse(row.date))||new Date(row.date).toISOString().slice(0,10)!==row.date)||!(row.grade===null||Number.isInteger(row.grade)&&row.grade>=1&&row.grade<=10)||!(row.homework===null||Number.isInteger(row.homework)&&row.homework>=0&&row.homework<=100)||typeof row.note!=='string'||row.note.length>1000))fail(400,'Проверьте результаты уроков.');
 if(lessons.some(row=>row.attachment!=null&&(!row.attachment||typeof row.attachment.assetId!=='string'||!/^[a-zA-Z0-9-]{16,80}$/.test(row.attachment.assetId)||typeof row.attachment.name!=='string'||!row.attachment.name.length||row.attachment.name.length>512||!Number.isInteger(row.attachment.size)||row.attachment.size<5||row.attachment.size>20*1024*1024)))fail(400,'Проверьте PDF-конспект.');
 const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
 const validTime=value=>typeof value==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(value);
 if(calendar!==undefined&&(!Array.isArray(calendar)||calendar.length>1000||calendar.some(row=>!row||!validDate(row.originalDate)||!validDate(row.date)||!validTime(row.originalTime)||!validTime(row.time)||!Number.isInteger(row.duration)||row.duration<15||row.duration>180)||new Set(calendar.map(row=>`${row.originalDate}T${row.originalTime}`)).size!==calendar.length))fail(400,'Проверьте переносы занятий.');
 return {calendar:calendar?.map(({originalDate,originalTime,date,time,duration})=>({originalDate,originalTime,date,time,duration})),schedule:schedule.map(({day,time,duration})=>({day,time,duration})),lessons:lessons.map(({date,grade,homework,note,attachment})=>({date,grade,homework,note,...(attachment?{attachment:{assetId:attachment.assetId,name:attachment.name,size:attachment.size}}:{})}))};
}
export default async function accounts(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 const reply=(status,data)=>{res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(data));};
 try{
  if(!['GET','POST'].includes(req.method))fail(405,'Метод не поддерживается.');
  if(req.method==='POST')checkOrigin(req);
  const url=new URL(req.url,'http://localhost'),action=url.searchParams.get('action')||'session';
  const {query}=await database();
  const token=readToken(req),session=token?(await query('SELECT u.id,u.login,u.role FROM account_sessions s JOIN account_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?',[hash(token),Date.now()]))[0]:null;
  if(action==='session'&&req.method==='GET')return reply(200,{user:session?safeUser(session):null,setupRequired:localSetup(req)&&!(await query("SELECT id FROM account_users WHERE role='teacher'")).length});
  const body=req.method==='POST'?await bodyOf(req):{};
  if(['setup','login'].includes(action)&&req.method==='POST'){
   const login=typeof body.login==='string'?body.login.trim().toLowerCase():'';
   if(!validLogin(login)||!validPassword(body.password))fail(400,'Логин: 3–32 латинских символа. Пароль: 10–128 символов.');
   if(action==='setup'){
    if(!localSetup(req))fail(403,'Создание учительского кабинета здесь недоступно.');
    if((await query("SELECT id FROM account_users WHERE role='teacher'")).length)fail(409,'Учительский кабинет уже создан.');
    await query('INSERT INTO account_users(id,login,password_hash,role,created_at) VALUES(?,?,?,?,?)',[randomUUID(),login,await passwordHash(body.password),'teacher',Date.now()]);
   }
   const ip=process.env.VERCEL==='1'?String(req.headers['x-forwarded-for']||'').split(',')[0]:req.socket?.remoteAddress;
   await query('DELETE FROM account_attempts WHERE reset_at<?',[Date.now()]);
   const keys=[hash(`login:${login}`),hash(`ip:${ip}`)];
   for(const key of keys){await query('INSERT INTO account_attempts(attempt_key,attempts,reset_at) VALUES(?,1,?) ON CONFLICT(attempt_key) DO UPDATE SET attempts=CASE WHEN account_attempts.reset_at<? THEN 1 ELSE account_attempts.attempts+1 END,reset_at=CASE WHEN account_attempts.reset_at<? THEN ? ELSE account_attempts.reset_at END',[key,Date.now()+900000,Date.now(),Date.now(),Date.now()+900000]);const attempt=(await query('SELECT attempts FROM account_attempts WHERE attempt_key=?',[key]))[0];if(attempt.attempts>(key===keys[0]?12:80))fail(429,'Слишком много попыток. Попробуйте через 15 минут.');}
   const user=(await query('SELECT * FROM account_users WHERE login=?',[login]))[0];const correct=await checkPassword(body.password,user?.password_hash);if(!user||!correct)fail(401,'Неверный логин или пароль.');
   await query('DELETE FROM account_attempts WHERE attempt_key=?',[keys[0]]);
   const next=newToken();await query('DELETE FROM account_sessions WHERE expires_at<?',[Date.now()]);await query('INSERT INTO account_sessions(token_hash,user_id,expires_at) VALUES(?,?,?)',[hash(next),user.id,Date.now()+7*86400000]);res.setHeader('Set-Cookie',sessionCookie(req,next));return reply(200,{user:safeUser(user)});
  }
  if(!session)fail(401,'Войдите в кабинет.');
  if(action==='logout'&&req.method==='POST'){await query('DELETE FROM account_sessions WHERE token_hash=?',[hash(token)]);res.setHeader('Set-Cookie',sessionCookie(req,'',0));return reply(200,{ok:true});}
  const teacher=()=>{if(session.role!=='teacher')fail(403,'Это действие доступно преподавателю.');};
  if(action==='students'){
   teacher();
   if(req.method==='POST'){
    const login=typeof body.login==='string'?body.login.trim().toLowerCase():'';if(!validLogin(login)||!validPassword(body.password))fail(400,'Логин: 3–32 латинских символа. Пароль: не менее 10 символов.');
    const id=randomUUID();await query('INSERT INTO account_users(id,login,password_hash,role,created_at) VALUES(?,?,?,?,?)',[id,login,await passwordHash(body.password),'student',Date.now()]);return reply(201,{student:{id,login,role:'student'}});
   }
   return reply(200,{students:await query("SELECT u.id,u.login,u.created_at,p.schedule,p.lessons FROM account_users u LEFT JOIN account_profiles p ON p.student_id=u.id WHERE u.role='student' ORDER BY u.created_at DESC")});
  }
  const studentId=session.role==='student'?session.id:(body.studentId||url.searchParams.get('studentId'));
  if(session.role==='student'&&(body.studentId&&body.studentId!==session.id||url.searchParams.get('studentId')&&url.searchParams.get('studentId')!==session.id))fail(403,'Этот кабинет вам недоступен.');
  const student=(await query("SELECT id,login,role FROM account_users WHERE id=?",[studentId||'']))[0];if(!student||(student.role!=='student'&&!(session.role==='teacher'&&student.id===session.id&&['topics','board','asset'].includes(action))))fail(404,'Кабинет не найден.');
  if(action==='password'&&req.method==='POST'){
   teacher();if(!validPassword(body.password))fail(400,'Пароль: от 10 до 128 символов.');await query('UPDATE account_users SET password_hash=? WHERE id=?',[await passwordHash(body.password),student.id]);await query('DELETE FROM account_sessions WHERE user_id=?',[student.id]);return reply(200,{ok:true});
  }
  if(action==='profile'){
   if(req.method==='POST'){teacher();const data=validateProfile(body);for(const lesson of data.lessons){if(!lesson.attachment)continue;const parts=await query('SELECT part,total,mime,data FROM account_assets WHERE student_id=? AND asset_id=? ORDER BY part',[student.id,lesson.attachment.assetId]);if(!parts.length||parts.length!==parts[0].total||parts.some((part,index)=>part.part!==index||part.total!==parts.length||part.mime!=='application/pdf')||Buffer.from(parts[0].data,'base64').subarray(0,5).toString()!=='%PDF-'||parts.reduce((sum,part)=>sum+Buffer.from(part.data,'base64').length,0)!==lesson.attachment.size)fail(400,'PDF-конспект не загрузился полностью. Прикрепите его заново.');}await query('INSERT INTO account_profiles(student_id,schedule,lessons) VALUES(?,?,?) ON CONFLICT(student_id) DO UPDATE SET schedule=excluded.schedule,lessons=excluded.lessons',[student.id,JSON.stringify(data.schedule),JSON.stringify(data.lessons)]);if(data.calendar!==undefined)await query('INSERT INTO account_calendar(student_id,changes) VALUES(?,?) ON CONFLICT(student_id) DO UPDATE SET changes=excluded.changes',[student.id,JSON.stringify(data.calendar)]);return reply(200,{ok:true});}
   const profile=(await query('SELECT schedule,lessons FROM account_profiles WHERE student_id=?',[student.id]))[0];const calendar=(await query('SELECT changes FROM account_calendar WHERE student_id=?',[student.id]))[0];return reply(200,{student,schedule:JSON.parse(profile?.schedule||'[]'),lessons:JSON.parse(profile?.lessons||'[]'),calendar:JSON.parse(calendar?.changes||'[]')});
  }
  if(action==='topics'||action==='board'){
   // Copy the existing notebook once; topic 'main' keeps legacy URLs working.
   await query("INSERT INTO account_board_topics(student_id,id,title,sort_order,notebook,revision) SELECT ?,'main','Текущий урок',0,notebook,revision FROM account_boards WHERE student_id=? ON CONFLICT(student_id,id) DO NOTHING",[student.id,student.id]);
   await query("INSERT INTO account_board_topics(student_id,id,title,sort_order,notebook,revision) VALUES(?,'main','Текущий урок',0,?,0) ON CONFLICT(student_id,id) DO NOTHING",[student.id,JSON.stringify({items:[],pageCount:3})]);
   if(action==='topics'){
    const groups=await query('SELECT id,title,sort_order FROM account_board_groups WHERE student_id=? ORDER BY sort_order,id',[student.id]);
    const topics=await query("SELECT t.id,t.title,t.group_id AS \"groupId\",t.sort_order,CASE WHEN d.topic_id IS NULL THEN 'board' ELSE 'pdf' END AS kind FROM account_board_topics t LEFT JOIN account_topic_documents d ON d.student_id=t.student_id AND d.topic_id=t.id WHERE t.student_id=? AND t.deleted_at IS NULL ORDER BY t.sort_order,t.id",[student.id]);
    if(req.method==='GET'){
     const trash=session.role==='teacher'?await query("SELECT t.id,t.title,t.group_id AS \"groupId\",t.sort_order,t.deleted_at,CASE WHEN d.topic_id IS NULL THEN 'board' ELSE 'pdf' END AS kind FROM account_board_topics t LEFT JOIN account_topic_documents d ON d.student_id=t.student_id AND d.topic_id=t.id WHERE t.student_id=? AND t.deleted_at>? ORDER BY t.deleted_at DESC,t.id",[student.id,Date.now()-7*86400000]):undefined;
     return reply(200,{topics,groups,...(trash?{trash:trash.map(row=>({...row,deletedAt:new Date(Number(row.deleted_at)).toISOString(),expiresAt:new Date(Number(row.deleted_at)+7*86400000).toISOString()}))}:{})});
    }
    teacher();
    if(['group-create','group-rename','group-delete','move'].includes(body.operation)){
     const group=groups.find(row=>row.id===body.groupId);
     if(body.operation==='move'){
      if(body.topicId==='main')fail(400,'Текущий урок остаётся вне групп.');if(!topics.some(row=>row.id===body.topicId))fail(404,'Доска не найдена.');if(body.groupId&&!group)fail(404,'Группа не найдена.');
      await query('UPDATE account_board_topics SET group_id=? WHERE student_id=? AND id=? AND deleted_at IS NULL',[body.groupId||null,student.id,body.topicId]);
     }else if(body.operation==='group-delete'){
      if(!group)fail(404,'Группа не найдена.');await query('UPDATE account_board_topics SET group_id=NULL WHERE student_id=? AND group_id=?',[student.id,body.groupId]);await query('DELETE FROM account_board_groups WHERE student_id=? AND id=?',[student.id,body.groupId]);
     }else{
      const title=typeof body.title==='string'?body.title.trim():'';if(!title||title.length>80)fail(400,'Название группы: от 1 до 80 символов.');
      if(body.operation==='group-create'){
       if(groups.length>=50)fail(400,'Можно создать до 50 групп досок.');const id=randomUUID();await query('INSERT INTO account_board_groups(student_id,id,title,sort_order) VALUES(?,?,?,?)',[student.id,id,title,Math.max(-1,...groups.map(row=>row.sort_order))+1]);return reply(201,{group:{id,title}});
      }else{if(!group)fail(404,'Группа не найдена.');await query('UPDATE account_board_groups SET title=? WHERE student_id=? AND id=?',[title,student.id,body.groupId]);}
     }
     return reply(200,{ok:true});
    }
    if(body.operation==='delete'){
     if(body.topicId==='main')fail(400,'Основная доска должна остаться.');
     if(!topics.some(topic=>topic.id===body.topicId))fail(404,'Доска не найдена.');
     const removed=await query('UPDATE account_board_topics SET deleted_at=?,revision=revision+1 WHERE student_id=? AND id=? AND deleted_at IS NULL RETURNING id',[Date.now(),student.id,body.topicId]);if(!removed.length)fail(404,'Доска не найдена.');
    }else if(body.operation==='restore'){
     if(topics.length>=100)fail(400,'Сначала освободите место: можно хранить до 100 активных досок.');
     const restored=await query("UPDATE account_board_topics SET deleted_at=NULL,revision=revision+1 WHERE student_id=? AND id=? AND id<>'main' AND deleted_at>? RETURNING id",[student.id,body.topicId,Date.now()-7*86400000]);if(!restored.length)fail(404,'Доска не найдена в корзине.');
    }else if(body.operation==='reorder'){
     if(!Array.isArray(body.ids)||body.ids.length!==topics.length||new Set(body.ids).size!==topics.length||body.ids.some(id=>!topics.some(topic=>topic.id===id)))fail(400,'Проверьте порядок досок.');
     for(let i=0;i<body.ids.length;i++)await query('UPDATE account_board_topics SET sort_order=? WHERE student_id=? AND id=?',[i,student.id,body.ids[i]]);
    }else{
     const title=typeof body.title==='string'?body.title.trim():'';if(!title||title.length>80)fail(400,'Название доски: от 1 до 80 символов.');
     if(body.operation==='create'){
      if(topics.length>=100)fail(400,'Можно создать до 100 досок для ученика.');
      if(body.groupId&&!groups.some(row=>row.id===body.groupId))fail(404,'Группа не найдена.');
      const document=body.document;
      if(document){
       if(typeof document.assetId!=='string'||document.assetId.length>80||typeof document.name!=='string'||!document.name.length||document.name.length>512||!Number.isInteger(document.pageCount)||document.pageCount<1||document.pageCount>100||!Array.isArray(document.pages)||document.pages.length!==document.pageCount||document.pages.some((page,index)=>!page||page.assetId!==`${document.assetId}:page:${index+1}`||!Number.isFinite(page.width)||!Number.isFinite(page.height)||page.width<=0||page.height<=0||page.width>10000||page.height>10000))fail(400,'Проверьте PDF и его страницы.');
       const parts=await query('SELECT part,total,mime,data FROM account_assets WHERE student_id=? AND asset_id=? ORDER BY part',[student.id,document.assetId]);
       if(!parts.length||parts.length!==parts[0].total||parts.some((part,index)=>part.part!==index||part.total!==parts.length||part.mime!=='application/pdf')||Buffer.from(parts[0].data,'base64').subarray(0,5).toString()!=='%PDF-'||parts.reduce((sum,part)=>sum+Buffer.from(part.data,'base64').length,0)>20*1024*1024)fail(400,'PDF не загрузился полностью.');
       for(const page of document.pages){const parts=await query('SELECT part,total,mime FROM account_assets WHERE student_id=? AND asset_id=? ORDER BY part',[student.id,page.assetId]);if(!parts.length||parts.length!==parts[0].total||parts.some((part,index)=>part.part!==index||part.total!==parts.length||!part.mime.startsWith('image/')))fail(400,'Страницы PDF не загрузились полностью.');}
      }
      const notebook=document?{pageCount:document.pageCount,items:document.pages.map((image,index)=>{const ratio=Math.min(1600/image.width,2376/image.height),width=image.width*ratio,height=image.height*ratio;return {id:randomUUID(),type:'image',page:index,color:'#212123',size:4,assetId:image.assetId,background:true,documentId:document.assetId,sourcePage:index+1,points:[[(1600-width)/2,0],[(1600+width)/2,height]]};})}:{items:[],pageCount:1};
      const id=randomUUID();await query('INSERT INTO account_board_topics(student_id,id,title,sort_order,notebook,revision,group_id) VALUES(?,?,?,?,?,0,?)',[student.id,id,title,Math.max(...topics.map(topic=>topic.sort_order))+1,JSON.stringify(notebook),body.groupId||null]);
      if(document)await query('INSERT INTO account_topic_documents(student_id,topic_id,asset_id,name,page_count) VALUES(?,?,?,?,?)',[student.id,id,document.assetId,document.name,document.pageCount]);
      return reply(201,{topic:{id,title,kind:document?'pdf':'board',groupId:body.groupId||''}});
     }else if(body.operation==='rename'){
      if(!topics.some(topic=>topic.id===body.topicId))fail(404,'Доска не найдена.');await query('UPDATE account_board_topics SET title=? WHERE student_id=? AND id=?',[title,student.id,body.topicId]);
     }else fail(400,'Неизвестное действие.');
    }
    return reply(200,{ok:true});
   }
   const topicId=body.topicId||url.searchParams.get('topicId')||'main';if(typeof topicId!=='string'||topicId.length>80)fail(400,'Некорректная доска.');
   const board=(await query('SELECT id,title,group_id AS \"groupId\",notebook,revision FROM account_board_topics WHERE student_id=? AND id=? AND deleted_at IS NULL',[student.id,topicId]))[0];if(!board)fail(404,'Доска не найдена.');
   if(req.method==='POST'){
    const book=body.notebook;if(!book||!Array.isArray(book.items)||book.items.length>10000||!Number.isInteger(book.pageCount)||book.pageCount<1||book.pageCount>100||!Number.isInteger(body.revision)||book.items.some(item=>!item||typeof item.id!=='string'||typeof item.type!=='string'||!Number.isInteger(item.page)||item.page<0||item.page>=book.pageCount))fail(400,'Не удалось сохранить доску: проверьте данные.');
    const updated=await query('UPDATE account_board_topics SET notebook=?,revision=revision+1 WHERE student_id=? AND id=? AND revision=? AND deleted_at IS NULL RETURNING revision',[JSON.stringify(book),student.id,topicId,body.revision]);if(!updated.length)fail(409,'Доска изменена в другом окне. Обновите её перед продолжением.');return reply(200,{revision:updated[0].revision});
   }
   const document=(await query('SELECT asset_id,name,page_count FROM account_topic_documents WHERE student_id=? AND topic_id=?',[student.id,topicId]))[0];return reply(200,{student,topic:{id:board.id,title:board.title,groupId:board.groupId||'',kind:document?'pdf':'board'},notebook:JSON.parse(board.notebook),revision:board.revision});
  }
  if(action==='asset'){
   const id=body.assetId||url.searchParams.get('assetId'),part=Number(req.method==='POST'?body.part:url.searchParams.get('part')||0);
   if(typeof id!=='string'||id.length>180||!Number.isInteger(part)||part<0||part>=200)fail(400,'Некорректный файл.');
   if(req.method==='POST'){
    if(!Number.isInteger(body.total)||body.total<1||body.total>200||part>=body.total||typeof body.mime!=='string'||body.mime.length>150||typeof body.data!=='string'||body.data.length>350000||!/^[A-Za-z0-9+/=]*$/.test(body.data))fail(400,'Некорректный файл.');
    // Assets are immutable; a retry is harmless and cannot replace another file's bytes.
    const existing=(await query('SELECT data,total,mime FROM account_assets WHERE student_id=? AND asset_id=? AND part=?',[student.id,id,part]))[0];if(existing&&(existing.data!==body.data||existing.total!==body.total||existing.mime!==body.mime))fail(409,'Файл с таким идентификатором уже существует.');
    await query('INSERT INTO account_assets(student_id,asset_id,part,total,mime,data) VALUES(?,?,?,?,?,?) ON CONFLICT(student_id,asset_id,part) DO NOTHING',[student.id,id,part,body.total,body.mime,body.data]);return reply(200,{ok:true});
   }
   const asset=(await query('SELECT data,total,mime FROM account_assets WHERE student_id=? AND asset_id=? AND part=?',[student.id,id,part]))[0];if(!asset)fail(404,'Файл не найден.');return reply(200,asset);
  }
  fail(404,'Страница не найдена.');
 }catch(error){const status=error.status||(error.code==='23505'||[1555,2067].includes(error.errcode)||String(error.code).startsWith('ERR_SQLITE_CONSTRAINT')?409:500);reply(status,{error:status===503?'Кабинеты пока недоступны.':status===409&&!error.status?'Такой логин уже занят.':status===500?'Не удалось выполнить действие. Попробуйте ещё раз.':error.message});}
}
