import MapManager from './mapmanager.mjs';
import StorageManager from './storagemanager.mjs';
import { generateId, formatDate } from './utils.mjs';

const mapManager = new MapManager('map');
let currentEditingEntry = null;

function init() {
  mapManager.init();
  
  mapManager.onMapClick((lat, lng) => {
    openLocationModal(lat, lng);
  });

  loadEntries();
  setupEventListeners();
}

function setupEventListeners() {
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const page = link.getAttribute('data-page');
      showPage(page);
    });
  });

  const addLocationBtn = document.getElementById('addLocationBtn');
  if (addLocationBtn) {
    addLocationBtn.addEventListener('click', () => {
      const center = mapManager.getMap().getCenter();
      openLocationModal(center.lat, center.lng);
    });
  }

  const modal = document.getElementById('locationModal');
  const closeModal = document.getElementById('closeModal');
  const cancelBtn = document.getElementById('cancelBtn');
  const locationForm = document.getElementById('locationForm');

  if (closeModal) {
    closeModal.addEventListener('click', closeLocationModal);
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', closeLocationModal);
  }

  if (locationForm) {
    locationForm.addEventListener('submit', handleFormSubmit);
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeLocationModal();
      }
    });
  }
}

function showPage(pageName) {
  document.querySelectorAll('.view').forEach(view => {
    view.classList.remove('active');
  });

  const targetView = document.getElementById(`${pageName}-view`);
  if (targetView) {
    targetView.classList.add('active');
  }

  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active');
    if (link.getAttribute('data-page') === pageName) {
      link.classList.add('active');
    }
  });

  if (pageName === 'history') {
    loadHistoryView();
  } else if (pageName === 'stats') {
    loadStatsView();
  }
}

function openLocationModal(lat, lng, entry = null) {
  const modal = document.getElementById('locationModal');
  const form = document.getElementById('locationForm');
  const modalTitle = document.getElementById('modalTitle');
  
  document.getElementById('latitude').value = lat;
  document.getElementById('longitude').value = lng;

  if (entry) {
    currentEditingEntry = entry;
    modalTitle.textContent = 'Edit Fishing Entry';
    document.getElementById('locationName').value = entry.locationName || '';
    document.getElementById('fishingDate').value = entry.date || '';
    document.getElementById('fishSpecies').value = entry.species || '';
    document.getElementById('fishQuantity').value = entry.quantity || 0;
    document.getElementById('notes').value = entry.notes || '';
  } else {
    currentEditingEntry = null;
    modalTitle.textContent = 'Add Fishing Location';
    form.reset();
    document.getElementById('fishingDate').value = new Date().toISOString().split('T')[0];
  }

  modal.classList.add('active');
}

function closeLocationModal() {
  const modal = document.getElementById('locationModal');
  modal.classList.remove('active');
  currentEditingEntry = null;
}

