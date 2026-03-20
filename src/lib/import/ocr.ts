import Tesseract from 'tesseract.js'
import { sampleOcrByFileName } from './fixtures'

export async function extractOcrText(file: File) {
  const fixture = sampleOcrByFileName[file.name]
  if (fixture) return fixture

  const result = await Tesseract.recognize(file, 'eng')
  return result.data.text
}
