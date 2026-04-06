FROM python:3.11-slim

# System dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies first (layer cache)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy project
COPY . .

# Create directories
RUN mkdir -p models checkpoints logs data/processed data/raw/images

# Set environment variables
ENV PYTHONPATH=/app
ENV CONFIG_PATH=/app/configs/config.yaml
ENV INDEX_PATH=/app/models/faiss_index

EXPOSE 8000

# Default: run API server
# Override CMD to run training or indexing scripts
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
