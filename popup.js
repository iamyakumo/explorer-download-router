const toggle = document.getElementById("toggle");

chrome.storage.sync.get({ enabled: true }, (data) => {
  toggle.checked = data.enabled !== false;
});

toggle.addEventListener("change", () => {
  chrome.storage.sync.set({ enabled: toggle.checked });
});

document.getElementById("open-options").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});
