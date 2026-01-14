
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as pdfjs from 'pdfjs-dist';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

/**
 * Merges multiple PDF files into a single PDF file.
 */
export async function mergePdfs(files: File[]): Promise<Uint8Array> {
  const mergedPdf = await PDFDocument.create();
  for (const file of files) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await PDFDocument.load(arrayBuffer);
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    copiedPages.forEach((page) => mergedPdf.addPage(page));
  }
  return await mergedPdf.save();
}

/**
 * Extracts specific pages from a PDF.
 */
export async function splitPdf(file: File, pageNumbers: number[]): Promise<Uint8Array> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await PDFDocument.load(arrayBuffer);
  const newPdf = await PDFDocument.create();
  
  // pageNumbers is 1-indexed from user input
  const indices = pageNumbers.map(n => n - 1).filter(n => n >= 0 && n < pdf.getPageCount());
  const copiedPages = await newPdf.copyPages(pdf, indices);
  copiedPages.forEach(page => newPdf.addPage(page));
  
  return await newPdf.save();
}

/**
 * Adds a simple text overlay to every page of the PDF.
 */
export async function editPdf(file: File, overlayText: string): Promise<Uint8Array> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await PDFDocument.load(arrayBuffer);
  const font = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pages = pdf.getPages();

  for (const page of pages) {
    const { width, height } = page.getSize();
    page.drawText(overlayText, {
      x: 50,
      y: height - 50,
      size: 30,
      font: font,
      color: rgb(0.9, 0.1, 0.1),
      opacity: 0.5,
    });
  }

  return await pdf.save();
}

/**
 * Extracts text from a PDF file using PDF.js.
 */
export async function extractText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(' ');
    fullText += `--- Page ${i} ---\n${pageText}\n\n`;
  }

  return fullText;
}

/**
 * Creates a simple PDF from text (useful for translation/conversion results).
 */
export async function createPdfFromText(text: string, title: string): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  let page = pdfDoc.addPage();
  const { width, height } = page.getSize();
  const fontSize = 12;
  const margin = 50;
  
  const lines = text.split('\n');
  let cursorY = height - margin;

  for (const line of lines) {
    if (cursorY < margin + 20) {
      page = pdfDoc.addPage();
      cursorY = height - margin;
    }
    page.drawText(line.substring(0, 100), { // Basic wrapping
      x: margin,
      y: cursorY,
      size: fontSize,
      font: font,
      color: rgb(0, 0, 0),
    });
    cursorY -= fontSize + 5;
  }

  return await pdfDoc.save();
}
