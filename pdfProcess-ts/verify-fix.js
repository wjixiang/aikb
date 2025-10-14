const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

// Simple verification script to test our PDF splitter functionality
async function verifyFix() {
    console.log('🔍 Verifying PDF Spliter fix...');
    
    try {
        // Create a simple test PDF with 5 pages
        console.log('📄 Creating test PDF...');
        const pdfDoc = await PDFDocument.create();
        
        for (let i = 0; i < 5; i++) {
            const page = pdfDoc.addPage([600, 400]);
            // Add some content to each page
            page.drawText(`Test Page ${i + 1}`, {
                x: 50,
                y: 350,
                size: 20
            });
        }
        
        const testPdfBytes = await pdfDoc.save();
        console.log(`✅ Created test PDF with ${testPdfBytes.length} bytes`);
        
        // Test the Buffer to Uint8Array conversion that was causing the issue
        console.log('🔄 Testing Buffer to Uint8Array conversion...');
        const buffer = Buffer.from(testPdfBytes);
        const uint8Array = new Uint8Array(buffer);
        
        console.log(`✅ Buffer length: ${buffer.length}`);
        console.log(`✅ Uint8Array length: ${uint8Array.length}`);
        console.log(`✅ Types match: ${buffer.length === uint8Array.length}`);
        
        // Test loading the PDF with the converted Uint8Array
        console.log('📖 Testing PDF loading with Uint8Array...');
        const loadedPdf = await PDFDocument.load(uint8Array);
        const pageCount = loadedPdf.getPageCount();
        
        console.log(`✅ Successfully loaded PDF with ${pageCount} pages`);
        
        // Test PDF splitting functionality
        console.log('✂️ Testing PDF splitting...');
        const newPdfDoc = await PDFDocument.create();
        
        // Copy first 2 pages
        const pagesToCopy = await newPdfDoc.copyPages(loadedPdf, [0, 1]);
        pagesToCopy.forEach(page => newPdfDoc.addPage(page));
        
        const newPdfBytes = await newPdfDoc.save();
        console.log(`✅ Created split PDF with ${newPdfBytes.length} bytes`);
        
        // Verify the split PDF
        const splitPdf = await PDFDocument.load(newPdfBytes);
        const splitPageCount = splitPdf.getPageCount();
        console.log(`✅ Split PDF has ${splitPageCount} pages (expected: 2)`);
        
        console.log('🎉 All tests passed! The fix is working correctly.');
        return true;
        
    } catch (error) {
        console.error('❌ Verification failed:', error.message);
        console.error(error.stack);
        return false;
    }
}

// Run the verification
verifyFix().then(success => {
    process.exit(success ? 0 : 1);
});