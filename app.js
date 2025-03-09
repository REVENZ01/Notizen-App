// Überschreibe direkt beim DOM-Load alle relevanten Hintergründe (als Fallback)
document.addEventListener('DOMContentLoaded', () => {
  document.body.style.setProperty('background-color', '#1e1e2e', 'important');
  document.body.style.setProperty('color', '#f8f8f2', 'important');
  const elems = document.querySelectorAll('.container, .table, thead, tbody, tr, th, td');
  elems.forEach(el => {
    el.style.setProperty('background-color', '#1e1e2e', 'important');
    el.style.setProperty('color', '#f8f8f2', 'important');
  });
});

// CouchDB-Konfiguration
const dbUrl = 'http://127.0.0.1:5984/notizen';
const username = 'admin';
const password = '187LOL187';
const authHeader = 'Basic ' + btoa(username + ':' + password);
const offlineNotes = JSON.parse(localStorage.getItem('offlineNotes')) || [];

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
      })
      .then(() => fetchNotes())
      .catch(error => console.error('Error syncing note:', error));
    });
    offlineNotes.length = 0;
    localStorage.removeItem('offlineNotes');
  }
}

function fetchNotes() {
  fetch(`${dbUrl}/_all_docs?include_docs=true`, {
    headers: { 'Authorization': authHeader }
  })
  .then(response => response.json())
  .then(data => {
    const tableBody = document.getElementById('notesTableBody');
    tableBody.innerHTML = '';

    data.rows.forEach(row => {
      const note = row.doc;
      const tr = document.createElement('tr');

      // Checkbox-Spalte
      const tdCheckbox = document.createElement('td');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.classList.add('checkbox');
      tdCheckbox.appendChild(checkbox);
      tr.appendChild(tdCheckbox);

      // Notiz-Spalte
      const tdText = document.createElement('td');
      tdText.textContent = note.text;
      tr.appendChild(tdText);

      // Erinnerung-Spalte
      const tdReminder = document.createElement('td');
      tdReminder.textContent = note.reminder ? new Date(note.reminder).toLocaleString() : 'Keine';
      tr.appendChild(tdReminder);

      // Aktionen-Spalte
      const tdActions = document.createElement('td');
      tdActions.classList.add('has-text-right');
      const editBtn = document.createElement('button');
      editBtn.textContent = 'Bearbeiten';
      editBtn.classList.add('button', 'is-success', 'is-small');
      editBtn.addEventListener('click', () => {
        const newText = prompt("Neuer Text:", note.text);
        if (newText) updateNote(note._id, note._rev, newText);
      });

      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = 'Löschen';
      deleteBtn.classList.add('button', 'is-danger', 'is-small');
      deleteBtn.addEventListener('click', () => {
        if (confirm("Wirklich löschen?")) deleteNote(note._id, note._rev);
      });

      const actionDiv = document.createElement('div');
      actionDiv.classList.add('buttons');
      actionDiv.appendChild(editBtn);
      actionDiv.appendChild(deleteBtn);
      tdActions.appendChild(actionDiv);
      tr.appendChild(tdActions);

      // Checkbox-Event: Bei Aktivierung wird die Zeile hellgrau und die Buttons deaktiviert
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
          tr.classList.add('selected-row');
          editBtn.disabled = true;
          deleteBtn.disabled = true;
        } else {
          tr.classList.remove('selected-row');
          editBtn.disabled = false;
          deleteBtn.disabled = false;
        }
      });

      tableBody.appendChild(tr);
    });
  })
  .catch(error => console.error('Error fetching notes:', error));
}

function addNote(noteText, reminderTime) {
  const note = {
    text: noteText,
    reminder: reminderTime ? new Date(reminderTime).toISOString() : null,
    createdAt: new Date().toISOString()
  };

  if (!navigator.onLine) {
    offlineNotes.push(note);
    localStorage.setItem('offlineNotes', JSON.stringify(offlineNotes));
    alert('Offline gespeichert! Wird synchronisiert, wenn online.');
  } else {
    fetch(dbUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify(note)
    })
    .then(() => fetchNotes())
    .catch(error => console.error('Error adding note:', error));
  }
}

function updateNote(id, rev, newText) {
  fetch(`${dbUrl}/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authHeader
    },
    body: JSON.stringify({ _id: id, _rev: rev, text: newText })
  })
  .then(() => fetchNotes())
  .catch(error => console.error('Error updating note:', error));
}

function deleteNote(id, rev) {
  fetch(`${dbUrl}/${id}?rev=${rev}`, {
    method: 'DELETE',
    headers: { 'Authorization': authHeader }
  })
  .then(() => fetchNotes())
  .catch(error => console.error('Error deleting note:', error));
}

document.getElementById('noteForm').addEventListener('submit', event => {
  event.preventDefault();
  const noteText = document.getElementById('noteInput').value;
  const reminderTime = document.getElementById('reminderTime').value;
  if (noteText.trim() !== '') {
    addNote(noteText, reminderTime);
    document.getElementById('noteInput').value = '';
    document.getElementById('reminderTime').value = '';
  }
});

fetchNotes();
syncOfflineNotes();
window.addEventListener('online', syncOfflineNotes);












