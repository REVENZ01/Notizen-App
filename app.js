/***************************************************
 * app.js – mit Basic Auth, Einladungspostfach, 
 * Anzeige des Notizen-Autors, Checkbox-Status,
 * Badge-Benachrichtigung, "Passwort anzeigen" und
 * Systembenachrichtigung bei Erinnerung
 **************************************************/

// ADMIN-CREDENTIALS für CouchDB (bitte anpassen)
const adminUser = "admin";
const adminPass = "187LOL187";
const adminAuthHeader = "Basic " + btoa(adminUser + ":" + adminPass);

// URLs zu den Datenbanken
const dbUrl = "http://127.0.0.1:5984/notizen";             // Notizen-DB
const userDbUrl = "http://127.0.0.1:5984/users";             // User-DB
const invitationDbUrl = "http://127.0.0.1:5984/invitations"; // Einladungen-DB

// Aktuell eingeloggter User
let currentUser = null;
let currentUserRole = null;

// Beim DOM-Load ein dunkles Farbschema erzwingen (Fallback) und "Passwort anzeigen"-Checkbox verarbeiten
document.addEventListener("DOMContentLoaded", () => {
  document.body.style.setProperty("background-color", "#1e1e2e", "important");
  document.body.style.setProperty("color", "#f8f8f2", "important");
  const elems = document.querySelectorAll(".container, .table, thead, tbody, tr, th, td");
  elems.forEach(el => {
    el.style.setProperty("background-color", "#1e1e2e", "important");
    el.style.setProperty("color", "#f8f8f2", "important");
  });

  const showPwdCheckbox = document.getElementById("showPasswordCheckbox");
  if (showPwdCheckbox) {
    showPwdCheckbox.addEventListener("change", (e) => {
      const pwdField = document.getElementById("loginPassword");
      pwdField.type = e.target.checked ? "text" : "password";
    });
  }
});

/* ---------------------------
   LOGIN / REGISTRIERUNG
---------------------------- */

// Login-Funktion
document.getElementById("loginButton").addEventListener("click", login);
function login() {
  const username = document.getElementById("loginUsername").value;
  const password = document.getElementById("loginPassword").value;
  if (username.trim() === "" || password.trim() === "") {
    alert("Bitte Benutzername und Passwort eingeben.");
    return;
  }

  // Nutzer-Dokument aus der "users"-DB abrufen (mit Admin-Credentials)
  fetch(`${userDbUrl}/${encodeURIComponent(username)}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Authorization": adminAuthHeader
    }
  })
    .then(response => {
      if (!response.ok) {
        throw new Error("Benutzer nicht gefunden.");
      }
      return response.json();
    })
    .then(userDoc => {
      if (userDoc.password === password) {
        // Passwort stimmt -> einloggen
        currentUser = userDoc._id;
        currentUserRole = userDoc.role || "user";

        // Login-Bereich ausblenden, App-Bereich einblenden
        document.getElementById("loginSection").style.display = "none";
        document.getElementById("appSection").style.display = "block";
        document.getElementById("welcomeMessage").textContent = "Willkommen, " + currentUser;

        // Bei erfolgreichem Login um Erlaubnis für Notifications bitten
        if (Notification.permission !== "granted") {
          Notification.requestPermission();
        }

        // Notizen und Einladungen laden sowie Erinnerungen prüfen
        fetchNotes();
        fetchInvitationBadgeCount();

        // Starte regelmäßige Überprüfung der Erinnerungen (alle 30 Sekunden)
        setInterval(checkReminders, 30000);
      } else {
        alert("Falsches Passwort!");
      }
    })
    .catch(err => {
      alert("Login fehlgeschlagen: " + err.message);
      console.error(err);
    });
}

// Registrierungs-Funktion
document.getElementById("registerButton").addEventListener("click", register);
function register() {
  const username = document.getElementById("loginUsername").value;
  const password = document.getElementById("loginPassword").value;
  if (username.trim() === "" || password.trim() === "") {
    alert("Bitte Benutzername und Passwort eingeben.");
    return;
  }

  const userDoc = {
    _id: username,
    password: password,
    role: username === "admin" ? "admin" : "user"
  };

  fetch(`${userDbUrl}/${encodeURIComponent(username)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "Authorization": adminAuthHeader
    },
    body: JSON.stringify(userDoc)
  })
    .then(response => {
      if (response.ok) {
        alert("Registrierung erfolgreich! Bitte einloggen.");
      } else {
        throw new Error("Registrierung fehlgeschlagen (vielleicht existiert der User schon?).");
      }
    })
    .catch(err => alert(err.message));
}

