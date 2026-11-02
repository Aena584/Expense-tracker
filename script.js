// ---------- Data ----------
const CATS = ["Food","Transport","Education","Shopping","Bills","Health","Fun","Salary","Pocket money","Other"];
const COLORS = ["#7c3aed","#e11d48","#2563eb","#f59e0b","#0891b2","#db2777","#059669","#65a30d","#f97316","#64748b"];
let items = load("pt_items", []);
let budget = load("pt_budget", 0);
let editId = null, lastAdded = null;

function load(k, d){ try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch(e){ return d; } }
function save(){ localStorage.setItem("pt_items", JSON.stringify(items)); localStorage.setItem("pt_budget", JSON.stringify(budget)); }
const $ = id => document.getElementById(id);
const money = n => "Rs " + Number(n).toLocaleString("en-PK");
const today = () => new Date().toISOString().slice(0,10);

// ---------- Setup ----------
$("category").innerHTML = CATS.map(c => `<option>${c}</option>`).join("");
$("fCat").innerHTML = '<option value="all">All categories</option>' + CATS.map(c => `<option>${c}</option>`).join("");
$("date").value = today();
$("bMonth").value = today().slice(0,7);
$("bMonth").addEventListener("input", draw);
if (load("pt_theme","light") === "dark") setTheme("dark");

