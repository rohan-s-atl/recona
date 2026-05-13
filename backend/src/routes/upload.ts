import { Router } from 'express'
import multer from 'multer'

export const uploadRouter = Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.csv', '.tsv', '.xlsx', '.xls', '.ods', '.json']
    cb(null, allowed.some((ext) => file.originalname.toLowerCase().endsWith(ext)))
  },
})

uploadRouter.post('/', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file provided' })

  res.json({
    filename: req.file.originalname,
    sizeBytes: req.file.size,
    status: 'accepted',
  })
})