function handleFormSubmit(e) {
  e.preventDefault();

  const formData = {
    id: currentEditingEntry ? currentEditingEntry.id : generateId(),
    latitude: parseFloat(document.getElementById('latitude').value),
    longitude: parseFloat(document.getElementById('longitude').value),
    locationName: document.getElementById('locationName').value,
    date: document.getElementById('fishingDate').value,
    species: document.getElementById('fishSpecies').value,
    quantity: parseInt(document.getElementById('fishQuantity').value) || 0,
    notes: document.getElementById('notes').value,
    createdAt: currentEditingEntry ? currentEditingEntry.createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (currentEditingEntry) {
    StorageManager.updateEntry(currentEditingEntry.id, formData);
  } else {
    StorageManager.saveEntry(formData);
  }

  closeLocationModal();
  loadEntries();
  
  const activeView = document.querySelector('.view.active');
  if (activeView) {
    if (activeView.id === 'history-view') {
      loadHistoryView();
    } else if (activeView.id === 'stats-view') {
      loadStatsView();
    }
  }
}

function loadEntries() {
  const entries = StorageManager.getEntries();
  
  mapManager.clearMarkers();

  entries.forEach(entry => {
    const popupContent = `
      <div>
        <h3>${entry.locationName || 'Unnamed Location'}</h3>
        <p><strong>Date:</strong> ${formatDate(entry.date)}</p>
        ${entry.species ? `<p><strong>Species:</strong> ${entry.species}</p>` : ''}
        ${entry.quantity > 0 ? `<p><strong>Caught:</strong> ${entry.quantity}</p>` : ''}
        <button onclick="editEntry('${entry.id}')">Edit</button>
      </div>
    `;
    mapManager.addMarker(entry.latitude, entry.longitude, popupContent);
  });

  updateRecentEntries(entries.slice(-5).reverse());
}

function updateRecentEntries(entries) {
  const container = document.getElementById('recent-entries');
  
  if (entries.length === 0) {
    container.innerHTML = '<p class="empty-message">No entries yet. Click on the map to add your first fishing location!</p>';
    return;
  }

  container.innerHTML = entries.map(entry => `
    <div class="entry-item" onclick="viewEntry('${entry.id}')">
      <h3>${entry.locationName || 'Unnamed Location'}</h3>
      <p><strong>Date:</strong> ${formatDate(entry.date)}</p>
      ${entry.species ? `<p><strong>Species:</strong> ${entry.species}</p>` : ''}
      ${entry.quantity > 0 ? `<p><strong>Caught:</strong> ${entry.quantity}</p>` : ''}
    </div>
  `).join('');
}

function loadHistoryView() {
  const entries = StorageManager.getEntries();
  const container = document.getElementById('history-entries');

  if (entries.length === 0) {
    container.innerHTML = '<p class="empty-message">No fishing entries found.</p>';
    return;
  }

  const sortedEntries = [...entries].sort((a, b) => 
    new Date(b.date) - new Date(a.date)
  );

  container.innerHTML = sortedEntries.map(entry => `
    <div class="entry-item" onclick="editEntry('${entry.id}')">
      <h3>${entry.locationName || 'Unnamed Location'}</h3>
      <p><strong>Date:</strong> ${formatDate(entry.date)}</p>
      ${entry.species ? `<p><strong>Species:</strong> ${entry.species}</p>` : ''}
      ${entry.quantity > 0 ? `<p><strong>Caught:</strong> ${entry.quantity}</p>` : ''}
      ${entry.notes ? `<p>${entry.notes}</p>` : ''}
    </div>
  `).join('');
}

function loadStatsView() {
  const entries = StorageManager.getEntries();
  
  const totalTrips = entries.length;
  const totalFish = entries.reduce((sum, entry) => sum + (entry.quantity || 0), 0);
  
  const locationCounts = {};
  entries.forEach(entry => {
    const key = `${entry.latitude},${entry.longitude}`;
    locationCounts[key] = (locationCounts[key] || 0) + 1;
  });
  const mostFished = Object.entries(locationCounts)
    .sort((a, b) => b[1] - a[1])[0];
  const mostFishedEntry = mostFished 
    ? entries.find(e => `${e.latitude},${e.longitude}` === mostFished[0])
    : null;

  const speciesCounts = {};
  entries.forEach(entry => {
    if (entry.species) {
      speciesCounts[entry.species] = (speciesCounts[entry.species] || 0) + 1;
    }
  });
  const favoriteSpecies = Object.entries(speciesCounts)
    .sort((a, b) => b[1] - a[1])[0];

  document.getElementById('total-trips').textContent = totalTrips;
  document.getElementById('total-fish').textContent = totalFish;
  document.getElementById('most-fished').textContent = 
    mostFishedEntry ? (mostFishedEntry.locationName || 'Unnamed') : '-';
  document.getElementById('favorite-species').textContent = 
    favoriteSpecies ? favoriteSpecies[0] : '-';
}

window.editEntry = function(entryId) {
  const entries = StorageManager.getEntries();
  const entry = entries.find(e => e.id === entryId);
  if (entry) {
    openLocationModal(entry.latitude, entry.longitude, entry);
  }
};

window.viewEntry = function(entryId) {
  const entries = StorageManager.getEntries();
  const entry = entries.find(e => e.id === entryId);
  if (entry) {
    mapManager.centerMap(entry.latitude, entry.longitude);
    showPage('map');
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

