/***************************************************
 * app.js – mit Basic Auth, Postfach (Einladungen/Nachrichten),
 * Anzeige des Notizen-Autors (mit Profilbild in der "Von"-Spalte),
 * Checkbox-Status, Badge-Benachrichtigung, "Passwort anzeigen",
 * Systembenachrichtigung bei Erinnerung, Hashing (CryptoJS SHA256)
 * für Passwörter, Profil bearbeiten und Teilnehmerverwaltung,
 * plus SMS‑ähnlicher Chat mit neuen Nachrichten-Badge.
 **************************************************/ 

// ADMIN-CREDENTIALS (anpassen)
const adminUser = "admin";
const adminPass = "187LOL187";
const adminAuthHeader = "Basic " + btoa(adminUser + ":" + adminPass);

// Datenbank-URLs
const dbUrl = "http://127.0.0.1:5984/notizen";
const userDbUrl = "http://127.0.0.1:5984/users";
const invitationDbUrl = "http://127.0.0.1:5984/invitations";
const chatDbUrl = "http://127.0.0.1:5984/chats"; // neue Chat-Datenbank

// Aktuell eingeloggter User
let currentUser = null;
let currentUserRole = null;
let currentChatPartner = null;

// Einfaches statisches Salt (nur Demo)
const SALT = "myFixedSalt12345";

// Standard-Profilbild URL
const DEFAULT_PROFILE_IMAGE = "https://static.vecteezy.com/ti/gratis-vektor/t2/2534006-social-media-chatting-online-leeres-profil-bild-kopf-und-korper-symbol-menschen-stehend-symbol-grauer-hintergrund-kostenlos-vektor.jpg";

/**
 * Hashing mit CryptoJS SHA256.
 */
function hashPassword(plainText) {
  return CryptoJS.SHA256(plainText + SALT).toString();
}

