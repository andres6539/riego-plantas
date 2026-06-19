const STORAGE_KEY = 'riego_plantas_v2';
const $ = (id) => document.getElementById(id);
const todayISO = () => new Date().toISOString().slice(0,10);
let editingId = null;
let currentPhoto = '';

$('lastWatered').value = todayISO();

function loadPlants(){
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}
function savePlants(plants){ localStorage.setItem(STORAGE_KEY, JSON.stringify(plants)); }
function addDays(dateISO, days){
  const d = new Date(dateISO + 'T00:00:00');
  d.setDate(d.getDate() + Number(days));
  return d.toISOString().slice(0,10);
}
function daysBetween(aISO, bISO){
  const a = new Date(aISO+'T00:00:00');
  const b = new Date(bISO+'T00:00:00');
  return Math.ceil((a-b)/(1000*60*60*24));
}
function typeSuggestion(type){
  const t = (type||'').toLowerCase();
  if(t.includes('sansevieria')) return 'Poca agua. Mejor esperar a que se seque bien.';
  if(t.includes('potus') || t.includes('pothos')) return 'Le gusta luz indirecta y riego moderado.';
  if(t.includes('palo')) return 'Evitar encharcar. Buena luz indirecta.';
  if(t.includes('cactus') || t.includes('suculenta')) return 'Muy poco riego. Tierra bien seca.';
  return '';
}

$('photoInput').addEventListener('change', (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    currentPhoto = reader.result;
    $('preview').src = currentPhoto;
    $('preview').classList.remove('hidden');
  };
  reader.readAsDataURL(file);
});

$('plantType').addEventListener('change', () => {
  const val = $('plantType').value;
  if(val.includes('Sansevieria')) $('frequency').value = 20;
  if(val.includes('Potus')) $('frequency').value = 10;
  if(val.includes('Palo')) $('frequency').value = 12;
  if(val.includes('Suculenta') || val.includes('Cactus')) $('frequency').value = 25;
});

$('plantForm').addEventListener('submit', (e)=>{
  e.preventDefault();
  const plants = loadPlants();
  const type = $('customType').value.trim() || $('plantType').value.trim();
  const plant = {
    id: editingId || crypto.randomUUID(),
    name: $('plantName').value.trim(),
    type,
    frequency: Number($('frequency').value),
    lastWatered: $('lastWatered').value,
    notes: $('notes').value.trim(),
    photo: currentPhoto,
    history: editingId ? (plants.find(p=>p.id===editingId)?.history || []) : []
  };
  const idx = plants.findIndex(p=>p.id===plant.id);
  if(idx >= 0) plants[idx] = plant; else plants.push(plant);
  savePlants(plants);
  resetForm();
  render();
});

function resetForm(){
  editingId = null; currentPhoto = '';
  $('plantForm').reset(); $('lastWatered').value = todayISO();
  $('preview').classList.add('hidden'); $('preview').removeAttribute('src');
  document.querySelector('#plantForm button[type="submit"]').textContent = 'Guardar planta';
}

function render(){
  const list = $('plantList');
  list.innerHTML = '';
  const plants = loadPlants().sort((a,b)=> addDays(a.lastWatered,a.frequency).localeCompare(addDays(b.lastWatered,b.frequency)));
  if(!plants.length){ list.innerHTML = '<p class="muted">Todavía no cargaste plantas.</p>'; return; }
  const template = $('plantTemplate');
  plants.forEach(plant=>{
    const node = template.content.cloneNode(true);
    const next = addDays(plant.lastWatered, plant.frequency);
    const remaining = daysBetween(next, todayISO());
    const statusText = remaining <= 0 ? `Toca regar hoy o está atrasada (${Math.abs(remaining)} días)` : `Faltan ${remaining} días para regar`;
    const img = node.querySelector('.plant-photo');
    img.src = plant.photo || 'icons/icon-192.png';
    node.querySelector('h3').textContent = plant.name;
    node.querySelector('.type').textContent = plant.type || 'Sin tipo definido';
    const status = node.querySelector('.status');
    status.textContent = statusText;
    status.classList.add(remaining <= 0 ? 'due' : 'ok');
    node.querySelector('.dates').textContent = `Último: ${plant.lastWatered} · Próximo: ${next} · Cada ${plant.frequency} días`;
    node.querySelector('.notes').textContent = [plant.notes, typeSuggestion(plant.type)].filter(Boolean).join(' · ');
    node.querySelector('.water').onclick = () => waterPlant(plant.id);
    node.querySelector('.edit').onclick = () => editPlant(plant.id);
    node.querySelector('.delete').onclick = () => deletePlant(plant.id);
    list.appendChild(node);
  });
}
function waterPlant(id){
  const plants = loadPlants();
  const p = plants.find(x=>x.id===id);
  if(!p) return;
  p.lastWatered = todayISO();
  p.history = [...(p.history||[]), {date: todayISO(), action:'riego'}];
  savePlants(plants); render();
}
function editPlant(id){
  const p = loadPlants().find(x=>x.id===id); if(!p) return;
  editingId = p.id; currentPhoto = p.photo || '';
  $('plantName').value = p.name; $('customType').value = p.type || ''; $('plantType').value = '';
  $('frequency').value = p.frequency; $('lastWatered').value = p.lastWatered; $('notes').value = p.notes || '';
  if(currentPhoto){ $('preview').src = currentPhoto; $('preview').classList.remove('hidden'); }
  document.querySelector('#plantForm button[type="submit"]').textContent = 'Guardar cambios';
  window.scrollTo({top:0, behavior:'smooth'});
}
function deletePlant(id){
  if(!confirm('¿Borrar esta planta?')) return;
  savePlants(loadPlants().filter(p=>p.id!==id)); render();
}

$('exportBtn').onclick = () => {
  const blob = new Blob([JSON.stringify(loadPlants(), null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'backup-riego-plantas.json'; a.click();
  URL.revokeObjectURL(url);
};
$('importBtn').onclick = () => $('importInput').click();
$('importInput').onchange = (e)=>{
  const file = e.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = () => { try { savePlants(JSON.parse(reader.result)); render(); } catch { alert('Backup inválido'); } };
  reader.readAsText(file);
};

if('serviceWorker' in navigator){ navigator.serviceWorker.register('sw.js'); }
let deferredPrompt;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; $('installBtn').classList.remove('hidden'); });
$('installBtn').onclick = async () => { if(deferredPrompt){ deferredPrompt.prompt(); deferredPrompt = null; $('installBtn').classList.add('hidden'); }};
render();
