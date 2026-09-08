export function request({ baseUrl, token }, method, path, body, signal) {
    const timeout = AbortSignal.timeout(65_000);
    return fetch(`${baseUrl}${path}`, {
        method,
        headers: { authorization: `Bearer ${token}`, ...(body ? { 'content-type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
}

export async function checked(response) {
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${(await response.text()).slice(0, 2000)}`);
    return response.status === 204 ? null : response.json();
}
