import { getLocalStorage, setLocalStorage } from './utils.mjs';

const STORAGE_KEY = 'fishing-log-entries';

class StorageManager {
  static getEntries() {
    const entries = getLocalStorage(STORAGE_KEY);
    return entries || [];
  }

  static saveEntry(entry) {
    const entries = this.getEntries();
    entries.push(entry);
    return setLocalStorage(STORAGE_KEY, entries);
  }

  static updateEntry(entryId, updatedEntry) {
    const entries = this.getEntries();
    const index = entries.findIndex(entry => entry.id === entryId);
    
    if (index !== -1) {
      entries[index] = { ...entries[index], ...updatedEntry };
      return setLocalStorage(STORAGE_KEY, entries);
    }
    return false;
  }

  static deleteEntry(entryId) {
    const entries = this.getEntries();
    const filtered = entries.filter(entry => entry.id !== entryId);
    return setLocalStorage(STORAGE_KEY, filtered);
  }

  static getEntriesByLocation(latitude, longitude) {
    const entries = this.getEntries();
    return entries.filter(entry => 
      entry.latitude === latitude && entry.longitude === longitude
    );
  }

  static exportEntries() {
    const entries = this.getEntries();
    const dataStr = JSON.stringify(entries, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fishing-log-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  static async importEntries(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target.result);
          if (Array.isArray(imported)) {
            setLocalStorage(STORAGE_KEY, imported);
            resolve(imported);
          } else {
            reject(new Error('Invalid file format'));
          }
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Error reading file'));
      reader.readAsText(file);
    });
  }
}

export default StorageManager;

