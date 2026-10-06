import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
fs.mkdirSync("data",{recursive:true});
const db=new Database(path.join("data","fard021.sqlite"));db.pragma("journal_mode = WAL");
db.exec(`
CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT,email TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL,name TEXT NOT NULL,plan TEXT NOT NULL DEFAULT 'free',credits INTEGER NOT NULL DEFAULT 30,is_admin INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS usage (id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,kind TEXT NOT NULL,cost INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(user_id) REFERENCES users(id));
CREATE TABLE IF NOT EXISTS generations (id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,kind TEXT NOT NULL,provider TEXT NOT NULL,model TEXT NOT NULL,prompt TEXT NOT NULL,status TEXT NOT NULL,external_id TEXT,result_url TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(user_id) REFERENCES users(id));
CREATE TABLE IF NOT EXISTS support_tickets (id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,subject TEXT NOT NULL,message TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'open',admin_reply TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(user_id) REFERENCES users(id));
CREATE TABLE IF NOT EXISTS conversations (id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,title TEXT NOT NULL DEFAULT 'گفتگوی جدید',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(user_id) REFERENCES users(id));
CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT,conversation_id INTEGER NOT NULL,role TEXT NOT NULL,content TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(conversation_id) REFERENCES conversations(id));
`);
try{db.exec("ALTER TABLE users ADD COLUMN credits INTEGER NOT NULL DEFAULT 30")}catch{}
try{db.exec("ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0")}catch{}
try{db.exec("ALTER TABLE support_tickets ADD COLUMN admin_reply TEXT")}catch{}
export const findUserByEmail=email=>db.prepare("SELECT * FROM users WHERE email=?").get(email.toLowerCase());
export const findUserById=id=>db.prepare("SELECT id,email,name,plan,credits,is_admin,created_at FROM users WHERE id=?").get(id);
export function createUser({email,passwordHash,name,isAdmin=false}){const info=db.prepare("INSERT INTO users(email,password_hash,name,is_admin) VALUES(?,?,?,?)").run(email.toLowerCase(),passwordHash,name,isAdmin?1:0);return findUserById(info.lastInsertRowid)}
export function addCredits(userId,amount){db.prepare("UPDATE users SET credits=MAX(0,credits+?) WHERE id=?").run(amount,userId);return findUserById(userId)}
export function consumeCredits(userId,cost=1){const r=db.prepare("UPDATE users SET credits=credits-? WHERE id=? AND credits>=?").run(cost,userId,cost,cost);return r.changes>0}
export function addUsage(userId,kind,cost=1){db.prepare("INSERT INTO usage(user_id,kind,cost) VALUES(?,?,?)").run(userId,kind,cost)}
export function dailyUsage(userId){return db.prepare("SELECT COALESCE(SUM(cost),0) count FROM usage WHERE user_id=? AND created_at>=datetime('now','start of day')").get(userId).count}
export function addGeneration(row){const info=db.prepare("INSERT INTO generations(user_id,kind,provider,model,prompt,status,external_id,result_url) VALUES(@user_id,@kind,@provider,@model,@prompt,@status,@external_id,@result_url)").run(row);return db.prepare("SELECT * FROM generations WHERE id=?").get(info.lastInsertRowid)}
export function updateGeneration(id,patch){const keys=Object.keys(patch);if(!keys.length)return db.prepare("SELECT * FROM generations WHERE id=?").get(id);const set=keys.map(k=>`${k}=@${k}`).join(",");db.prepare(`UPDATE generations SET ${set} WHERE id=@id`).run({...patch,id});return db.prepare("SELECT * FROM generations WHERE id=?").get(id)}
export const recentGenerations=userId=>db.prepare("SELECT * FROM generations WHERE user_id=? ORDER BY id DESC LIMIT 100").all(userId);
export function createTicket(userId,subject,message){const info=db.prepare("INSERT INTO support_tickets(user_id,subject,message) VALUES(?,?,?)").run(userId,subject,message);return db.prepare("SELECT * FROM support_tickets WHERE id=?").get(info.lastInsertRowid)}
export const userTickets=userId=>db.prepare("SELECT * FROM support_tickets WHERE user_id=? ORDER BY id DESC LIMIT 50").all(userId);
export const allTickets=()=>db.prepare("SELECT t.*,u.email,u.name FROM support_tickets t JOIN users u ON u.id=t.user_id ORDER BY t.id DESC LIMIT 200").all();
export function updateTicket(id,status,adminReply){db.prepare("UPDATE support_tickets SET status=?,admin_reply=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(status,adminReply||null,id);return db.prepare("SELECT * FROM support_tickets WHERE id=?").get(id)}
export const allUsers=()=>db.prepare("SELECT id,email,name,plan,credits,is_admin,created_at FROM users ORDER BY id DESC").all();
export function setUserPlan(id,plan,credits){db.prepare("UPDATE users SET plan=?,credits=? WHERE id=?").run(plan,credits,id);return findUserById(id)}
export function createConversation(userId,title='گفتگوی جدید'){const r=db.prepare("INSERT INTO conversations(user_id,title) VALUES(?,?)").run(userId,title);return db.prepare("SELECT * FROM conversations WHERE id=?").get(r.lastInsertRowid)}
export const conversations=userId=>db.prepare("SELECT * FROM conversations WHERE user_id=? ORDER BY updated_at DESC").all(userId);
export function saveMessage(conversationId,role,content){db.prepare("INSERT INTO messages(conversation_id,role,content) VALUES(?,?,?)").run(conversationId,role,content);db.prepare("UPDATE conversations SET updated_at=CURRENT_TIMESTAMP WHERE id=?").run(conversationId)}
export const conversationMessages=id=>db.prepare("SELECT role,content,created_at FROM messages WHERE conversation_id=? ORDER BY id ASC").all(id);
export const findConversationForUser=(id,userId)=>db.prepare("SELECT * FROM conversations WHERE id=? AND user_id=?").get(id,userId);
export const findGenerationForUserByExternalId=(userId,externalId)=>db.prepare("SELECT * FROM generations WHERE user_id=? AND external_id=? ORDER BY id DESC LIMIT 1").get(userId,externalId);