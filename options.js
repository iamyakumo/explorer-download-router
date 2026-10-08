const listEl = document.getElementById("rule-list");
const statusEl = document.getElementById("status");
let rules = [];

function render() {
  listEl.innerHTML = "";
  rules.forEach((rule, i) => {
    const tr = document.createElement("tr");

    const tdPattern = document.createElement("td");
    const patternInput = document.createElement("input");
    patternInput.type = "text";
    patternInput.value = rule.pattern;
    patternInput.addEventListener("input", () => (rule.pattern = patternInput.value));
    tdPattern.appendChild(patternInput);

    const tdFolder = document.createElement("td");
    const folderInput = document.createElement("input");
    folderInput.type = "text";
    folderInput.value = rule.folder;
    folderInput.addEventListener("input", () => (rule.folder = folderInput.value));
    tdFolder.appendChild(folderInput);

    const tdDel = document.createElement("td");
    const delBtn = document.createElement("button");
    delBtn.textContent = "删除";
    delBtn.className = "del";
    delBtn.addEventListener("click", () => {
      rules.splice(i, 1);
      render();
    });
    tdDel.appendChild(delBtn);

    tr.appendChild(tdPattern);
    tr.appendChild(tdFolder);
    tr.appendChild(tdDel);
    listEl.appendChild(tr);
  });
}

async function load() {
  const data = await chrome.storage.sync.get({ rules: [] });
  rules = Array.isArray(data.rules) ? data.rules : [];
  render();
}

function showStatus(text) {
  statusEl.textContent = text;
  setTimeout(() => (statusEl.textContent = ""), 2500);
}

document.getElementById("add-btn").addEventListener("click", () => {
  const pattern = document.getElementById("new-pattern").value.trim();
  const folder = document.getElementById("new-folder").value.trim();
  if (!pattern || !folder) {
    showStatus("请同时填写域名和文件夹");
    return;
  }
  rules.push({ pattern, folder });
  document.getElementById("new-pattern").value = "";
  document.getElementById("new-folder").value = "";
  render();
});

document.getElementById("save-btn").addEventListener("click", async () => {
  const cleaned = rules
    .map((r) => ({ pattern: r.pattern.trim(), folder: r.folder.trim() }))
    .filter((r) => r.pattern && r.folder);
  await chrome.storage.sync.set({ rules: cleaned });
  rules = cleaned;
  render();
  showStatus("已保存 ✓");
});

load();
