FROM python:3.13-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . ./backend/

EXPOSE 8000

ENV PYTHONUNBUFFERED=1

CMD ["python", "backend/main.py"]
