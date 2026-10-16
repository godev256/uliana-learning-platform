import {randomBytes,scrypt as scryptCallback,timingSafeEqual,createHash} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt=promisify(scryptCallback);
const options={N:32768,r:8,p:3,maxmem:64*1024*1024};
export const hash=value=>createHash('sha256').update(value).digest('hex');
export const validLogin=value=>typeof value==='string'&&/^[a-z0-9][a-z0-9_.-]{2,31}$/.test(value);
export const validPassword=value=>typeof value==='string'&&value.length>=10&&value.length<=128;
export async function passwordHash(password){const salt=randomBytes(16).toString('hex');const key=await scrypt(password,salt,64,options);return `scrypt-v2:${salt}:${key.toString('hex')}`;}
const dummy='scrypt-v2:00000000000000000000000000000000:'+('00'.repeat(64));
export async function checkPassword(password,encoded=dummy){const [version,salt,key]=encoded.split(':');const candidate=await scrypt(password,salt,64,version==='scrypt-v2'?options:{N:16384,r:8,p:1});const expected=Buffer.from(key,'hex');return expected.length===candidate.length&&timingSafeEqual(expected,candidate);}
export const newToken=()=>randomBytes(32).toString('hex');
export const cookieName='uliana_session';
export function sessionCookie(req,token,maxAge=60*60*24*7){const secure=process.env.VERCEL==='1'||req.headers['x-forwarded-proto']==='https'||req.socket?.encrypted;return `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure?'; Secure':''}`;}
export function readToken(req){return (req.headers.cookie??'').split(';').map(part=>part.trim()).find(part=>part.startsWith(cookieName+'='))?.slice(cookieName.length+1)??'';}