/* ---------------------------
   INITIALISIERUNG
--------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  // "Passwort anzeigen"
  const showPwdCheckbox = document.getElementById("showPasswordCheckbox");
  if (showPwdCheckbox) {
    showPwdCheckbox.addEventListener("change", (e) => {
      const pwdField = document.getElementById("loginPassword");
      pwdField.type = e.target.checked ? "text" : "password";
    });
  }

  // Teilnehmer-Bereich
  document.getElementById("participantsButton").addEventListener("click", toggleParticipantsSection);

  // Starte Intervall zur Aktualisierung der Chat-Badges (alle 10 Sekunden)
  setInterval(updateChatBadges, 10000);

  // Eventlistener für Kalender-Export-Button
  const exportBtn = document.getElementById("exportCalendarButton");
  if (exportBtn) {
    exportBtn.addEventListener("click", exportToCalendar);
  }
});

/* ---------------------------
   LOGIN & REGISTRIERUNG
--------------------------- */
document.getElementById("loginButton").addEventListener("click", login);
function login() {
  const username = document.getElementById("loginUsername").value;
  const password = document.getElementById("loginPassword").value;
  if (!username.trim() || !password.trim()) {
    alert("Bitte Benutzername und Passwort eingeben.");
    return;
  }
  fetch(`${userDbUrl}/${encodeURIComponent(username)}`, {
    method: "GET",
    headers: { "Content-Type": "application/json", "Authorization": adminAuthHeader }
  })
    .then(response => {
      if (!response.ok) throw new Error("Benutzer nicht gefunden.");
      return response.json();
    })
    .then(userDoc => {
      if (hashPassword(password) === userDoc.password) {
        currentUser = userDoc._id;
        currentUserRole = userDoc.role || "user";
        document.getElementById("loginSection").style.display = "none";
        document.getElementById("appSection").style.display = "block";
        updateProfileDisplay();
        if (Notification.permission !== "granted") Notification.requestPermission();
        fetchNotes();
        fetchInvitationBadgeCount();
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

document.getElementById("registerButton").addEventListener("click", register);
function register() {
  const username = document.getElementById("loginUsername").value;
  const password = document.getElementById("loginPassword").value;
  if (!username.trim() || !password.trim()) {
    alert("Bitte Benutzername und Passwort eingeben.");
    return;
  }
  const userDoc = {
    _id: username,
    password: hashPassword(password),
    role: username === "admin" ? "admin" : "user",
    profilePicture: DEFAULT_PROFILE_IMAGE,
    allowedViewers: []
  };
  fetch(`${userDbUrl}/${encodeURIComponent(username)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "Authorization": adminAuthHeader },
    body: JSON.stringify(userDoc)
  })
    .then(response => {
      if (response.ok) alert("Registrierung erfolgreich! Bitte einloggen.");
      else throw new Error("Registrierung fehlgeschlagen (User existiert evtl. schon).");
    })
    .catch(err => alert(err.message));
}

document.getElementById("logoutButton").addEventListener("click", logout);
function logout() {
  currentUser = null;
  currentUserRole = null;
  document.getElementById("appSection").style.display = "none";
  document.getElementById("loginSection").style.display = "block";
}

/* ---------------------------
   PROFIL BEARBEITEN
--------------------------- */
document.getElementById("profileButton").addEventListener("click", showProfileSection);
function showProfileSection() {
  document.getElementById("appSection").style.display = "none";
  document.getElementById("profileSection").style.display = "block";
  fetch(`${userDbUrl}/${encodeURIComponent(currentUser)}`, {
    method: "GET",
    headers: { "Authorization": adminAuthHeader }
  })
    .then(res => {
      if (!res.ok) throw new Error("Benutzer nicht gefunden");
      return res.json();
    })
    .then(userDoc => {
      document.getElementById("profileUsername").value = userDoc._id;
      document.getElementById("profileImage").value = userDoc.profilePicture || "";
      document.getElementById("profilePreview").src = userDoc.profilePicture || DEFAULT_PROFILE_IMAGE;
    })
    .catch(err => console.error(err));
}

document.getElementById("cancelProfileButton").addEventListener("click", () => {
  document.getElementById("profileSection").style.display = "none";
  document.getElementById("appSection").style.display = "block";
});

document.getElementById("saveProfileButton").addEventListener("click", saveProfile);
function saveProfile() {
  const newUsername = document.getElementById("profileUsername").value;
  const newImage = document.getElementById("profileImage").value || DEFAULT_PROFILE_IMAGE;
  fetch(`${userDbUrl}/${encodeURIComponent(currentUser)}`, {
    method: "GET",
    headers: { "Authorization": adminAuthHeader }
  })
    .then(res => {
      if (!res.ok) throw new Error("Benutzer nicht gefunden");
      return res.json();
    })
    .then(oldDoc => {
      if (newUsername === currentUser) {
        oldDoc.profilePicture = newImage;
        return fetch(`${userDbUrl}/${encodeURIComponent(currentUser)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", "Authorization": adminAuthHeader },
          body: JSON.stringify(oldDoc)
        }).then(() => {
          alert("Profil aktualisiert.");
          document.getElementById("profileSection").style.display = "none";
          document.getElementById("appSection").style.display = "block";
          updateProfileDisplay();
        });
      } else {
        const newDoc = {
          _id: newUsername,
          password: oldDoc.password,
          role: oldDoc.role,
          profilePicture: newImage,
          allowedViewers: oldDoc.allowedViewers || []
        };
        return fetch(`${userDbUrl}/${encodeURIComponent(newUsername)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", "Authorization": adminAuthHeader },
          body: JSON.stringify(newDoc)
        })
          .then(res => {
            if (!res.ok) throw new Error("Neuer Benutzername existiert evtl. bereits.");
            return updateNotesForOwner(currentUser);
          })
          .then(() => fetch(`${userDbUrl}/${encodeURIComponent(currentUser)}?rev=${oldDoc._rev}`, {
            method: "DELETE",
            headers: { "Authorization": adminAuthHeader }
          }))
          .then(() => {
            alert("Benutzername aktualisiert. Bitte neu einloggen.");
            logout();
          })
          .catch(err => console.error(err));
      }
    })
    .catch(err => console.error(err));
}

function updateProfileDisplay() {
  fetch(`${userDbUrl}/${encodeURIComponent(currentUser)}`, {
    method: "GET",
    headers: { "Authorization": adminAuthHeader }
  })
    .then(res => res.json())
    .then(userDoc => {
      document.getElementById("welcomeMessage").textContent = "Willkommen, " + userDoc._id;
      const profilePic = document.getElementById("profilePic");
      profilePic.src = userDoc.profilePicture || DEFAULT_PROFILE_IMAGE;
      profilePic.style.display = "block";
      // Nachricht-Button nur anzeigen, wenn Admin
      const msgBtn = document.getElementById("messageButton");
      if (userDoc.role === "admin") {
        msgBtn.style.display = "inline-block";
      } else {
        msgBtn.style.display = "none";
      }
    })
    .catch(err => console.error(err));
}

/* ---------------------------
   TEILNEHMER VERWALTEN
--------------------------- */
function toggleParticipantsSection() {
  const section = document.getElementById("participantsSection");
  if (!section.style.display || section.style.display === "none") {
    section.style.display = "block";
    fetchParticipants();
  } else {
    section.style.display = "none";
  }
}
function fetchParticipants() {
  fetch(`${userDbUrl}/${encodeURIComponent(currentUser)}`, {
    method: "GET",
    headers: { "Authorization": adminAuthHeader }
  })
    .then(res => res.json())
    .then(userDoc => {
      const container = document.getElementById("participantsContainer");
      container.innerHTML = "";
      const participants = userDoc.allowedViewers || [];
      if (!participants.length) {
        container.innerHTML = "<p>Keine Teilnehmer.</p>";
      } else {
        participants.forEach(participant => {
          const div = document.createElement("div");
          div.classList.add("box");
          div.style.display = "flex";
          div.style.justifyContent = "space-between";
          div.style.alignItems = "center";
          div.innerHTML = `<span>${participant}</span>`;
          
          // Entfernen-Button
          const removeBtn = document.createElement("button");
          removeBtn.textContent = "Entfernen";
          removeBtn.classList.add("button");
          removeBtn.style.marginLeft = "1rem";
          removeBtn.addEventListener("click", () => removeParticipant(participant));
          div.appendChild(removeBtn);
          
          // Chat-Button (nur wenn nicht eigener Name)
          if (participant !== currentUser) {
            const chatBtn = document.createElement("button");
            chatBtn.textContent = "Chat";
            chatBtn.classList.add("button");
            chatBtn.style.marginLeft = "0.5rem";
            chatBtn.setAttribute("data-partner", participant);
            chatBtn.addEventListener("click", () => openChat(participant));
            div.appendChild(chatBtn);
          }
          
          container.appendChild(div);
        });
        // Nach dem Rendern der Teilnehmer, aktualisiere die Chat-Badges
        updateChatBadges();
      }
    })
    .catch(err => console.error(err));
}
function removeParticipant(participant) {
  fetch(`${userDbUrl}/${encodeURIComponent(currentUser)}`, {
    method: "GET",
    headers: { "Authorization": adminAuthHeader }
  })
    .then(res => res.json())
    .then(userDoc => {
      userDoc.allowedViewers = (userDoc.allowedViewers || []).filter(u => u !== participant);
      return fetch(`${userDbUrl}/${encodeURIComponent(currentUser)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": adminAuthHeader },
        body: JSON.stringify(userDoc)
      });
    })
    .then(() => updateNotesForOwner(currentUser))
    .then(() => fetchParticipants())
    .catch(err => console.error(err));
}

/* ---------------------------
   NOTIZEN-FUNKTIONEN
--------------------------- */
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
        const isOwner = (note.owner === currentUser);
        const isShared = Array.isArray(note.sharedWith) && note.sharedWith.includes(currentUser);
        if (currentUserRole === "admin" || isOwner || isShared) {
          const tr = document.createElement("tr");
          // Checkbox
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

          // Notiztext (2. Spalte, handgeschriebene Font in CSS)
          const tdText = document.createElement("td");
          tdText.textContent = note.text;
          tr.appendChild(tdText);

          // "Von"-Spalte: Profilbild + Name
          const tdOwner = document.createElement("td");
          const ownerContainer = document.createElement("div");
          ownerContainer.style.display = "flex";
          ownerContainer.style.alignItems = "center";
          // Bild-Element
          const ownerImg = document.createElement("img");
          ownerImg.style.width = "30px";
          ownerImg.style.height = "30px";
          ownerImg.style.borderRadius = "50%";
          ownerImg.style.marginRight = "8px";
          ownerImg.src = DEFAULT_PROFILE_IMAGE;
          // Profilbild asynchron laden
          fetch(`${userDbUrl}/${encodeURIComponent(note.owner)}`, {
            method: "GET",
            headers: { "Authorization": adminAuthHeader }
          })
            .then(res => res.json())
            .then(userDoc => {
              if (userDoc.profilePicture && userDoc.profilePicture.trim() !== "") {
                ownerImg.src = userDoc.profilePicture;
              }
            })
            .catch(err => console.error(err));
          // Name-Element
          const ownerName = document.createElement("span");
          ownerName.textContent = note.owner;
          ownerContainer.appendChild(ownerImg);
          ownerContainer.appendChild(ownerName);
          tdOwner.appendChild(ownerContainer);
          tr.appendChild(tdOwner);

          // Erinnerung
          const tdReminder = document.createElement("td");
          tdReminder.textContent = note.reminder ? new Date(note.reminder).toLocaleString() : "Keine";
          tr.appendChild(tdReminder);

          // Aktionen (Bearbeiten/Löschen)
          const tdActions = document.createElement("td");
          tdActions.classList.add("has-text-right");
          // Container für Buttons nebeneinander
          const actionContainer = document.createElement("div");
          actionContainer.classList.add("action-buttons");

          const editBtn = document.createElement("button");
          editBtn.textContent = "Bearbeiten";
          editBtn.classList.add("button");

          const deleteBtn = document.createElement("button");
          deleteBtn.textContent = "Löschen";
          deleteBtn.classList.add("button");

          // Klick-Events
          editBtn.addEventListener("click", () => {
            const newText = prompt("Neuer Text:", note.text);
            if (newText) updateNote(note._id, note._rev, { text: newText });
          });
          deleteBtn.addEventListener("click", () => {
            if (confirm("Wirklich löschen?")) deleteNote(note._id, note._rev);
          });

          actionContainer.appendChild(editBtn);
          actionContainer.appendChild(deleteBtn);
          tdActions.appendChild(actionContainer);
          tr.appendChild(tdActions);

          // Checkbox-Event: completed-Status aktualisieren
          checkbox.addEventListener("change", () => {
            const newCompleted = checkbox.checked;
            tr.classList.toggle("selected-row", newCompleted);
            editBtn.disabled = newCompleted;
            deleteBtn.disabled = newCompleted;
            updateNote(note._id, note._rev, { completed: newCompleted });
          });
          tableBody.appendChild(tr);
        }
      });
    })
    .catch(error => console.error("Error fetching notes:", error));
}

