import accounts from '../server/accounts.js';
export function accountsApi(){return {name:'accounts-api',configureServer(server){server.middlewares.use((req,res,next)=>{if(req.url.split('?')[0]!=='/api/account')return next();void accounts(req,res);});}};}
