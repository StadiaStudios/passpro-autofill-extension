// Choose File Button
document.getElementById("chooseFileBtn").addEventListener("click", () => {
  document.getElementById("fileInput").click();
});

// Load PassPro File (.json and disguised .png support)
document.getElementById("loadBtn").addEventListener("click", () => {
  const file = document.getElementById("fileInput").files[0];
  if (!file) {
    document.getElementById("status").textContent = "No file selected.";
    return;
  }

  const relockAndLoad = (jsonContent, message) => {
    chrome.storage.local.set({ passproData: jsonContent }, () => {
      document.getElementById("status").textContent = message || "PassPro data loaded.";
      // Always relock on import for extra security
      document.getElementById("masterInput").value = "";
      document.getElementById("lockStatus").textContent = "";
      document.getElementById("lockScreen").classList.remove("hidden");
      document.getElementById("mainContent").classList.add("hidden");
      checkMasterLock(true);
    });
  };

  const reader = new FileReader();
  const fileName = file.name.toLowerCase();

  // Handle .png disguised PassPro files (base64 encoded JSON inside PNG comment or whole PNG is base64 json)
  if (fileName.endsWith(".png")) {
    reader.onload = () => {
      const buffer = new Uint8Array(reader.result);
      const textDecoder = new TextDecoder();
      const asString = textDecoder.decode(buffer);

      let base64Json = null;
      let jsonContent = null;

      const passproMarker = 'passpro:';
      const markerIndex = asString.indexOf(passproMarker);
      if (markerIndex !== -1) {
        base64Json = asString.substring(markerIndex + passproMarker.length).trim();
      } else {
        const dataPrefix = 'data:application/json;base64,';
        const dataIdx = asString.indexOf(dataPrefix);
        if (dataIdx !== -1) {
          base64Json = asString.substring(dataIdx + dataPrefix.length).replace(/[^A-Za-z0-9+/=]+/g, '');
        }
      }
      if (!base64Json) {
        const jsonStart = asString.indexOf('{');
        if (jsonStart !== -1) {
          base64Json = null;
          jsonContent = asString.substring(jsonStart);
        }
      } else {
        try {
          jsonContent = atob(base64Json);
        } catch {
          jsonContent = null;
        }
      }

      try {
        if (jsonContent) {
          JSON.parse(jsonContent); // Validate
          relockAndLoad(jsonContent, "PassPro data loaded. Please unlock to access.");
        } else {
          throw new Error("No valid PassPro data found in PNG.");
        }
      } catch {
        document.getElementById("status").textContent = "Invalid PassPro .png file.";
      }
    };
    reader.readAsArrayBuffer(file);
  } else {
    // Normal JSON flow
    reader.onload = () => {
      try {
        JSON.parse(reader.result); // Validate
        relockAndLoad(reader.result, "PassPro data loaded. Please unlock to access.");
      } catch {
        document.getElementById("status").textContent = "Invalid PassPro file.";
      }
    };
    reader.readAsText(file);
  }
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

    // Always show the lock screen after import or as needed
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

    // Add forgot pin link if not already present
    let forgotPinLink = document.getElementById("forgotPinLink");
    if (!forgotPinLink) {
      forgotPinLink = document.createElement("a");
      forgotPinLink.id = "forgotPinLink";
      forgotPinLink.href = "https://stadiastudios.github.io/passpro/pages/help.html#forgot-pin";
      forgotPinLink.target = "_blank";
      forgotPinLink.textContent = "Forgot your PIN?";
      forgotPinLink.style.display = "block";
      forgotPinLink.style.marginTop = "10px";
      forgotPinLink.style.textAlign = "center";
      forgotPinLink.style.color = "white";
      const lockScreenDiv = document.getElementById("lockScreen");
      lockScreenDiv.appendChild(forgotPinLink);
    }
  });
}

document.getElementById("version").textContent = chrome.runtime.getManifest().version;
checkMasterLock();