console.log("PassPro Autofill content script running");

// Force-fill helper
function forceFill(element, value) {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value"
  ).set;

  setter.call(element, value);

  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

// Shadow DOM helper
function queryShadow(selector) {
  const parts = selector.split(">>>");
  let current = document;

  for (const part of parts) {
    if (!current) return null;

    current = current.querySelector(part);
    if (!current) return null;

    if (current.shadowRoot) {
      current = current.shadowRoot;
    }
  }

  return current;
}

// Auto-click Google Next
function clickGoogleNext() {
  const nextBtn = document.querySelector("#identifierNext button, #passwordNext button");
  if (nextBtn) nextBtn.click();
}

// Wait for Google password field
function waitForGooglePassword(callback) {
  const selectors = [
    "input[type='password']",
    "input[name='Passwd']",
    "input[name='password']",
    "input[autocomplete='current-password']",
    "#password >>> input"
  ];

  const check = () => {
    for (const sel of selectors) {
      let field;

      if (sel.includes(">>>")) {
        field = queryShadow(sel);
      } else {
        field = document.querySelector(sel);
      }

      if (field) {
        callback(field);
        return;
      }
    }
    requestAnimationFrame(check);
  };

  check();
}

// Main handler
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action !== "fillCredentials") return;

  const { username, password } = msg.data;

  // Google email page
  const googleEmail = document.querySelector("input[type='email']");
  const googleIdentifier = document.querySelector("#identifierId");

  if (googleEmail || googleIdentifier) {
    forceFill(googleEmail || googleIdentifier, username);
    setTimeout(clickGoogleNext, 300);
    sendResponse({ status: "filled" });
    return;
  }

  // Google password page
  if (window.location.href.includes("signin")) {
    waitForGooglePassword((pwdField) => {
      forceFill(pwdField, password);
      setTimeout(clickGoogleNext, 300);
    });

    sendResponse({ status: "filled" });
    return true;
  }

  // Normal login pages
  const usernameField = document.querySelector(
    "input[type='text'], input[name='username'], input[id*='user'], input[name='email']"
  );

  const passwordField = document.querySelector("input[type='password']");

  if (usernameField) forceFill(usernameField, username);
  if (passwordField) forceFill(passwordField, password);

  sendResponse({ status: "filled" });
});
