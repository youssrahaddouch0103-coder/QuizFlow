FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Modèle d'embeddings (multilingual-e5-small, ONNX) téléchargé une fois, au build de l'image :
# le service démarre ensuite sans dépendre du réseau. En cas d'échec (pas d'accès à Hugging Face),
# le build continue et le modèle sera téléchargé au premier import de PDF.
ENV EMBEDDING_CACHE_DIR=/models
COPY app/__init__.py app/embeddings.py ./app/
RUN python -m app.embeddings || echo "Modèle non téléchargé au build : il le sera au premier usage."

COPY app ./app
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
