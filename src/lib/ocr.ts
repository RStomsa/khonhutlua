import { createWorker } from 'tesseract.js';

export interface OCRResult {
  success: boolean;
  text: string;
  confidence: number;
  matchedCode: string | null;
  error?: string;
}

/**
 * Recognizes text from an image file using Tesseract.js.
 * @param imageFile - File or Blob of the image.
 * @param onProgress - Optional callback for progress tracking (0 to 1).
 */
export const performOCR = async (
  imageFile: File | Blob,
  _onProgress?: (progress: number) => void
): Promise<OCRResult> => {
  let worker;
  try {
    // Create the Tesseract worker
    worker = await createWorker('eng');
    
    // Perform text recognition
    const ret = await worker.recognize(imageFile);
    const text = ret.data.text || '';
    const confidence = ret.data.confidence || 0;

    // Search for a product code pattern: Letter followed by 3 numbers, a dot, and 2 numbers (e.g. e120.30)
    // We make it case-insensitive and look globally
    const productCodeRegex = /[a-zA-Z]\d{3}\.\d{2}/;
    const match = text.match(productCodeRegex);
    const matchedCode = match ? match[0].toLowerCase() : null;

    await worker.terminate();

    return {
      success: true,
      text: text.trim(),
      confidence,
      matchedCode
    };
  } catch (err: any) {
    console.error('OCR Error:', err);
    if (worker) {
      try {
        await (worker as any).terminate();
      } catch (e) {}
    }
    return {
      success: false,
      text: '',
      confidence: 0,
      matchedCode: null,
      error: err.message || 'Failed to process image'
    };
  }
};
