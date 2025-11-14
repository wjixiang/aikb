import { MinerUClient } from "./mineru-client";
import {} from '@aikb/s3-service'

const TEST_PDF_S3_KEY = "test/pdf/acei.pdf"

async function getTestPdfS3Url() {
    
}

describe('mineru-client-e2e', () => {
    let client: MinerUClient;
    const mockConfig = {
    token: 'test-token',
    downloadDir: '/workspace/test/test-downloads',
    defaultOptions: {
        is_ocr: false,
        enable_formula: true,
        enable_table: true,
        language: 'en' as const,
        model_version: 'pipeline' as const,
    },
    };


    beforeEach(()=>{
        client = new MinerUClient(mockConfig)
    })

    it("e2e: convert pdf to markdown", async()=>{

    })
});
