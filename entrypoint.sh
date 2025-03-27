#!/bin/bash

# Warte bis CouchDB hochgefahren ist
echo "Warte auf CouchDB..."
until curl -s http://couchdb:5984/_up; do
  sleep 1
done

echo "CouchDB ist bereit!"

# Erstelle Datenbanken, falls noch nicht vorhanden
for db in notizen users invitations chats; do
  echo "Erstelle DB '$db' (falls nicht vorhanden)..."
  curl -X PUT "http://admin:187LOL187@couchdb:5984/$db"
done

# Starte den HTTP-Server auf Port 3000
serve -s app -l 3000 &

# Öffne die App im lokalen Browser (Hostseite, nicht im Container)
node open-browser.js
wait
