// Development transport; production uses the authenticated Go WebSocket handler.
const rooms=new Map();
export function liveBroadcast(room,message){for(const socket of rooms.get(room)??[]){if(socket.readyState===1&&socket.bufferedAmount<2*1024*1024)socket.send(JSON.stringify(message));else socket.terminate();}}
export function liveJoin(room,socket){if(!rooms.has(room))rooms.set(room,new Set());rooms.get(room).add(socket);return()=>{rooms.get(room)?.delete(socket);if(!rooms.get(room)?.size)rooms.delete(room);};}
