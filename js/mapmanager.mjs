class MapManager {
  constructor(mapContainerId) {
    this.map = null;
    this.markers = [];
    this.mapContainerId = mapContainerId;
    this.onMapClickCallback = null;
  }

  init(defaultLat = 40.7128, defaultLng = -74.0060) {
    this.map = L.map(this.mapContainerId).setView([defaultLat, defaultLng], 10);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(this.map);

    this.map.on('click', (e) => {
      if (this.onMapClickCallback) {
        this.onMapClickCallback(e.latlng.lat, e.latlng.lng);
      }
    });

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          this.map.setView([latitude, longitude], 13);
        },
        (error) => {
          console.log('Geolocation error:', error);
        }
      );
    }

    return this.map;
  }

  addMarker(lat, lng, popupContent = '') {
    const marker = L.marker([lat, lng]).addTo(this.map);
    
    if (popupContent) {
      marker.bindPopup(popupContent);
    }

    this.markers.push(marker);
    return marker;
  }

  removeMarker(marker) {
    if (marker) {
      this.map.removeLayer(marker);
      this.markers = this.markers.filter(m => m !== marker);
    }
  }

  clearMarkers() {
    this.markers.forEach(marker => {
      this.map.removeLayer(marker);
    });
    this.markers = [];
  }

  onMapClick(callback) {
    this.onMapClickCallback = callback;
  }

  centerMap(lat, lng, zoom = 13) {
    if (this.map) {
      this.map.setView([lat, lng], zoom);
    }
  }

  getMap() {
    return this.map;
  }
}

export default MapManager;

