import nodemailer from 'nodemailer'
import { env } from '../config/env.js'
import { logger } from '../utils/logger.js'

let transporter
function getTransporter() { if (!transporter && env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD) transporter = nodemailer.createTransport({ host: env.SMTP_HOST, port: env.SMTP_PORT, secure: env.SMTP_PORT === 465, auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } }); return transporter }
export async function sendLink({ to, subject, text }) { const client = getTransporter(); if (!client) { logger.info('mail_fallback', { subject, recipientDomain: to.split('@')[1] }); return } try { await client.sendMail({ from: env.SMTP_FROM, to, subject, text }) } catch (error) { logger.error('mail_delivery_failed', { subject, recipientDomain: to.split('@')[1], error: error.message }) } }