function addNote(noteText, reminderTime) {
  fetch(`${userDbUrl}/${encodeURIComponent(currentUser)}`, {
    method: "GET",
    headers: { "Authorization": adminAuthHeader }
  })
    .then(res => res.json())
    .then(userDoc => {
      const note = {
        text: noteText,
        reminder: reminderTime ? new Date(reminderTime).toISOString() : null,
        createdAt: new Date().toISOString(),
        owner: currentUser,
        sharedWith: userDoc.allowedViewers || [],
        completed: false,
        notified: false
      };
      return fetch(dbUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": adminAuthHeader },
        body: JSON.stringify(note)
      });
    })
    .then(() => fetchNotes())
    .catch(error => console.error("Error adding note:", error));
}

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

function deleteNote(id, rev) {
  fetch(`${dbUrl}/${id}?rev=${rev}`, {
    method: "DELETE",
    headers: { "Authorization": adminAuthHeader }
  })
    .then(() => fetchNotes())
    .catch(error => console.error("Error deleting note:", error));
}

document.getElementById("noteForm").addEventListener("submit", event => {
  event.preventDefault();
  const noteText = document.getElementById("noteInput").value;
  const reminderTime = document.getElementById("reminderTime").value;
  if (noteText.trim()) {
    addNote(noteText, reminderTime);
    document.getElementById("noteInput").value = "";
    document.getElementById("reminderTime").value = "";
  }
});

