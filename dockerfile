# Verwende ein leichtgewichtiges Nginx-Image
FROM nginx:alpine

# Kopiere alle Dateien aus dem aktuellen Verzeichnis in den Standard-Nginx-Ordner
COPY . /usr/share/nginx/html

# Optional: Falls du ein eigenes nginx.conf verwenden möchtest, kannst du diese Zeile aktivieren:
# COPY nginx.conf /etc/nginx/nginx.conf
