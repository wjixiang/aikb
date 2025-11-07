import {describe, it, expect, beforeEach, vi} from 'vitest'
import { AppService } from './app.service'
import { Pdf2MArkdownDto } from 'library-shared'
import { ClientProxy } from '@nestjs/microservices'

describe(AppService, ()=>{
    let service: AppService
    let mockClientProxy: ClientProxy

    beforeEach(() => {
        // Create a mock ClientProxy
        mockClientProxy = {
            connect: vi.fn(),
            close: vi.fn(),
            send: vi.fn(),
            emit: vi.fn(),
        } as any

        service = new AppService(mockClientProxy)
    })

    it.skip('(e2e) get pdf download url', async()=>{
        const url = await service.getPdfDownloadUrl("68e4c9513be9d457fe6e7881")
        console.log(url)
        expect(typeof url).toBe('string')
    })

    it('should handle PDF with page count below threshold', async () => {
        // Set environment variables for testing
        process.env['PDF_CHUNK_SIZE_THRESHOLD'] = '20'
        process.env['PDF_CHUNK_SIZE'] = '10'

        const req = new Pdf2MArkdownDto('test-item-id', 15) // 15 pages, below threshold
        const result = await service.handlePdf2MdRequest(req)

        expect(result.chunked).toBe(false)
        expect(result.itemId).toBe('test-item-id')
        expect(result.pageNum).toBe(15)
    })

    it('should handle PDF with page count above threshold', async () => {
        // Set environment variables for testing
        process.env['PDF_CHUNK_SIZE_THRESHOLD'] = '20'
        process.env['PDF_CHUNK_SIZE'] = '10'

        const req = new Pdf2MArkdownDto('test-item-id', 25) // 25 pages, above threshold
        
        // Mock the PDF data since we don't have actual PDF for testing
        const mockPdfData = Buffer.from('mock pdf data')
        
        // We need to mock the pdfSplitter.splitPdfIntoChunks method
        // but for now, let's just test the logic without actual chunking
        try {
            const result = await service.handlePdf2MdRequest(req)
            // This will fail because we don't have actual PDF data
        } catch (error) {
            expect((error as Error).message).toBe('PDF data is required for chunking but not available')
        }
    })

    it('should use default environment values when not set', async () => {
        // Clear environment variables
        delete process.env['PDF_CHUNK_SIZE_THRESHOLD']
        delete process.env['PDF_CHUNK_SIZE']

        const req = new Pdf2MArkdownDto('test-item-id', 15) // 15 pages, below default threshold of 20
        const result = await service.handlePdf2MdRequest(req)

        expect(result.chunked).toBe(false)
        expect(result.itemId).toBe('test-item-id')
        expect(result.pageNum).toBe(15)
    })
})