/* ---------------------------
   EINLADUNGEN / NACHRICHTEN (POSTFACH)
--------------------------- */
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
      } else throw new Error("Einladung konnte nicht gesendet werden.");
    })
    .catch(err => {
      console.error(err);
      alert(err.message);
    });
}

// "Nachricht" senden – nur Admin
document.getElementById("messageButton").addEventListener("click", sendMessage);
function sendMessage() {
  if (currentUserRole !== "admin") {
    alert("Nur der Admin kann Nachrichten senden.");
    return;
  }
  const messageText = prompt("Bitte geben Sie die Nachricht ein, die an alle User gesendet werden soll:");
  if (!messageText || messageText.trim() === "") return;
  fetch(`${userDbUrl}/_all_docs?include_docs=true`, {
    method: "GET",
    headers: { "Authorization": adminAuthHeader }
  })
    .then(response => response.json())
    .then(data => {
      const userDocs = data.rows.map(row => row.doc);
      const messagePromises = userDocs.map(userDoc => {
        const messageObj = {
          from: currentUser,
          to: userDoc._id,
          text: messageText,
          createdAt: new Date().toISOString(),
          type: "message"
        };
        return fetch(invitationDbUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": adminAuthHeader },
          body: JSON.stringify(messageObj)
        });
      });
      return Promise.all(messagePromises);
    })
    .then(() => {
      alert("Nachricht wurde an alle User gesendet.");
      fetchInvitationBadgeCount();
      fetchInvitations();
    })
    .catch(err => {
      console.error(err);
      alert("Fehler beim Senden der Nachricht.");
    });
}