// Logout-Funktion
document.getElementById("logoutButton").addEventListener("click", () => {
  currentUser = null;
  currentUserRole = null;
  document.getElementById("appSection").style.display = "none";
  document.getElementById("loginSection").style.display = "block";
});

/* ---------------------------
   NOTIZEN-FUNKTIONEN
---------------------------- */

// Alle Notizen abrufen und entsprechend filtern
function fetchNotes() {
  fetch(`${dbUrl}/_all_docs?include_docs=true`, {
    method: "GET",
    headers: { "Authorization": adminAuthHeader }
  })
    .then(response => response.json())
    .then(data => {
      const tableBody = document.getElementById("notesTableBody");
      tableBody.innerHTML = "";
      data.rows.forEach(row => {
        const note = row.doc;
        // Bedingungen: Admin sieht alles; ansonsten: Owner oder explizit geteilt
        const isOwner = (note.owner === currentUser);
        const isShared = Array.isArray(note.sharedWith) && note.sharedWith.includes(currentUser);
        if (currentUserRole === "admin" || isOwner || isShared) {
          const tr = document.createElement("tr");

          // Checkbox-Spalte
          const tdCheckbox = document.createElement("td");
          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.classList.add("checkbox");
          if (note.completed) {
            checkbox.checked = true;
            tr.classList.add("selected-row");
          }
          tdCheckbox.appendChild(checkbox);
          tr.appendChild(tdCheckbox);

          // Notiz-Spalte
          const tdText = document.createElement("td");
          tdText.textContent = note.text;
          tr.appendChild(tdText);

          // Owner-Spalte
          const tdOwner = document.createElement("td");
          tdOwner.textContent = note.owner;
          tr.appendChild(tdOwner);

          // Erinnerung-Spalte
          const tdReminder = document.createElement("td");
          tdReminder.textContent = note.reminder ? new Date(note.reminder).toLocaleString() : "Keine";
          tr.appendChild(tdReminder);

          // Aktionen-Spalte
          const tdActions = document.createElement("td");
          tdActions.classList.add("has-text-right");
          const editBtn = document.createElement("button");
          editBtn.textContent = "Bearbeiten";
          editBtn.classList.add("button", "is-success", "is-small");
          editBtn.addEventListener("click", () => {
            const newText = prompt("Neuer Text:", note.text);
            if (newText) {
              updateNote(note._id, note._rev, { text: newText });
            }
          });
          const deleteBtn = document.createElement("button");
          deleteBtn.textContent = "Löschen";
          deleteBtn.classList.add("button", "is-danger", "is-small");
          deleteBtn.addEventListener("click", () => {
            if (confirm("Wirklich löschen?")) {
              deleteNote(note._id, note._rev);
            }
          });
          const actionDiv = document.createElement("div");
          actionDiv.classList.add("buttons");
          actionDiv.appendChild(editBtn);
          actionDiv.appendChild(deleteBtn);
          tdActions.appendChild(actionDiv);
          tr.appendChild(tdActions);

          // Checkbox-Event: Änderung speichern und DB aktualisieren
          checkbox.addEventListener("change", () => {
            const newCompleted = checkbox.checked;
            if (newCompleted) {
              tr.classList.add("selected-row");
              editBtn.disabled = true;
              deleteBtn.disabled = true;
            } else {
              tr.classList.remove("selected-row");
              editBtn.disabled = false;
              deleteBtn.disabled = false;
            }
            updateNote(note._id, note._rev, { completed: newCompleted });
          });

          tableBody.appendChild(tr);
        }
      });
    })
    .catch(error => console.error("Error fetching notes:", error));
}

