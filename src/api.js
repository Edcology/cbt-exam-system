const API_BASE = '/api';

export async function apiRequest(endpoint, method = 'GET', body = null, token = null) {
  const headers = {};
  
  if (!(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    method,
    headers,
  };

  if (body) {
    config.body = body instanceof FormData ? body : JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, config);
  const text = await response.text();
  
  let data;
  try {
    data = JSON.parse(text);
  } catch (err) {
    if (!response.ok) {
      throw new Error(`Server returned HTML error (${response.status}). Render deployment may still be updating. Please wait 30 seconds.`);
    }
    throw new Error('Unexpected non-JSON response from server.');
  }

  if (!response.ok) {
    throw new Error(data.error || 'An error occurred during request');
  }

  return data;
}