// Mailbox öffnen/schließen
document.getElementById("mailboxButton").addEventListener("click", () => {
  const mailboxSection = document.getElementById("invitationsBox");
  if (!mailboxSection.style.display || mailboxSection.style.display === "none") {
    mailboxSection.style.display = "block";
    fetchInvitations();
  } else {
    mailboxSection.style.display = "none";
    updateInvitationBadge(0);
  }
});

function fetchInvitations() {
  fetch(`${invitationDbUrl}/_all_docs?include_docs=true`, {
    method: "GET",
    headers: { "Authorization": adminAuthHeader }
  })
    .then(response => response.json())
    .then(data => {
      const container = document.getElementById("invitationsContainer");
      container.innerHTML = "";
      const mailboxItems = data.rows.map(row => row.doc).filter(item => item.to === currentUser);
      updateInvitationBadge(mailboxItems.length);
      if (!mailboxItems.length) {
        container.innerHTML = "<p>Keine Nachrichten.</p>";
      } else {
        mailboxItems.forEach(item => {
          const invDiv = document.createElement("div");
          invDiv.classList.add("box");
          if (item.type === "message") {
            invDiv.innerHTML = `<p>Nachricht von <strong>${item.from}</strong> erhalten am ${new Date(item.createdAt).toLocaleString()}<br>${item.text}</p>`;
            const deleteBtn = document.createElement("button");
            deleteBtn.textContent = "Löschen";
            deleteBtn.classList.add("button");
            deleteBtn.style.marginTop = "0.5rem";
            deleteBtn.addEventListener("click", () => deleteMailboxItem(item));
            invDiv.appendChild(deleteBtn);
          } else {
            invDiv.innerHTML = `<p>Einladung von <strong>${item.from}</strong> erhalten am ${new Date(item.createdAt).toLocaleString()}</p>`;
            const acceptBtn = document.createElement("button");
            acceptBtn.textContent = "Annehmen";
            acceptBtn.classList.add("button");
            acceptBtn.style.marginRight = "0.5rem";
            acceptBtn.style.marginTop = "0.5rem";
            acceptBtn.addEventListener("click", () => acceptInvitation(item));
            const declineBtn = document.createElement("button");
            declineBtn.textContent = "Ablehnen";
            declineBtn.classList.add("button");
            declineBtn.style.marginTop = "0.5rem";
            declineBtn.addEventListener("click", () => declineInvitation(item));
            invDiv.appendChild(acceptBtn);
            invDiv.appendChild(declineBtn);
          }
          container.appendChild(invDiv);
        });
      }
    })
    .catch(err => console.error("Error fetching invitations:", err));
}

