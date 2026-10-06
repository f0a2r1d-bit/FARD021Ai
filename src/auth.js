import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import {findUserById} from "./db.js";
const secret=process.env.JWT_SECRET;
export const hashPassword=password=>bcrypt.hash(password,12);
export const verifyPassword=(password,hash)=>bcrypt.compare(password,hash);
export function signToken(user){if(!secret)throw new Error("JWT_SECRET تنظیم نشده است.");return jwt.sign({sub:user.id},secret,{expiresIn:"7d"})}
export function auth(req,res,next){try{if(!secret)throw new Error();const h=req.headers.authorization||"",t=h.startsWith("Bearer ")?h.slice(7):null;if(!t)return res.status(401).json({error:"ورود لازم است"});const p=jwt.verify(t,secret),u=findUserById(p.sub);if(!u)throw new Error();req.user=u;next()}catch{return res.status(401).json({error:"نشست شما معتبر نیست"})}}
export const admin=(req,res,next)=>req.user?.is_admin?next():res.status(403).json({error:"دسترسی مدیر لازم است"});