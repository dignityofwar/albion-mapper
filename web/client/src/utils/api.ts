const getApiBaseUrl = () => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (
      hostname !== 'roadmap.dignityofwar.com' &&
      hostname !== 'localhost' &&
      hostname !== '127.0.0.1'
    ) {
      return 'https://roadmap-api-test.dignityofwar.com';
    }
  }
  return import.meta.env.VITE_API_URL || 'http://localhost:3001';
};

export const API_BASE_URL = getApiBaseUrl();