function fetchInvitationBadgeCount() {
  fetch(`${invitationDbUrl}/_all_docs?include_docs=true`, {
    method: "GET",
    headers: { "Authorization": adminAuthHeader }
  })
    .then(response => response.json())
    .then(data => {
      const mailboxItems = data.rows.map(row => row.doc).filter(item => item.to === currentUser);
      updateInvitationBadge(mailboxItems.length);
    })
    .catch(err => console.error("Error fetching invitation count:", err));
}

function updateInvitationBadge(count) {
  const badge = document.getElementById("invitationBadge");
  if (!badge) return;
  badge.style.display = count > 0 ? "inline" : "none";
  badge.textContent = count > 0 ? count : "";
}

function deleteMailboxItem(item) {
  fetch(`${invitationDbUrl}/${item._id}?rev=${item._rev}`, {
    method: "DELETE",
    headers: { "Authorization": adminAuthHeader }
  })
    .then(() => {
      alert("Nachricht gelöscht.");
      fetchInvitations();
      fetchInvitationBadgeCount();
    })
    .catch(err => console.error("Error deleting mailbox item:", err));
}

function acceptInvitation(invitation) {
  fetch(`${userDbUrl}/${encodeURIComponent(invitation.from)}`, {
    method: "GET",
    headers: { "Authorization": adminAuthHeader }
  })
    .then(res => res.json())
    .then(ownerDoc => {
      ownerDoc.allowedViewers = ownerDoc.allowedViewers || [];
      if (!ownerDoc.allowedViewers.includes(invitation.to)) {
        ownerDoc.allowedViewers.push(invitation.to);
        return fetch(`${userDbUrl}/${encodeURIComponent(invitation.from)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", "Authorization": adminAuthHeader },
          body: JSON.stringify(ownerDoc)
        });
      }
    })
    .then(() => updateNotesForOwner(invitation.from))
    .then(() => fetch(`${invitationDbUrl}/${invitation._id}?rev=${invitation._rev}`, {
      method: "DELETE",
      headers: { "Authorization": adminAuthHeader }
    }))
    .then(() => {
      alert("Einladung angenommen.");
      fetchInvitations();
      fetchNotes();
    })
    .catch(err => console.error("Error accepting invitation:", err));
}

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

/**
 * Aktualisiert alle Notizen des Owners so, dass deren
 * sharedWith-Feld mit dem allowedViewers-Array übereinstimmt.
 */
function updateNotesForOwner(owner) {
  return fetch(`${userDbUrl}/${encodeURIComponent(owner)}`, {
    method: "GET",
    headers: { "Authorization": adminAuthHeader }
  })
    .then(res => res.json())
    .then(ownerDoc => {
      const allowed = ownerDoc.allowedViewers || [];
      return fetch(`${dbUrl}/_all_docs?include_docs=true`, {
        headers: { "Authorization": adminAuthHeader }
      })
        .then(r => r.json())
        .then(nData => {
          const updates = [];
          nData.rows.forEach(row => {
            const note = row.doc;
            if (note.owner === owner) {
              note.sharedWith = allowed;
              updates.push(
                fetch(`${dbUrl}/${note._id}`, {
                  method: "PUT",
                  headers: { "Content-Type": "application/json", "Authorization": adminAuthHeader },
                  body: JSON.stringify(note)
                })
              );
            }
          });
          return Promise.all(updates);
        });
    });
}

/* ---------------------------
   ERINNERUNGS-BENACHRICHTIGUNG
--------------------------- */
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
          if (new Date() >= reminderTime) {
            if (Notification.permission === "granted") {
              new Notification("Erinnerung", { body: note.text });
            }
            updateNote(note._id, note._rev, { notified: true });
          }
        }
      });
    })
    .catch(err => console.error("Error checking reminders:", err));
}

/* ---------------------------
   CHAT-FUNKTIONALITÄT (SMS-ähnlicher Chat)
--------------------------- */
// Öffnet das Chatfenster für einen bestimmten Teilnehmer
function openChat(partner) {
  currentChatPartner = partner;
  document.getElementById("chatPartnerName").textContent = "Chat mit " + partner;
  document.getElementById("chatModal").classList.add("is-active");
  fetchChatMessages();
  markChatMessagesAsRead(partner);
}

// Schließt das Chatfenster
document.getElementById("closeChatButton").addEventListener("click", () => {
  document.getElementById("chatModal").classList.remove("is-active");
  document.getElementById("chatMessages").innerHTML = "";
  document.getElementById("chatInput").value = "";
});

// Lädt Chatnachrichten zwischen currentUser und currentChatPartner
function fetchChatMessages() {
  fetch(`${chatDbUrl}/_all_docs?include_docs=true`, {
    method: "GET",
    headers: { "Authorization": adminAuthHeader }
  })
    .then(response => response.json())
    .then(data => {
      const messagesContainer = document.getElementById("chatMessages");
      messagesContainer.innerHTML = "";
      // Filtere Nachrichten, die zwischen currentUser und currentChatPartner ausgetauscht wurden
      const messages = data.rows
        .map(row => row.doc)
        .filter(msg =>
          (msg.from === currentUser && msg.to === currentChatPartner) ||
          (msg.from === currentChatPartner && msg.to === currentUser)
        )
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      messages.forEach(msg => {
        const msgDiv = document.createElement("div");
        msgDiv.classList.add("chat-message");
        // Eigene Nachrichten rechts, Partner-Nachrichten links
        if (msg.from === currentUser) {
          msgDiv.classList.add("self");
        } else {
          msgDiv.classList.add("partner");
        }
        msgDiv.textContent = msg.text;
        messagesContainer.appendChild(msgDiv);
      });
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    })
    .catch(err => console.error("Error fetching chat messages:", err));
}

// Sende eine Chatnachricht
document.getElementById("sendChatButton").addEventListener("click", sendChatMessage);
function sendChatMessage() {
  const chatInput = document.getElementById("chatInput");
  const text = chatInput.value.trim();
  if (!text) return;
  const message = {
    from: currentUser,
    to: currentChatPartner,
    text: text,
    timestamp: new Date().toISOString(),
    read: false
  };
  fetch(chatDbUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": adminAuthHeader },
    body: JSON.stringify(message)
  })
    .then(() => {
      chatInput.value = "";
      fetchChatMessages();
      updateChatBadges();
    })
    .catch(err => console.error("Error sending chat message:", err));
}

// Markiert alle Nachrichten des Chatpartners als gelesen
function markChatMessagesAsRead(partner) {
  fetch(`${chatDbUrl}/_all_docs?include_docs=true`, {
    method: "GET",
    headers: { "Authorization": adminAuthHeader }
  })
    .then(response => response.json())
    .then(data => {
      const updatePromises = [];
      data.rows
        .map(row => row.doc)
        .filter(msg => msg.from === partner && msg.to === currentUser && !msg.read)
        .forEach(msg => {
          msg.read = true;
          updatePromises.push(
            fetch(`${chatDbUrl}/${msg._id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json", "Authorization": adminAuthHeader },
              body: JSON.stringify(msg)
            })
          );
        });
      return Promise.all(updatePromises);
    })
    .then(() => updateChatBadges())
    .catch(err => console.error("Error marking messages as read:", err));
}

