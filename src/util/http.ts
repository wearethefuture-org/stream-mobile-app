import axios from 'axios';

const SERVER_SECRET = 'StaticSecret';

const createSession = async (serverAddress: string, customSessionId: string) => {
  const data = JSON.stringify({ customSessionId });
  const headers = {
    Authorization: `Basic ${btoa(`OPENVIDUAPP:${SERVER_SECRET}`)}`,
    'Content-Type': 'application/json'
  };

  try {
    const response = await axios.post('/api/sessions', data, {
      baseURL: serverAddress,
      headers,
      responseType: 'json'
    });

    return response.data['id'];
  } catch (e) {
    console.log(e);
    if (e.response.status === 409) return customSessionId;
    console.warn(`No connection to the server: ${serverAddress}`);
    throw e;
  }
}

export const getToken = async (serverAddress: string, sessionName: string) => {
  const session = await createSession(serverAddress, sessionName);

  const data = JSON.stringify({ session });
  const headers = {
    Authorization: `Basic ${btoa(`OPENVIDUAPP:${SERVER_SECRET}`)}`,
    'Content-Type': 'application/json'
  };

  const response = await axios.post('/api/tokens', data, {
    baseURL: serverAddress,
    headers,
    responseType: 'json'
  });

  return response.data['token'];
}
