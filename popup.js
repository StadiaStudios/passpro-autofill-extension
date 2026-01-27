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
      // After loading new data, re-check lock and accounts
      checkMasterLock(true);
    });
  };

  reader.readAsText(file);
});

// Extract domain
function getDomain(url) {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return null;
  }
}

// Load accounts for current site
function loadAccountsForSite() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
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
        return entryDomain && entryDomain.includes(domain);
      });

      const list = document.getElementById("accountList");
      list.innerHTML = "";

      if (matches.length === 0) {
        list.innerHTML = "<p>No accounts found for this site.</p>";
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
                response?.status === "filled"
                  ? "Filled!"
                  : "Failed to fill.";
            }
          );
        });

        list.appendChild(btn);
      });
    });
  });
}

// View All Passwords Panel
document.getElementById("viewAllBtn").addEventListener("click", () => {
  const panel = document.getElementById("allPasswordsPanel");
  panel.classList.toggle("hidden");
  loadAllPasswords();
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
      label.textContent = `${entry.title} | ${entry.username}`;
      label.className = "account-label";

      const pwd = document.createElement("div");
      pwd.textContent = entry.password;
      pwd.className = "password-hidden";

      const btn = document.createElement("button");
      btn.textContent = "View";
      btn.className = "view-btn";

      btn.addEventListener("click", () => {
        if (pwd.classList.contains("password-hidden")) {
          pwd.classList.remove("password-hidden");
          pwd.classList.add("password-visible");
          btn.textContent = "Hide";
        } else {
          pwd.classList.remove("password-visible");
          pwd.classList.add("password-hidden");
          btn.textContent = "View";
        }
      });

      item.appendChild(label);
      item.appendChild(pwd);
      item.appendChild(btn);

      list.appendChild(item);
    });
  });
}

// Search Filter
document.getElementById("searchInput").addEventListener("input", (e) => {
  const term = e.target.value.toLowerCase();
  const items = document.querySelectorAll("#allPasswordsList .account-item");

  items.forEach(item => {
    item.style.display = item.textContent.toLowerCase().includes(term)
      ? "block"
      : "none";
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

    // Use PIN instead of masterpassword
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

      if (input === pin) {
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


// Settings Version
document.getElementById("version").textContent =
  chrome.runtime.getManifest().version;

// Start with master lock check
checkMasterLock();