// ---------- Theme ----------
function setTheme(t){
  document.documentElement.dataset.theme = t === "dark" ? "dark" : "";
  $("themeBtn").textContent = t === "dark" ? "Light mode" : "Dark mode";
  localStorage.setItem("pt_theme", JSON.stringify(t));
}
$("themeBtn").onclick = () => { setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"); draw(); };

// ---------- Add / edit ----------
$("saveBtn").onclick = () => {
  const title = $("title").value.trim();
  const amount = Number($("amount").value);
  const date = $("date").value;
  const type = document.querySelector('input[name="type"]:checked').value;
  if (!title) return err("Please write a title.");
  if (!amount || amount <= 0) return err("Amount must be more than 0.");
  if (!date) return err("Please choose a date.");
  err("");
  const data = { title, amount, date, type, category: $("category").value };
  if (editId) { items = items.map(t => t.id === editId ? { ...t, ...data } : t); toast("Transaction updated"); }
  else { lastAdded = Date.now(); items.push({ id: lastAdded, ...data }); toast("Transaction added"); burst(); }
  save(); resetForm(); draw();
};
$("cancelBtn").onclick = resetForm;
function err(m){ $("formError").textContent = m; }
function resetForm(){
  editId = null; err("");
  $("title").value = ""; $("amount").value = ""; $("date").value = today();
  document.querySelector('input[name="type"][value="expense"]').checked = true;
  $("formTitle").textContent = "Add transaction"; $("saveBtn").textContent = "Add transaction"; $("cancelBtn").hidden = true;
}
function editItem(id){
  const t = items.find(x => x.id === id); editId = id;
  $("title").value = t.title; $("amount").value = t.amount; $("date").value = t.date; $("category").value = t.category;
  document.querySelector(`input[name="type"][value="${t.type}"]`).checked = true;
  $("formTitle").textContent = "Edit transaction"; $("saveBtn").textContent = "Save changes"; $("cancelBtn").hidden = false;
  $("title").focus(); window.scrollTo({ top: 0, behavior: "smooth" });
}
function deleteItem(id){
  if (!confirm("Delete this transaction?")) return;
  items = items.filter(t => t.id !== id); save(); draw(); toast("Transaction deleted");
}

// ---------- Budget ----------
$("budgetBtn").onclick = () => {
  const v = Number($("budgetInput").value);
  if (v < 0 || isNaN(v)) return toast("Enter a valid budget");
  budget = v; save(); draw(); toast(v ? "Budget saved" : "Budget removed");
};

// ---------- Filters ----------
["search","fType","fCat","fMonth"].forEach(id => $(id).addEventListener("input", draw));
function filtered(){
  const q = $("search").value.toLowerCase(), ty = $("fType").value, ca = $("fCat").value, mo = $("fMonth").value;
  return items.filter(t => t.title.toLowerCase().includes(q) && (ty === "all" || t.type === ty) &&
    (ca === "all" || t.category === ca) && (!mo || t.date.startsWith(mo)))
    .sort((a,b) => b.date.localeCompare(a.date) || b.id - a.id);
}

// ---------- Draw everything ----------
function draw(){
  const inc = sum(items, "income"), exp = sum(items, "expense");
  countUp("income", inc); countUp("expense", exp); countUp("balance", inc - exp);

  // budget (this month's expenses)
  const month = $("bMonth").value || today().slice(0,7);
  const spent = items.filter(t => t.type === "expense" && t.date.startsWith(month)).reduce((s,t) => s + t.amount, 0);
  const f = $("budgetFill"), txt = $("budgetText");
  if (budget > 0) {
    const p = Math.min(100, spent / budget * 100);
    f.style.width = p + "%"; f.style.background = p >= 100 ? "var(--exp)" : p >= 80 ? "#ca8a04" : "var(--inc)";
    txt.textContent = spent > budget ? `Over budget by ${money(spent - budget)}! Spent ${money(spent)} of ${money(budget)} in ${month}.`
      : `Spent ${money(spent)} of ${money(budget)} in ${month}. Left: ${money(budget - spent)}.`;
    if (spent === 0 && sum(items, "expense") > 0) txt.textContent += " (No expense found in this month. Change Budget month to see other months.)";
  } else { f.style.width = "0"; txt.textContent = "No budget set yet."; }

  // list
  const list = filtered();
  $("list").innerHTML = list.map(t => `
    <li class="${t.id === lastAdded ? "new" : ""}"><div class="dot">${t.category.slice(0,2)}</div>
      <div class="info"><b>${esc(t.title)}<span class="tag ${t.type}">${t.type}</span></b><small>${t.category} &middot; ${t.date}</small></div>
      <span class="amt ${t.type}">${t.type === "income" ? "+" : "-"}${money(t.amount)}</span>
      <span class="acts"><button class="ghost" onclick="editItem(${t.id})">Edit</button><button class="danger" onclick="deleteItem(${t.id})">Delete</button></span>
    </li>`).join("");
  $("listEmpty").hidden = list.length > 0;
  lastAdded = null;
  drawIncome(inc);
  drawChart();
}

function drawIncome(total){
  const by = {};
  items.filter(t => t.type === "income").forEach(t => {
    by[t.category] = by[t.category] || { sum: 0, n: 0, names: [] };
    by[t.category].sum += t.amount; by[t.category].n++;
    if (!by[t.category].names.includes(t.title)) by[t.category].names.push(t.title);
  });
  const keys = Object.keys(by).sort((a,b) => by[b].sum - by[a].sum);
  $("incEmpty").hidden = keys.length > 0;
  $("incList").innerHTML = keys.map(k => {
    const p = Math.round(by[k].sum / total * 100);
    return `<li><div class="top2"><span>${k} <small>(${esc(by[k].names.join(", "))})</small></span><b>${money(by[k].sum)} &middot; ${p}%</b></div>
      <div class="mini"><div style="width:${p}%"></div></div></li>`;
  }).join("");
}
const sum = (arr, type) => arr.filter(t => t.type === type).reduce((s,t) => s + t.amount, 0);
const esc = s => s.replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

// ---------- Doughnut chart (plain canvas, no library) ----------
function drawChart(){
  const cv = $("chart"), ctx = cv.getContext("2d");
  cv.classList.remove("pop"); void cv.offsetWidth; cv.classList.add("pop");
  ctx.clearRect(0, 0, cv.width, cv.height);
  const totals = {};
  items.filter(t => t.type === "expense").forEach(t => totals[t.category] = (totals[t.category] || 0) + t.amount);
  const keys = Object.keys(totals), all = keys.reduce((s,k) => s + totals[k], 0);
  $("chartEmpty").hidden = keys.length > 0; cv.hidden = !keys.length;
  $("legend").innerHTML = "";
  let start = -Math.PI / 2;
  keys.forEach(k => {
    const ang = totals[k] / all * Math.PI * 2, col = COLORS[CATS.indexOf(k)];
    ctx.beginPath(); ctx.moveTo(130,130); ctx.arc(130,130,120,start,start+ang); ctx.fillStyle = col; ctx.fill();
    start += ang;
    $("legend").innerHTML += `<li><i style="background:${col}"></i>${k}: ${money(totals[k])} (${Math.round(totals[k]/all*100)}%)</li>`;
  });
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath(); ctx.arc(130,130,70,0,Math.PI*2); ctx.fill();
  ctx.globalCompositeOperation = "source-over";
}

// ---------- CSV + clear ----------
$("csvBtn").onclick = () => {
  if (!items.length) return toast("Nothing to download");
  const rows = ["Date,Title,Type,Category,Amount", ...items.map(t => [t.date, `"${t.title.replace(/"/g,'""')}"`, t.type, t.category, t.amount].join(","))];
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([rows.join("\n")], { type: "text/csv" }));
  a.download = "transactions.csv"; a.click();
};
$("clearBtn").onclick = () => {
  if (!items.length) return toast("Nothing to delete");
  if (confirm("Delete ALL transactions? This cannot be undone.")) { items = []; save(); draw(); toast("All data deleted"); }
};

// ---------- Animations ----------
function countUp(id, to){
  const el = $(id), from = Number(el.dataset.v || 0), t0 = performance.now(); el.dataset.v = to;
  (function step(t){ const p = Math.min(1, (t - t0) / 700), e = 1 - Math.pow(1 - p, 3);
    el.textContent = money(Math.round(from + (to - from) * e)); if (p < 1) requestAnimationFrame(step); })(t0);
}
function burst(){
  const b = $("saveBtn").getBoundingClientRect();
  for (let i = 0; i < 12; i++) {
    const c = document.createElement("i"); c.className = "coin"; c.textContent = "₨";
    c.style.left = b.left + b.width / 2 + "px"; c.style.top = b.top + "px";
    c.style.setProperty("--dx", (Math.random() * 240 - 120) + "px"); c.style.setProperty("--dy", (-60 - Math.random() * 140) + "px");
    document.body.appendChild(c); setTimeout(() => c.remove(), 900);
  }
}
// ---------- Toast ----------
let tt;
function toast(m){ const t = $("toast"); t.textContent = m; t.classList.add("show"); clearTimeout(tt); tt = setTimeout(() => t.classList.remove("show"), 2200); }

if (budget) $("budgetInput").value = budget;
draw();
