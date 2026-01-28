// Choose File Button
document.getElementById("chooseFileBtn").addEventListener("click", () => {
  document.getElementById("fileInput").click();
});

// Load PassPro File
document.getElementById("loadBtn").addEventListener("click", () => {
  const file = document.getElementById("fileInput").files[0];
  if (!file) {
    document.getElementById("status").textContent = "No file selected.";
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    chrome.storage.local.set({ passproData: reader.result }, () => {
      document.getElementById("status").textContent = "PassPro data loaded.";
      checkMasterLock(true);
    });
  };

  reader.readAsText(file);
});

function getDomain(url) {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return null;
  }
}

function loadAccountsForSite() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]?.url) return;
    const domain = getDomain(tabs[0].url);

    chrome.storage.local.get("passproData", (result) => {
      if (!result.passproData) {
        document.getElementById("status").textContent = "No data loaded.";
        return;
      }

      let data;
      try {
        data = JSON.parse(result.passproData);
      } catch {
        document.getElementById("status").textContent = "Invalid PassPro file.";
        return;
      }

      const entries = data.passwords || [];
      const matches = entries.filter(entry => {
        const entryDomain = getDomain(entry.url);
        return entryDomain && domain && entryDomain.includes(domain);
      });

      const list = document.getElementById("accountList");
      list.innerHTML = "";

      if (matches.length === 0) {
        list.innerHTML = "<p style='font-size:12px; color:#888;'>No accounts found for this site.</p>";
        return;
      }

      matches.forEach(entry => {
        const btn = document.createElement("button");
        btn.textContent = entry.title || entry.username;

        btn.addEventListener("click", () => {
          chrome.tabs.sendMessage(
            tabs[0].id,
            {
              action: "fillCredentials",
              data: {
                username: entry.username,
                password: entry.password
              }
            },
            (response) => {
              document.getElementById("status").textContent =
                response?.status === "filled" ? "Filled!" : "Failed to fill.";
            }
          );
        });

        list.appendChild(btn);
      });
    });
  });
}

document.getElementById("viewAllBtn").addEventListener("click", () => {
  const panel = document.getElementById("allPasswordsPanel");
  panel.classList.toggle("hidden");
  if (!panel.classList.contains("hidden")) {
    loadAllPasswords();
  }
});

function loadAllPasswords() {
  chrome.storage.local.get("passproData", (result) => {
    if (!result.passproData) return;

    let data;
    try {
      data = JSON.parse(result.passproData);
    } catch {
      return;
    }

    const entries = data.passwords || [];
    const list = document.getElementById("allPasswordsList");
    list.innerHTML = "";

    entries.forEach(entry => {
      const item = document.createElement("div");
      item.className = "account-item";

      const label = document.createElement("div");
      label.textContent = `${entry.title || 'Untitled'} | ${entry.username}`;
      label.className = "account-label";

      const pwd = document.createElement("div");
      pwd.textContent = entry.password;
      pwd.className = "password-hidden";

      const btnGroup = document.createElement("div");

      const viewPassBtn = document.createElement("button");
      viewPassBtn.textContent = "View Pass";
      viewPassBtn.className = "view-btn";

      viewPassBtn.addEventListener("click", () => {
        const isHidden = pwd.classList.contains("password-hidden");
        pwd.className = isHidden ? "password-visible" : "password-hidden";
        viewPassBtn.textContent = isHidden ? "Hide Pass" : "View Pass";
      });

      item.appendChild(label);
      item.appendChild(pwd);
      btnGroup.appendChild(viewPassBtn);

      // Handle Notes
      if (entry.notes && entry.notes.trim() !== "") {
        const notesDiv = document.createElement("div");
        notesDiv.textContent = entry.notes;
        notesDiv.className = "notes-container";

        const viewNotesBtn = document.createElement("button");
        viewNotesBtn.textContent = "View Notes";
        viewNotesBtn.className = "view-notes-btn";

        viewNotesBtn.addEventListener("click", () => {
          const isVisible = notesDiv.classList.contains("visible");
          if (isVisible) {
            notesDiv.classList.remove("visible");
            viewNotesBtn.textContent = "View Notes";
          } else {
            notesDiv.classList.add("visible");
            viewNotesBtn.textContent = "Hide Notes";
          }
        });

        btnGroup.appendChild(viewNotesBtn);
        item.appendChild(btnGroup);
        item.appendChild(notesDiv);
      } else {
        item.appendChild(btnGroup);
      }

      list.appendChild(item);
    });
  });
}

document.getElementById("searchInput").addEventListener("input", (e) => {
  const term = e.target.value.toLowerCase();
  const items = document.querySelectorAll("#allPasswordsList .account-item");

  items.forEach(item => {
    const text = item.querySelector('.account-label').textContent.toLowerCase();
    item.style.display = text.includes(term) ? "block" : "none";
  });
});

function checkMasterLock(reloaded = false) {
  chrome.storage.local.get("passproData", (result) => {
    const lockScreen = document.getElementById("lockScreen");
    const mainContent = document.getElementById("mainContent");

    if (!result.passproData) {
      lockScreen.classList.add("hidden");
      mainContent.classList.remove("hidden");
      loadAccountsForSite();
      return;
    }

    let data;
    try {
      data = JSON.parse(result.passproData);
    } catch {
      lockScreen.classList.add("hidden");
      mainContent.classList.remove("hidden");
      loadAccountsForSite();
      return;
    }

    const pin = data.pin;
    if (!pin) {
      lockScreen.classList.add("hidden");
      mainContent.classList.remove("hidden");
      loadAccountsForSite();
      return;
    }

    if (!reloaded) {
      lockScreen.classList.remove("hidden");
      mainContent.classList.add("hidden");
    }

    document.getElementById("unlockBtn").onclick = () => {
      const input = document.getElementById("masterInput").value;
      if (input === pin.toString()) {
        document.getElementById("lockStatus").textContent = "";
        lockScreen.classList.add("hidden");
        mainContent.classList.remove("hidden");
        loadAccountsForSite();
      } else {
        document.getElementById("lockStatus").textContent = "Incorrect PIN.";
      }
    };
  });
}

document.getElementById("version").textContent = chrome.runtime.getManifest().version;
checkMasterLock();