import {createInterface} from 'node:readline/promises';
import {randomUUID} from 'node:crypto';
import {database} from '../server/database.js';
import {validLogin,validPassword,passwordHash} from '../server/security.js';
async function secret(prompt){
 if(!process.stdin.isTTY)throw new Error('Запустите команду в обычном терминале.');
 process.stdout.write(prompt);process.stdin.setRawMode(true);process.stdin.resume();process.stdin.setEncoding('utf8');
 return new Promise((resolve,reject)=>{let value='';const done=(error)=>{process.stdin.off('data',receive);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');error?reject(error):resolve(value);};const receive=text=>{for(const char of text){if(char==='\r'||char==='\n')return done();if(char==='\u0003')return done(new Error('Отменено.'));if(char==='\u007f'||char==='\b'){if(value){value=value.slice(0,-1);process.stdout.write('\b \b');}}else if(char>=' '){value+=char;process.stdout.write('*');}}};process.stdin.on('data',receive);});
}
try{
 const {query}=await database();if((await query("SELECT id FROM account_users WHERE role='teacher'")).length)throw new Error('Учительский кабинет уже существует.');
 const input=createInterface({input:process.stdin,output:process.stdout});const login=(await input.question('Логин преподавателя: ')).trim().toLowerCase();input.close();
 const password=await secret('Пароль (от 10 символов): '),repeat=await secret('Повторите пароль: ');
 if(!validLogin(login)||!validPassword(password)||password!==repeat)throw new Error('Проверьте логин, длину и совпадение паролей.');
 await query('INSERT INTO account_users(id,login,password_hash,role,created_at) VALUES(?,?,?,?,?)',[randomUUID(),login,await passwordHash(password),'teacher',Date.now()]);
 console.log('Учительский кабинет создан. Теперь можно войти по своему логину и паролю.');process.exit(0);
}catch(error){console.error(error.message);process.exit(1);}
