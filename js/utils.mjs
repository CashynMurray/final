export function getLocalStorage(key) {
  const item = localStorage.getItem(key);
  try {
    return item ? JSON.parse(item) : null;
  } catch (e) {
    console.error(`Error parsing localStorage key "${key}":`, e);
    return null;
  }
}

export function setLocalStorage(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (e) {
    console.error(`Error setting localStorage key "${key}":`, e);
    return false;
  }
}

export function removeLocalStorage(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (e) {
    console.error(`Error removing localStorage key "${key}":`, e);
    return false;
  }
}

export function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}



