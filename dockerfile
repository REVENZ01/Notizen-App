FROM node:18

# Installiere zusätzlich einen HTTP-Server (serve)
RUN npm install -g serve

# Erstelle App-Verzeichnis
WORKDIR /usr/src/app

# Kopiere App-Dateien
COPY app ./app
COPY open-browser.js ./open-browser.js
COPY entrypoint.sh ./entrypoint.sh

# Gib Rechte auf Entrypoint
RUN chmod +x ./entrypoint.sh

# Installiere optional xdg-open (für Browserstart in vielen Distros)
RUN apt-get update && apt-get install -y xdg-utils curl

# Starte Entrypoint beim Containerstart
CMD ["./entrypoint.sh"]
