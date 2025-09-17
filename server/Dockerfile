# Dockerfile for Remote Proxy Manager Server
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements_server.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements_server.txt

# Copy application code
COPY server.py .
COPY python_script.py .

# Create non-root user for security
RUN useradd --create-home --shell /bin/bash appuser && chown -R appuser:appuser /app
USER appuser

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5000/api/health || exit 1

# Set default environment variables
ENV HOST=0.0.0.0
ENV PORT=5000
ENV API_KEY=change-this-api-key-in-production

# Run the server
CMD ["python", "server.py"]
