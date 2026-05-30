const getApiBaseUrl = () => {
  if (typeof window !== 'undefined') {
  const hostname = window.location.hostname;
  if (hostname === 'testing.albionroads.live') {
      return 'https://api-testing.albionroads.live';
    }
  }

  return import.meta.env.VITE_API_URL || 'http://localhost:3001';
};

export const API_BASE_URL = getApiBaseUrl();
