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
    name: 'chunking & embedding worker',
    script: "tsx knowledgeBase/lib/rabbitmq/chunking-embedding.worker",
    out_file: '/workspace/logs/chunking-embedding.worker.out.log',
    error_file: '/workspace/logs/chunking-embedding.worker.error.log'
  },
  {
    name: 'markdown-part-storage.worker',
    script: "tsx knowledgeBase/lib/rabbitmq/markdown-part-storage.worker",
    out_file: '/workspace/logs/markdown-part-storage.worker.out.log',
    error_file: '/workspace/logs/markdown-part-storage.worker.error.log'
  },
  {
    name: 'PDF Merger Worker',
    script: 'tsx ./knowledgeBase/lib/rabbitmq/pdf-merger.worker.ts',
    description: 'Merges PDF parts into complete markdown documents',
    out_file: '/workspace/logs/pdf-merger.worker.out.log',
    error_file: '/workspace/logs/pdf-merger.worker.error.log'
  }
]
}
