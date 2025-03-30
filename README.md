# Notizen-App im Zuge des No-SQL Projekts der DHBW im 4. Semester im Studiengang Wirtschaftsinformatik 2023.

Docker-Container starten:

1. Docker-Desktop herunterladen (V. 4.38.0)
2. ZIP-Ordner des Projekts entpacken
3. Ordner in CMD ansteuern 
4. docker container starten in cmd mit: docker compose up -d
5. Die beiden URL's in Docker anklicken (http://localhost:5984/ , http://localhost:3000/)

Datenbank sehen:

1. Hinter das http://localhost:5984 --> /_utils/# eingeben
2. Mit logindaten anmelden: Name: admin, Passwort: 187LOL187
3. Auf Einstellungen links in CouchDB druecken und Cors auswaehlen
4. Dann Enable Cors-->All domains auswaehlen

Web-Anwendung

1. Zuerst Admin registrieren: Name: admin, Passwort: 187LOL187
2. Dann beliebig viele User anlegen
