// Basis-URL zur CouchDB-Datenbank
const dbUrl = 'http://127.0.0.1:5984/notizen';

// Admin-Login für CouchDB (ANPASSEN!)
const username = 'admin';    // Ersetze mit deinem CouchDB-Benutzernamen
const password = '187LOL187'; // Ersetze mit deinem CouchDB-Passwort
const authHeader = 'Basic ' + btoa(username + ':' + password);

// Offline Notizen zwischenspeichern
const offlineNotes = JSON.parse(localStorage.getItem('offlineNotes')) || [];

/**
 * Synchronisiert offline gespeicherte Notizen mit CouchDB
 */
function syncOfflineNotes() {
  if (navigator.onLine && offlineNotes.length > 0) {
    offlineNotes.forEach(note => {
      fetch(dbUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify(note)
      }).then(response => response.json())
        .then(() => fetchNotes());
    });
    localStorage.removeItem('offlineNotes');
  }
}

/**
 * GET: Alle Notizen abrufen
 */
function fetchNotes() {
  fetch(`${dbUrl}/_all_docs?include_docs=true`, { headers: { 'Authorization': authHeader } })
    .then(response => response.json())
    .then(data => {
      const tableBody = document.getElementById('notesTableBody');
      tableBody.innerHTML = '';

      data.rows.forEach(row => {
        const note = row.doc;
        const tr = document.createElement('tr');

        // Notiz-Spalte
        const tdText = document.createElement('td');
        tdText.textContent = note.text;
        tr.appendChild(tdText);

        // Erinnerung-Spalte
        const tdReminder = document.createElement('td');
        tdReminder.textContent = note.reminder ? new Date(note.reminder).toLocaleString() : 'Keine';
        tr.appendChild(tdReminder);

        // Aktionen-Spalte (Buttons)
        const tdActions = document.createElement('td');
        const buttonContainer = document.createElement('div');
        buttonContainer.classList.add('button-container');

        // Bearbeiten-Button
        const editBtn = document.createElement('button');
        editBtn.textContent = 'Bearbeiten';
        editBtn.classList.add('btn', 'btn-success');
        editBtn.addEventListener('click', () => {
          const newText = prompt("Neuer Text:", note.text);
          if (newText) updateNote(note._id, note._rev, newText);
        });

        // Löschen-Button
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Löschen';
        deleteBtn.classList.add('btn', 'btn-danger');
        deleteBtn.addEventListener('click', () => {
          if (confirm("Wirklich löschen?")) deleteNote(note._id, note._rev);
        });

        buttonContainer.appendChild(editBtn);
        buttonContainer.appendChild(deleteBtn);
        tdActions.appendChild(buttonContainer);
        tr.appendChild(tdActions);

        tableBody.appendChild(tr);

        // Systembenachrichtigung setzen, falls Erinnerung existiert
        if (note.reminder) {
          const reminderTime = new Date(note.reminder).getTime();
          const now = new Date().getTime();
          if (reminderTime > now) {
            setTimeout(() => {
              new Notification("Notizen App - Erinnerung", { body: note.text });
            }, reminderTime - now);
          }
        }
      });
    });
}

/**
 * POST: Neue Notiz speichern
 */
function addNote(noteText, reminderTime) {
  const note = {
    text: noteText,
    reminder: reminderTime ? new Date(reminderTime).toISOString() : null,
    createdAt: new Date().toISOString()
  };

  if (!navigator.onLine) {
    offlineNotes.push(note);
    localStorage.setItem('offlineNotes', JSON.stringify(offlineNotes));
    alert('Notiz gespeichert! Sie wird synchronisiert, wenn das Gerät online ist.');
  } else {
    fetch(dbUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify(note)
    }).then(response => response.json())
      .then(() => fetchNotes());
  }
}

/**
 * PUT: Notiz aktualisieren
 */
function updateNote(id, rev, newText) {
  fetch(`${dbUrl}/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authHeader
    },
    body: JSON.stringify({ _id: id, _rev: rev, text: newText })
  }).then(() => fetchNotes());
}

/**
 * DELETE: Notiz löschen
 */
function deleteNote(id, rev) {
  fetch(`${dbUrl}/${id}?rev=${rev}`, {
    method: 'DELETE',
    headers: { 'Authorization': authHeader }
  }).then(() => fetchNotes());
}

// Formular: Notiz hinzufügen
document.getElementById('noteForm').addEventListener('submit', event => {
  event.preventDefault();
  addNote(document.getElementById('noteInput').value, document.getElementById('reminderTime').value);
  document.getElementById('noteInput').value = '';
});

// Benachrichtigungsberechtigung anfordern, falls noch nicht genehmigt
if (Notification.permission !== "granted") {
  Notification.requestPermission();
}

// Initiales Laden der Notizen und Synchronisation von Offline-Daten
fetchNotes();
syncOfflineNotes();