// Aktualisiert die Chat-Badges für alle Teilnehmer, die Nachrichten an currentUser gesendet haben und noch ungelesen sind
function updateChatBadges() {
  fetch(`${chatDbUrl}/_all_docs?include_docs=true`, {
    method: "GET",
    headers: { "Authorization": adminAuthHeader }
  })
    .then(response => response.json())
    .then(data => {
      const unreadCounts = {};
      data.rows
        .map(row => row.doc)
        .forEach(msg => {
          if (msg.to === currentUser && !msg.read) {
            unreadCounts[msg.from] = (unreadCounts[msg.from] || 0) + 1;
          }
        });
      // Aktualisiere alle Chat-Buttons in der Teilnehmerliste
      const participantButtons = document.querySelectorAll("[data-partner]");
      participantButtons.forEach(btn => {
        let badge = btn.querySelector(".chat-badge");
        if (!badge) {
          badge = document.createElement("span");
          badge.classList.add("chat-badge");
          btn.appendChild(badge);
        }
        const partner = btn.getAttribute("data-partner");
        const count = unreadCounts[partner] || 0;
        badge.textContent = count > 0 ? count : "";
        badge.style.display = count > 0 ? "inline-block" : "none";
      });
    })
    .catch(err => console.error("Error updating chat badges:", err));
}

