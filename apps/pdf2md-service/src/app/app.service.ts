import { Inject, Injectable } from '@nestjs/common';
import { Pdf2MArkdownDto } from 'library-shared';
import { get} from 'axios'
import { PDFDocument } from 'pdf-lib'
import { ClientProxy } from '@nestjs/microservices';
import {uploadToS3} from '@aikb/s3-service'
import {} from '@aikb/mineru-client'

@Injectable()
export class AppService {
  constructor(@Inject('pdf_2_markdown_service') private rabbitClient: ClientProxy) {}

  async handlePdf2MdRequest(req: Pdf2MArkdownDto) {
    const pdfInfo:Pdf2MArkdownDto & {
      pdfData: null | Buffer,
      s3Url: null | string
    } = {
      ...req,
      pdfData: null,
      s3Url: null
    };

    if(!req.pageNum){
      // Download pdf and extract page number
      pdfInfo.s3Url = await this.getPdfDownloadUrl(pdfInfo.itemId)
      pdfInfo.pdfData = await this.downloadPdfData(pdfInfo.s3Url)
      pdfInfo.pageNum = await this.calculatePageNum(pdfInfo.pdfData)
    }

    // Get chunking parameters from environment variables
    const chunkSizeThreshold = parseInt(process.env['PDF_CHUNK_SIZE_THRESHOLD'] || '20', 10);
    const chunkSize = parseInt(process.env['PDF_CHUNK_SIZE'] || '10', 10);

    console.log(`Page count: ${pdfInfo.pageNum}, Chunk threshold: ${chunkSizeThreshold}, Chunk size: ${chunkSize}`);

    // Check if chunking is needed
    if (pdfInfo.pageNum && pdfInfo.pageNum > chunkSizeThreshold) {
      console.log(`Page count (${pdfInfo.pageNum}) exceeds threshold (${chunkSizeThreshold}), chunking PDF`);
      
      if (!pdfInfo.pdfData) {
        throw new Error('PDF data is required for chunking but not available');
      }

      // Split PDF into chunks
      const pdfChunks = await this.splitPdfIntoChunks(pdfInfo.pdfData, chunkSize);
      console.log(`PDF split into ${pdfChunks.length} chunks`);

      // Upload each chunk to S3
      const uploadPromises = pdfChunks.map(async (chunk, index) => {
        const chunkFileName = `pdf_parts/${pdfInfo.itemId}@${pdfChunks.length}/${index + 1}.pdf`;
        const chunkBuffer = Buffer.from(chunk);
        
        try {
          const uploadResult = await uploadToS3(
            chunkBuffer,
            chunkFileName,
            'application/pdf'
          );
          console.log(`Uploaded chunk ${index + 1}/${pdfChunks.length} to S3: ${uploadResult}`);
          return {
            chunkIndex: index,
            startPage: index * chunkSize + 1,
            endPage: Math.min((index + 1) * chunkSize, pdfInfo.pageNum!),
            s3Url: uploadResult,
            fileName: chunkFileName
          };
        } catch (error) {
          console.error(`Failed to upload chunk ${index + 1}:`, error);
          throw new Error(`Failed to upload chunk ${index + 1} to S3: ${error}`);
        }
      });

      // Wait for all uploads to complete
      const uploadedChunks = await Promise.all(uploadPromises);
      console.log(`All ${uploadedChunks.length} chunks uploaded successfully`);
      
      // TODO: Process each chunk individually
      // For now, just return the chunking information
      return {
        itemId: pdfInfo.itemId,
        pageNum: pdfInfo.pageNum,
        chunked: true,
        chunkCount: pdfChunks.length,
        chunkSize: chunkSize,
        chunks: uploadedChunks.map((chunk, index) => ({
          chunkIndex: index,
          startPage: chunk.startPage,
          endPage: chunk.endPage,
          s3Url: chunk.s3Url,
          fileName: chunk.fileName
        }))
      };
    } else {
      // Process as single PDF if no chunking needed
      console.log('Processing PDF as single document');
      return {
        itemId: pdfInfo.itemId,
        pageNum: pdfInfo.pageNum,
        chunked: false
      };
    }
  }