// Notiz hinzufügen (Owner = currentUser, completed und notified standardmäßig false)
function addNote(noteText, reminderTime) {
  const note = {
    text: noteText,
    reminder: reminderTime ? new Date(reminderTime).toISOString() : null,
    createdAt: new Date().toISOString(),
    owner: currentUser,
    sharedWith: [],
    completed: false,
    notified: false
  };
  fetch(dbUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": adminAuthHeader },
    body: JSON.stringify(note)
  })
    .then(() => fetchNotes())
    .catch(error => console.error("Error adding note:", error));
}

// Notiz aktualisieren
function updateNote(id, rev, updates) {
  fetch(`${dbUrl}/${id}`, {
    method: "GET",
    headers: { "Authorization": adminAuthHeader }
  })
    .then(response => response.json())
    .then(note => {
      const updatedNote = { ...note, ...updates };
      return fetch(`${dbUrl}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": adminAuthHeader },
        body: JSON.stringify(updatedNote)
      });
    })
    .then(() => fetchNotes())
    .catch(error => console.error("Error updating note:", error));
}

// Notiz löschen
function deleteNote(id, rev) {
  fetch(`${dbUrl}/${id}?rev=${rev}`, {
    method: "DELETE",
    headers: { "Authorization": adminAuthHeader }
  })
    .then(() => fetchNotes())
    .catch(error => console.error("Error deleting note:", error));
}

// Formular zum Hinzufügen von Notizen
document.getElementById("noteForm").addEventListener("submit", event => {
  event.preventDefault();
  const noteText = document.getElementById("noteInput").value;
  const reminderTime = document.getElementById("reminderTime").value;
  if (noteText.trim() !== "") {
    addNote(noteText, reminderTime);
    document.getElementById("noteInput").value = "";
    document.getElementById("reminderTime").value = "";
  }
});

/* ---------------------------
   EINLADUNGEN / POSTFACH
---------------------------- */

// Einladung senden: Es wird ein Einladungseintrag in der "invitations"-DB angelegt.
document.getElementById("inviteButton").addEventListener("click", inviteUser);
function inviteUser() {
  const inviteUsername = prompt("Geben Sie den Benutzernamen ein, den Sie einladen möchten:");
  if (!inviteUsername) return;
  const invitation = {
    from: currentUser,
    to: inviteUsername,
    createdAt: new Date().toISOString()
  };
  fetch(invitationDbUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": adminAuthHeader },
    body: JSON.stringify(invitation)
  })
    .then(response => {
      if (response.ok) {
        alert("Einladung an " + inviteUsername + " gesendet.");
        fetchInvitationBadgeCount();
      } else {
        throw new Error("Einladung konnte nicht gesendet werden.");
      }
    })
    .catch(err => {
      console.error(err);
      alert(err.message);
    });
}

// Postfach-Button: Beim Klick das Postfach ein-/ausblenden und Einladungen abrufen
document.getElementById("mailboxButton").addEventListener("click", () => {
  const mailboxSection = document.getElementById("invitationsBox");
  if (mailboxSection.style.display === "none") {
    mailboxSection.style.display = "block";
    fetchInvitations();
  } else {
    mailboxSection.style.display = "none";
  }
});

// Einladungen abrufen (Details) und Badge aktualisieren
function fetchInvitations() {
  fetch(`${invitationDbUrl}/_all_docs?include_docs=true`, {
    method: "GET",
    headers: { "Authorization": adminAuthHeader }
  })
    .then(response => response.json())
    .then(data => {
      const container = document.getElementById("invitationsContainer");
      container.innerHTML = "";
      const invitations = data.rows
        .map(row => row.doc)
        .filter(inv => inv.to === currentUser);
      updateInvitationBadge(invitations.length);
      if (invitations.length === 0) {
        container.innerHTML = "<p>Keine Einladungen.</p>";
      } else {
        invitations.forEach(inv => {
          const invDiv = document.createElement("div");
          invDiv.classList.add("box");
          invDiv.innerHTML = `<p>Einladung von <strong>${inv.from}</strong> erhalten am ${new Date(inv.createdAt).toLocaleString()}</p>`;
          const acceptBtn = document.createElement("button");
          acceptBtn.textContent = "Annehmen";
          acceptBtn.classList.add("button", "is-success", "is-small");
          acceptBtn.style.marginRight = "0.5em";
          acceptBtn.addEventListener("click", () => acceptInvitation(inv));
          const declineBtn = document.createElement("button");
          declineBtn.textContent = "Ablehnen";
          declineBtn.classList.add("button", "is-danger", "is-small");
          declineBtn.addEventListener("click", () => declineInvitation(inv));
          invDiv.appendChild(acceptBtn);
          invDiv.appendChild(declineBtn);
          container.appendChild(invDiv);
        });
      }
    })
    .catch(err => console.error("Error fetching invitations:", err));
}

// Nur die Anzahl der Einladungen holen (für Badge)
function fetchInvitationBadgeCount() {
  fetch(`${invitationDbUrl}/_all_docs?include_docs=true`, {
    method: "GET",
    headers: { "Authorization": adminAuthHeader }
  })
    .then(response => response.json())
    .then(data => {
      const invitations = data.rows
        .map(row => row.doc)
        .filter(inv => inv.to === currentUser);
      updateInvitationBadge(invitations.length);
    })
    .catch(err => console.error("Error fetching invitation count:", err));
}

// Badge auf dem Postfach-Button aktualisieren
function updateInvitationBadge(count) {
  const badge = document.getElementById("invitationBadge");
  if (!badge) return;
  if (count > 0) {
    badge.style.display = "inline";
    badge.textContent = count;
  } else {
    badge.style.display = "none";
  }
}

// Einladung annehmen
function acceptInvitation(invitation) {
  fetch(`${dbUrl}/_all_docs?include_docs=true`, {
    method: "GET",
    headers: { "Authorization": adminAuthHeader }
  })
    .then(response => response.json())
    .then(data => {
      const updates = [];
      data.rows.forEach(row => {
        const note = row.doc;
        if (note.owner === invitation.from) {
          if (!note.sharedWith) note.sharedWith = [];
          if (!note.sharedWith.includes(currentUser)) {
            note.sharedWith.push(currentUser);
            updates.push(
              fetch(`${dbUrl}/${note._id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json", "Authorization": adminAuthHeader },
                body: JSON.stringify(note)
              })
            );
          }
        }
      });
      return Promise.all(updates);
    })
    .then(() => {
      return fetch(`${invitationDbUrl}/${invitation._id}?rev=${invitation._rev}`, {
        method: "DELETE",
        headers: { "Authorization": adminAuthHeader }
      });
    })
    .then(() => {
      alert("Einladung angenommen.");
      fetchInvitations();
      fetchNotes();
    })
    .catch(err => console.error("Error accepting invitation:", err));
}