/* ---------------------------
   KALENDER-EXPORT-FUNKTION
--------------------------- */
function exportToCalendar() {
  fetch(`${dbUrl}/_all_docs?include_docs=true`, {
    method: "GET",
    headers: { "Authorization": adminAuthHeader }
  })
    .then(response => response.json())
    .then(data => {
      const events = [];
      data.rows.forEach(row => {
        const note = row.doc;
        const isOwner = (note.owner === currentUser);
        const isShared = Array.isArray(note.sharedWith) && note.sharedWith.includes(currentUser);
        // Nur Notizen mit Erinnerung, auf die der User Zugriff hat und die nicht als "completed" markiert sind
        if ((currentUserRole === "admin" || isOwner || isShared) && note.reminder && !note.completed) {
          events.push(note);
        }
      });
      if (events.length === 0) {
        alert("Keine Termine mit Erinnerungen gefunden.");
        return;
      }
      let icsContent = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Notizen App//DE\r\nCALSCALE:GREGORIAN\r\n";
      const now = new Date();
      const dtstamp = formatDateToICS(now.toISOString());
      events.forEach(event => {
        const dtstart = formatDateToICS(event.reminder);
        // Beispielhaft 1 Stunde Dauer
        const dtend = formatDateToICS(new Date(new Date(event.reminder).getTime() + 3600000).toISOString());
        const uid = event._id + "@notizenapp";
        const summary = escapeICSText(event.text);
        icsContent += "BEGIN:VEVENT\r\n";
        icsContent += "UID:" + uid + "\r\n";
        icsContent += "DTSTAMP:" + dtstamp + "\r\n";
        icsContent += "DTSTART:" + dtstart + "\r\n";
        icsContent += "DTEND:" + dtend + "\r\n";
        icsContent += "SUMMARY:" + summary + "\r\n";
        icsContent += "END:VEVENT\r\n";
      });
      icsContent += "END:VCALENDAR";
      const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
      const link = document.createElement("a");
      link.href = window.URL.createObjectURL(blob);
      link.download = "notizen.ics";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    })
    .catch(err => {
      console.error("Error exporting calendar:", err);
      alert("Fehler beim Exportieren der Termine.");
    });
}

function formatDateToICS(dateStr) {
  const date = new Date(dateStr);
  const pad = (num) => String(num).padStart(2, "0");
  return date.getUTCFullYear() +
         pad(date.getUTCMonth() + 1) +
         pad(date.getUTCDate()) + "T" +
         pad(date.getUTCHours()) +
         pad(date.getUTCMinutes()) +
         pad(date.getUTCSeconds()) + "Z";
}

function escapeICSText(text) {
  // Escape von Zeichen (z. B. Komma, Semikolon, Backslash) für ICS-Format
  return text.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;");
}
