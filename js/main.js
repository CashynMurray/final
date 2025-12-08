import MapManager from './mapmanager.mjs';
import StorageManager from './storagemanager.mjs';
import WeatherAPI from './weatherapi.mjs';
import { generateId, formatDate } from './utils.mjs';

const mapManager = new MapManager('map');
const weatherAPI = new WeatherAPI();
let currentEditingEntry = null;
let markerMap = new Map();

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

  const locationDetailsModal = document.getElementById('locationDetailsModal');
  if (locationDetailsModal) {
    locationDetailsModal.addEventListener('click', (e) => {
      if (e.target === locationDetailsModal) {
        closeLocationDetails();
      }
    });
  }

  const searchInput = document.getElementById('searchInput');
  const speciesFilter = document.getElementById('speciesFilter');
  const dateFilter = document.getElementById('dateFilter');

  if (searchInput) {
    searchInput.addEventListener('input', applyFilters);
  }

  if (speciesFilter) {
    speciesFilter.addEventListener('change', () => {
      updateSpeciesFilterHint();
      applyFilters();
    });
    updateSpeciesFilterHint();
  }

  if (dateFilter) {
    dateFilter.addEventListener('change', applyFilters);
  }

  const exportBtn = document.getElementById('exportBtn');
  const importBtn = document.getElementById('importBtn');
  const importInput = document.getElementById('importInput');

  if (exportBtn) {
    exportBtn.addEventListener('click', handleExport);
  }

  if (importBtn && importInput) {
    importBtn.addEventListener('click', () => importInput.click());
    importInput.addEventListener('change', handleImport);
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

async function handleFormSubmit(e) {
  e.preventDefault();

  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Loading weather data...';

  const lat = parseFloat(document.getElementById('latitude').value);
  const lng = parseFloat(document.getElementById('longitude').value);
  const date = document.getElementById('fishingDate').value;

  let weatherData = null;
  try {
    weatherData = await weatherAPI.fetchWeatherData(lat, lng, date);
  } catch (error) {
    console.error('Error fetching weather:', error);
  }

  const formData = {
    id: currentEditingEntry ? currentEditingEntry.id : generateId(),
    latitude: lat,
    longitude: lng,
    locationName: document.getElementById('locationName').value,
    date: date,
    species: document.getElementById('fishSpecies').value,
    quantity: parseInt(document.getElementById('fishQuantity').value) || 0,
    notes: document.getElementById('notes').value,
    weather: weatherData,
    createdAt: currentEditingEntry ? currentEditingEntry.createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (currentEditingEntry) {
    StorageManager.updateEntry(currentEditingEntry.id, formData);
  } else {
    StorageManager.saveEntry(formData);
  }

  submitBtn.disabled = false;
  submitBtn.textContent = originalText;
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
  markerMap.clear();

  const locationGroups = {};
  entries.forEach(entry => {
    const key = `${entry.latitude},${entry.longitude}`;
    if (!locationGroups[key]) {
      locationGroups[key] = [];
    }
    locationGroups[key].push(entry);
  });

  Object.entries(locationGroups).forEach(([key, locationEntries]) => {
    const firstEntry = locationEntries[0];
    const locationStats = calculateLocationStats(locationEntries);
    
    const popupContent = createLocationPopupContent(firstEntry, locationEntries, locationStats);
    const marker = mapManager.addMarker(firstEntry.latitude, firstEntry.longitude, popupContent);
    
    markerMap.set(key, { marker, entries: locationEntries });
  });

  updateRecentEntries(entries.slice(-5).reverse());
}

function calculateLocationStats(entries) {
  const totalTrips = entries.length;
  const totalFish = entries.reduce((sum, entry) => sum + (entry.quantity || 0), 0);
  const successfulTrips = entries.filter(entry => (entry.quantity || 0) > 0).length;
  const successRate = totalTrips > 0 ? Math.round((successfulTrips / totalTrips) * 100) : 0;
  
  return {
    totalTrips,
    totalFish,
    successfulTrips,
    successRate
  };
}

function createLocationPopupContent(firstEntry, entries, stats) {
  const locationName = firstEntry.locationName || 'Unnamed Location';
  const entriesList = entries.slice(0, 3).map(entry => `
    <div style="margin: 0.5rem 0; padding: 0.5rem; border-bottom: 1px solid #eee;">
      <strong>${formatDate(entry.date)}</strong><br>
      ${entry.species ? `Species: ${entry.species}` : ''} ${entry.quantity > 0 ? `- Caught: ${entry.quantity}` : ''}
    </div>
  `).join('');
  
  const moreEntries = entries.length > 3 ? `<p><em>+ ${entries.length - 3} more entries</em></p>` : '';
  
  return `
    <div style="min-width: 200px;">
      <h3 style="margin: 0 0 0.5rem 0;">${locationName}</h3>
      <div style="margin-bottom: 0.5rem;">
        <strong>Statistics:</strong><br>
        Total Trips: ${stats.totalTrips}<br>
        Total Fish: ${stats.totalFish}<br>
        Success Rate: ${stats.successRate}%
      </div>
      <div style="max-height: 200px; overflow-y: auto;">
        ${entriesList}
        ${moreEntries}
      </div>
      <div style="margin-top: 0.5rem;">
        <button onclick="viewLocationDetails('${firstEntry.latitude}', '${firstEntry.longitude}')" 
                style="padding: 0.25rem 0.5rem; margin-right: 0.25rem; cursor: pointer;">
          View All
        </button>
      </div>
    </div>
  `;
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


function updateSpeciesFilterHint() {
  const speciesFilter = document.getElementById('speciesFilter');
  const hint = document.getElementById('speciesFilterHint');
  if (speciesFilter && hint) {
    const selectedCount = speciesFilter.selectedOptions.length;
    if (selectedCount > 0) {
      const selectedNames = Array.from(speciesFilter.selectedOptions).map(opt => opt.textContent).join(', ');
      hint.textContent = `${selectedCount} selected: ${selectedNames}`;
      hint.style.color = 'var(--primary-color)';
      hint.style.fontWeight = '600';
    } else {
      hint.textContent = 'Hold Ctrl/Cmd to select multiple';
      hint.style.color = '#6B7280';
      hint.style.fontWeight = 'normal';
    }
  }
}

function applyFilters() {
  const entries = StorageManager.getEntries();
  const searchTerm = document.getElementById('searchInput').value.toLowerCase();
  const speciesFilter = document.getElementById('speciesFilter');
  const selectedSpecies = Array.from(speciesFilter.selectedOptions).map(opt => opt.value.toLowerCase());
  const dateFilter = document.getElementById('dateFilter').value;

  let filtered = entries.filter(entry => {
    if (searchTerm) {
      const matchesSearch = 
        (entry.locationName || '').toLowerCase().includes(searchTerm) ||
        (entry.species || '').toLowerCase().includes(searchTerm) ||
        (entry.notes || '').toLowerCase().includes(searchTerm);
      if (!matchesSearch) return false;
    }

    if (selectedSpecies.length > 0) {
      const entrySpecies = (entry.species || '').toLowerCase().trim();
      const matchesSpecies = selectedSpecies.some(selected => {
        const normalizedSelected = selected.toLowerCase().trim();
        return entrySpecies === normalizedSelected || 
               entrySpecies.includes(normalizedSelected) || 
               normalizedSelected.includes(entrySpecies);
      });
      if (!matchesSpecies) return false;
    }

    if (dateFilter && entry.date !== dateFilter) {
      return false;
    }

    return true;
  });

  displayFilteredEntries(filtered);
  updateMapMarkers(filtered);
}

function displayFilteredEntries(entries) {
  const container = document.getElementById('history-entries');

  if (entries.length === 0) {
    container.innerHTML = '<p class="empty-message">No fishing entries found matching your filters.</p>';
    return;
  }

  const sortedEntries = [...entries].sort((a, b) => 
    new Date(b.date) - new Date(a.date)
  );

  container.innerHTML = sortedEntries.map(entry => `
    <div class="entry-item">
      <div onclick="editEntry('${entry.id}')" style="flex: 1; cursor: pointer;">
        <h3>${entry.locationName || 'Unnamed Location'}</h3>
        <p><strong>Date:</strong> ${formatDate(entry.date)}</p>
        ${entry.species ? `<p><strong>Species:</strong> ${entry.species}</p>` : ''}
        ${entry.quantity > 0 ? `<p><strong>Caught:</strong> ${entry.quantity}</p>` : ''}
        ${entry.weather ? `
          <div class="weather-info">
            <p><strong>Weather:</strong> ${entry.weather.condition} - 
            ${entry.weather.temperature.high}°C / ${entry.weather.temperature.low}°C</p>
            <p>Wind: ${entry.weather.wind.speed} km/h</p>
          </div>
        ` : ''}
        ${entry.notes ? `<p>${entry.notes}</p>` : ''}
      </div>
      <div style="display: flex; flex-direction: column; gap: 0.5rem;">
        <button class="btn btn-danger btn-small" onclick="event.stopPropagation(); deleteEntry('${entry.id}');">Delete</button>
      </div>
    </div>
  `).join('');
}

function updateMapMarkers(filteredEntries) {
  const allEntries = StorageManager.getEntries();
  const filteredKeys = new Set(
    filteredEntries.map(e => `${e.latitude},${e.longitude}`)
  );

  markerMap.forEach(({ marker }, key) => {
    if (!filteredKeys.has(key)) {
      marker.setOpacity(0.3);
    } else {
      marker.setOpacity(1);
    }
  });
}

function loadHistoryView() {
  const entries = StorageManager.getEntries();
  displayFilteredEntries(entries);
  updateMapMarkers(entries);
}

function loadStatsView() {
  const entries = StorageManager.getEntries();
  
  const totalTrips = entries.length;
  const totalFish = entries.reduce((sum, entry) => sum + (entry.quantity || 0), 0);
  const successfulTrips = entries.filter(entry => (entry.quantity || 0) > 0).length;
  const successRate = totalTrips > 0 ? Math.round((successfulTrips / totalTrips) * 100) : 0;
  
  const locationStats = {};
  entries.forEach(entry => {
    const key = `${entry.latitude},${entry.longitude}`;
    if (!locationStats[key]) {
      locationStats[key] = {
        name: entry.locationName || 'Unnamed',
        trips: 0,
        fish: 0,
        entries: []
      };
    }
    locationStats[key].trips++;
    locationStats[key].fish += entry.quantity || 0;
    locationStats[key].entries.push(entry);
  });

  const locationArray = Object.values(locationStats);
  const mostFished = locationArray.sort((a, b) => b.trips - a.trips)[0];
  const mostSuccessful = locationArray
    .filter(loc => loc.trips > 0)
    .map(loc => ({
      ...loc,
      successRate: loc.entries.filter(e => (e.quantity || 0) > 0).length / loc.trips * 100
    }))
    .sort((a, b) => b.successRate - a.successRate)[0];

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
    mostFished ? mostFished.name : '-';
  document.getElementById('favorite-species').textContent = 
    favoriteSpecies ? favoriteSpecies[0] : '-';
}

function handleExport() {
  try {
    StorageManager.exportEntries();
    showMessage('Data exported successfully!', 'success');
  } catch (error) {
    console.error('Export error:', error);
    showMessage('Error exporting data', 'error');
  }
}

async function handleImport(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    await StorageManager.importEntries(file);
    showMessage('Data imported successfully!', 'success');
    loadEntries();
    loadHistoryView();
    loadStatsView();
  } catch (error) {
    console.error('Import error:', error);
    showMessage('Error importing data. Please check the file format.', 'error');
  }
  
  event.target.value = '';
}

function showMessage(text, type) {
  const existing = document.querySelector('.message');
  if (existing) {
    existing.remove();
  }

  const message = document.createElement('div');
  message.className = `message message-${type}`;
  message.textContent = text;
  
  const main = document.querySelector('main');
  if (main) {
    main.insertBefore(message, main.firstChild);
    
    setTimeout(() => {
      message.remove();
    }, 3000);
  }
}

window.editEntry = function(entryId) {
  const entries = StorageManager.getEntries();
  const entry = entries.find(e => e.id === entryId);
  if (entry) {
    openLocationModal(entry.latitude, entry.longitude, entry);
  }
};

window.deleteEntry = function(entryId) {
  if (!confirm('Are you sure you want to delete this entry? This action cannot be undone.')) {
    return;
  }

  StorageManager.deleteEntry(entryId);
  loadEntries();
  
  const activeView = document.querySelector('.view.active');
  if (activeView) {
    if (activeView.id === 'history-view') {
      loadHistoryView();
    } else if (activeView.id === 'stats-view') {
      loadStatsView();
    }
  }
  
  showMessage('Entry deleted successfully', 'success');
};

window.viewEntry = function(entryId) {
  const entries = StorageManager.getEntries();
  const entry = entries.find(e => e.id === entryId);
  if (entry) {
    mapManager.centerMap(entry.latitude, entry.longitude);
    showPage('map');
  }
};

window.viewLocationDetails = function(lat, lng) {
  const entries = StorageManager.getEntriesByLocation(parseFloat(lat), parseFloat(lng));
  if (entries.length === 0) return;

  const locationName = entries[0].locationName || 'Unnamed Location';
  const stats = calculateLocationStats(entries);

  const detailsHTML = `
    <div class="location-details">
      <h2>${locationName}</h2>
      <div class="location-stats">
        <p><strong>Total Trips:</strong> ${stats.totalTrips}</p>
        <p><strong>Total Fish Caught:</strong> ${stats.totalFish}</p>
        <p><strong>Success Rate:</strong> ${stats.successRate}%</p>
      </div>
      <h3>All Entries</h3>
      <div class="entries-list">
        ${entries.sort((a, b) => new Date(b.date) - new Date(a.date)).map(entry => `
          <div class="entry-item">
            <div style="flex: 1;">
              <p><strong>Date:</strong> ${formatDate(entry.date)}</p>
              ${entry.species ? `<p><strong>Species:</strong> ${entry.species}</p>` : ''}
              ${entry.quantity > 0 ? `<p><strong>Caught:</strong> ${entry.quantity}</p>` : ''}
              ${entry.weather ? `
                <div class="weather-info">
                  <p><strong>Weather:</strong> ${entry.weather.condition}</p>
                  <p>Temperature: ${entry.weather.temperature.high}°C / ${entry.weather.temperature.low}°C</p>
                  <p>Wind: ${entry.weather.wind.speed} km/h</p>
                  ${entry.weather.precipitation > 0 ? `<p>Precipitation: ${entry.weather.precipitation} mm</p>` : ''}
                </div>
              ` : ''}
              ${entry.notes ? `<p>${entry.notes}</p>` : ''}
            </div>
            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
              <button class="btn btn-primary btn-small" onclick="editEntry('${entry.id}'); closeLocationDetails();">Edit</button>
              <button class="btn btn-danger btn-small" onclick="deleteEntry('${entry.id}'); closeLocationDetails();">Delete</button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  const detailsModal = document.getElementById('locationDetailsModal');
  if (detailsModal) {
    document.getElementById('locationDetailsContent').innerHTML = detailsHTML;
    detailsModal.classList.add('active');
  }
};

window.closeLocationDetails = function() {
  const modal = document.getElementById('locationDetailsModal');
  if (modal) {
    modal.classList.remove('active');
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