// Einladung ablehnen
function declineInvitation(invitation) {
  fetch(`${invitationDbUrl}/${invitation._id}?rev=${invitation._rev}`, {
    method: "DELETE",
    headers: { "Authorization": adminAuthHeader }
  })
    .then(() => {
      alert("Einladung abgelehnt.");
      fetchInvitations();
    })
    .catch(err => console.error("Error declining invitation:", err));
}

/* ---------------------------
   ERINNERUNGS-BENACHRICHTIGUNG
---------------------------- */

// Überprüft regelmäßig, ob eine Erinnerung fällig ist
function checkReminders() {
  fetch(`${dbUrl}/_all_docs?include_docs=true`, {
    method: "GET",
    headers: { "Authorization": adminAuthHeader }
  })
    .then(response => response.json())
    .then(data => {
      data.rows.forEach(row => {
        const note = row.doc;
        if (note.reminder && !note.notified) {
          const reminderTime = new Date(note.reminder);
          const now = new Date();
          if (now >= reminderTime) {
            // Falls Notification-Erlaubnis vorliegt, wird die Benachrichtigung angezeigt
            if (Notification.permission === "granted") {
              new Notification("Erinnerung", {
                body: note.text
              });
            }
            // Aktualisiere den Notiz-Datensatz, damit diese Erinnerung nicht erneut ausgelöst wird
            updateNote(note._id, note._rev, { notified: true });
          }
        }
      });
    })
    .catch(err => console.error("Error checking reminders:", err));
}




