  async getPdfDownloadUrl(itemId: string): Promise<string> {
      const bibliographyEndpoint = process.env['BIBLIOGRAPHY_SERVICE_ENDPOINT']
      if (!bibliographyEndpoint) throw new Error('Miss env varible: BIBLIOGRAPHY_SERVICE_ENDPOINT')
      const response = await get(`${bibliographyEndpoint}/library-items/${itemId}/download-url`)
      const pdfUrl = response.data.downloadUrl
      return pdfUrl
  }

  async downloadPdfData(url: string): Promise<Buffer> {
    
    try {
      const response = await get(url, {
        responseType: 'arraybuffer'
      });
      
      return Buffer.from(response.data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to download PDF data for url ${url}: ${errorMessage}`);
    }
  }

  async calculatePageNum(pdfData: Buffer): Promise<number> {
    try {
      // Load PDF document
      const pdfDoc = await PDFDocument.load(pdfData);
      
      // Get page count
      const pageNum = pdfDoc.getPageCount();
      
      return pageNum;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to calculate page number: ${errorMessage}`);
    }
  }

  private async splitPdf(
    existingPdfBytes: Buffer,
    startPage: number,
    endPage: number,
  ): Promise<Uint8Array> {
    try {
      console.log(
        `Starting PDF split: startPage=${startPage}, endPage=${endPage}`,
      );

      // Convert Buffer to Uint8Array to ensure compatibility with pdf-lib
      const pdfBytes = new Uint8Array(existingPdfBytes);
      const pdfDoc = await PDFDocument.load(pdfBytes);

      const totalPages = pdfDoc.getPageCount();
      console.log(`Total pages in PDF: ${totalPages}`);

      if (startPage < 0 || endPage >= totalPages || startPage > endPage) {
        throw new Error(
          `Invalid page range: startPage=${startPage}, endPage=${endPage}, totalPages=${totalPages}`,
        );
      }

      // Create a new PDF document for the split portion
      const newPdfDoc = await PDFDocument.create();

      // Copy pages from the original document to the new one
      const pagesToCopy = endPage - startPage + 1;
      console.log(
        `Copying pages: startPage=${startPage}, endPage=${endPage}, count=${pagesToCopy}`,
      );

      const copiedPages = await newPdfDoc.copyPages(
        pdfDoc,
        Array.from({ length: pagesToCopy }, (_, i) => startPage + i),
      );

      // Add the copied pages to the new document
      copiedPages.forEach((page, index) => {
        newPdfDoc.addPage(page);
      });

      // Save the new PDF document as bytes
      const newPdfBytes = await newPdfDoc.save();
      console.log(`Created new PDF with byte length: ${newPdfBytes.length}`);

      return newPdfBytes;
    } catch (error) {
      console.error(`Error splitting PDF: ${error}`);
      throw error;
    }
  }

  private async splitPdfIntoChunks(
    existingPdfBytes: Buffer,
    chunkSize: number = 10,
  ): Promise<Uint8Array[]> {
    try {
      console.log(`Starting PDF chunking with chunk size: ${chunkSize}`);

      // Convert Buffer to Uint8Array to ensure compatibility with pdf-lib
      const pdfBytes = new Uint8Array(existingPdfBytes);
      const pdfDoc = await PDFDocument.load(pdfBytes);

      const totalPages = pdfDoc.getPageCount();
      console.log(`Total pages in PDF: ${totalPages}`);

      const chunks: Uint8Array[] = [];
      const numChunks = Math.ceil(totalPages / chunkSize);

      for (let i = 0; i < numChunks; i++) {
        const startPage = i * chunkSize;
        const endPage = Math.min(startPage + chunkSize - 1, totalPages - 1);

        console.log(
          `Creating chunk ${i + 1}/${numChunks}: pages ${startPage}-${endPage}`,
        );

        const chunkBytes = await this.splitPdf(
          existingPdfBytes,
          startPage,
          endPage,
        );
        chunks.push(chunkBytes);
      }

      console.log(`Created ${chunks.length} PDF chunks`);
      return chunks;
    } catch (error) {
      console.error(`Error chunking PDF: ${error}`);
      throw error;
    }
  }

}
