require('dotenv').config();

module.exports = {
  apps : [{
    name   : "pdf-analysis.worker",
    script : "tsx ./knowledgeBase/lib/rabbitmq/pdf-analysis.worker.ts",
    out_file: "/workspace/logs/pdf-analysis.worker.out.log",
    error_file: "/workspace/logs/pdf-analysis.worker.error.log"
  },
 {
    name: 'PDF Processing Coordinator Worker',
    script: 'tsx knowledgeBase/lib/rabbitmq/pdf-processing-coordinator.worker.ts',
    description: 'Coordinates the PDF processing workflow',
    out_file: '/workspace/logs/pdf-processing-coordinator.worker.out.log',
    error_file: '/workspace/logs/pdf-processing-coordinator.worker.error.log'
  },
  {
    name: 'PDF Conversion Worker',
    description: 'Converts PDF files to Markdown format',
    script: 'tsx knowledgeBase/lib/rabbitmq/pdf-conversion.worker.ts',
    out_file: '/workspace/logs/pdf-conversion.worker.out.log',
    error_file: '/workspace/logs/pdf-conversion.worker.error.log'
  },
  {
    name: 'Markdown Storage Worker',
    script: 'tsx knowledgeBase/lib/rabbitmq/markdown-storage.worker.ts',
    description: 'Stores Markdown content and processes chunks',
    out_file: '/workspace/logs/markdown-storage.worker.out.log',
    error_file: '/workspace/logs/markdown-storage.worker.error.log'
  },
  {
    name: 'PDF spliting worker',
    script: 'uv run ./pdfProcess/start_pdf_splitting_worker.py',
    out_file: '/workspace/logs/pdf_splitting_worker.out.log',
    error_file: '/workspace/logs/pdf_splitting_worker.error.log',
    log_file: '/workspace/logs/pdf_splitting_worker.log'
  }]
}
