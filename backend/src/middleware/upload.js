import multer from 'multer'
import { HttpError } from '../utils/httpError.js'

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024, files: 1 }, fileFilter: (req, file, callback) => { if (file.mimetype !== 'application/pdf') return callback(new HttpError(400, 'Only PDF files are allowed')); callback(null, true) } })
export const pdfUpload = (req, res, next) => upload.single('pdf')(req, res, (error) => { if (error) return next(error); if (!req.file) return next(new HttpError(400, 'A PDF file is required')); if (!req.file.originalname.toLowerCase().endsWith('.pdf') || req.file.buffer.subarray(0, 5).toString() !== '%PDF-') return next(new HttpError(400, 'The uploaded file is not a valid PDF')); next() })
