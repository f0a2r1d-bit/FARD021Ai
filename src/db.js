import fs from "fs";
import path from "path";

fs.mkdirSync("data", { recursive: true });
const file = path.join("data", "fard021.json");

const initial = {
  users: [], usage: [], generations: [], support_tickets: [],
  conversations: [], messages: [],
  seq: { users: 0, usage: 0, generations: 0, support_tickets: 0, conversations: 0, messages: 0 }
};

let store;
try {
  store = JSON.parse(fs.readFileSync(file, "utf8"));
} catch {
  store = structuredClone(initial);
}
for (const k of Object.keys(initial)) if (!(k in store)) store[k] = structuredClone(initial[k]);
for (const k of Object.keys(initial.seq)) if (!(k in store.seq)) store.seq[k] = 0;
const adminEmail=String(process.env.ADMIN_EMAIL||"").trim().toLowerCase();
if(adminEmail){for(const u of store.users) if(u.email===adminEmail){u.is_admin=1;if(u.credits<1000)u.credits=1000;}}

const now = () => new Date().toISOString();
function persist() {
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(store));
  fs.renameSync(tmp, file);
}
function idFor(kind) { store.seq[kind] = Number(store.seq[kind] || 0) + 1; return store.seq[kind]; }
function clone(x) { return x == null ? x : JSON.parse(JSON.stringify(x)); }

export const findUserByEmail = email =>
  clone(store.users.find(x => x.email === String(email).toLowerCase()));

export const findUserById = id => {
  const u = store.users.find(x => x.id === Number(id));
  return clone(u && { id:u.id, email:u.email, name:u.name, plan:u.plan, credits:u.credits, is_admin:u.is_admin, created_at:u.created_at });
};

export function createUser({email,passwordHash,name,isAdmin=false}) {
  const user = { id:idFor("users"), email:String(email).toLowerCase(), password_hash:passwordHash,
    name, plan:"free", credits:50, is_admin:isAdmin?1:0, created_at:now() };
  store.users.push(user); persist();
  return findUserById(user.id);
}
export function addCredits(userId,amount) {
  const u=store.users.find(x=>x.id===Number(userId)); if(u) u.credits=Math.max(0,u.credits+Number(amount||0)); persist(); return findUserById(userId);
}
export function consumeCredits(userId,cost=1) {
  const u=store.users.find(x=>x.id===Number(userId)), n=Number(cost||1);
  if(!u || u.credits<n) return false;
  u.credits-=n; persist(); return true;
}
export function addUsage(userId,kind,cost=1) {
  store.usage.push({id:idFor("usage"),user_id:Number(userId),kind,cost:Number(cost||1),created_at:now()}); persist();
}
export function dailyUsage(userId) {
  const start=new Date(); start.setHours(0,0,0,0);
  return store.usage.filter(x=>x.user_id===Number(userId)&&new Date(x.created_at)>=start).reduce((s,x)=>s+Number(x.cost||0),0);
}
export function addGeneration(row) {
  const x={...row,id:idFor("generations"),created_at:now()};
  store.generations.push(x); persist(); return clone(x);
}
export function updateGeneration(id,patch) {
  const x=store.generations.find(x=>x.id===Number(id)); if(!x)return undefined;
  Object.assign(x,patch); persist(); return clone(x);
}
export const recentGenerations=userId =>
  clone(store.generations.filter(x=>x.user_id===Number(userId)).sort((a,b)=>b.id-a.id).slice(0,100));

export function createTicket(userId,subject,message) {
  const x={id:idFor("support_tickets"),user_id:Number(userId),subject,message,status:"open",admin_reply:null,created_at:now(),updated_at:now()};
  store.support_tickets.push(x); persist(); return clone(x);
}
export const userTickets=userId =>
  clone(store.support_tickets.filter(x=>x.user_id===Number(userId)).sort((a,b)=>b.id-a.id).slice(0,50));
export const allTickets=() =>
  clone(store.support_tickets.map(t=>{const u=store.users.find(x=>x.id===t.user_id);return {...t,email:u?.email,name:u?.name};}).sort((a,b)=>b.id-a.id).slice(0,200));
export function updateTicket(id,status,adminReply) {
  const x=store.support_tickets.find(x=>x.id===Number(id)); if(!x)return undefined;
  x.status=status; x.admin_reply=adminReply||null; x.updated_at=now(); persist(); return clone(x);
}
export const allUsers=() =>
  clone(store.users.map(u=>({id:u.id,email:u.email,name:u.name,plan:u.plan,credits:u.credits,is_admin:u.is_admin,created_at:u.created_at})).sort((a,b)=>b.id-a.id));
export function setUserPlan(id,plan,credits) {
  const u=store.users.find(x=>x.id===Number(id)); if(u){u.plan=plan;u.credits=Number(credits||0);persist();} return findUserById(id);
}
export function createConversation(userId,title="گفتگوی جدید") {
  const x={id:idFor("conversations"),user_id:Number(userId),title,created_at:now(),updated_at:now()};
  store.conversations.push(x); persist(); return clone(x);
}
export const conversations=userId =>
  clone(store.conversations.filter(x=>x.user_id===Number(userId)).sort((a,b)=>new Date(b.updated_at)-new Date(a.updated_at)));
export function saveMessage(conversationId,role,content) {
  store.messages.push({id:idFor("messages"),conversation_id:Number(conversationId),role,content,created_at:now()});
  const c=store.conversations.find(x=>x.id===Number(conversationId)); if(c)c.updated_at=now(); persist();
}
export const conversationMessages=id =>
  clone(store.messages.filter(x=>x.conversation_id===Number(id)).sort((a,b)=>a.id-b.id).map(x=>({role:x.role,content:x.content,created_at:x.created_at})));
export const findConversationForUser=(id,userId) =>
  clone(store.conversations.find(x=>x.id===Number(id)&&x.user_id===Number(userId)));
export const findGenerationForUserByExternalId=(userId,externalId) =>
  clone(store.generations.filter(x=>x.user_id===Number(userId)&&x.external_id===externalId).sort((a,b)=>b.id-a.id)[0]);
