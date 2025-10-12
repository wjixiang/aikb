FROM python:3.12-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Install uv for faster package management
RUN pip install uv

# Copy dependency files
COPY pyproject.toml uv.lock ./

# Install dependencies
RUN uv sync --frozen

# Copy application code
COPY pdfProcess/ ./pdfProcess/

# Create necessary directories
RUN mkdir -p /tmp/pdf-processing /app/logs

# Set environment variables
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

# Expose health check port (optional)
EXPOSE 8080

# Add a simple health check endpoint
RUN echo 'from flask import Flask\napp = Flask(__name__)\n@app.route("/health")\ndef health():\n    return {"status": "healthy"}\nif __name__ == "__main__":\n    app.run(host="0.0.0.0", port=8080)' > /app/health_check.py

# Install Flask for health check
RUN uv add flask

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Run the worker
CMD ["uv", "run", "python", "pdfProcess/start_pdf_splitting_worker.py"]