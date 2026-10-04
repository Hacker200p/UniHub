import { env } from '../config/env.js'

export const REFRESH_COOKIE = 'ush_refresh'
const maxAge = 7 * 24 * 60 * 60 * 1000
export function setRefreshCookie(res, token) { res.setHeader('Set-Cookie', `${REFRESH_COOKIE}=${encodeURIComponent(token)}; Max-Age=${Math.floor(maxAge / 1000)}; Path=/api/auth; HttpOnly; SameSite=${env.COOKIE_SAMESITE}${env.COOKIE_SECURE ? '; Secure' : ''}`) }
export function clearRefreshCookie(res) { res.setHeader('Set-Cookie', `${REFRESH_COOKIE}=; Max-Age=0; Path=/api/auth; HttpOnly; SameSite=${env.COOKIE_SAMESITE}${env.COOKIE_SECURE ? '; Secure' : ''}`) }
export function getRefreshCookie(req) { const header = req.get('cookie') || ''; const match = header.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${REFRESH_COOKIE}=`)); return match ? decodeURIComponent(match.slice(REFRESH_COOKIE.length + 1)) : '' }
