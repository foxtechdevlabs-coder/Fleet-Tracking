const apiOrigin = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");
const apiRoot = `${apiOrigin}/api/v1`;
const requestTimeoutMs = 15000;

export class ApiError extends Error {
  constructor(message, status = 0, code = "") {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

function getErrorMessage(status, serverMessage) {
  switch (status) {
    case 400:
      return serverMessage || "Check your email and password and try again.";
    case 401:
      return "Email or password is incorrect.";
    case 403:
      return "Your account is not permitted to access FleetTrack.";
    case 404:
      return "The authentication service could not be found. Please contact support.";
    case 405:
      return "The authentication service rejected this request. Please contact support.";
    case 500:
      return "The authentication service encountered an error. Please try again later.";
    default:
      if (status >= 500) {
        return "The authentication service is temporarily unavailable. Please try again later.";
      }
      if (status === 429) {
        return "Too many attempts. Please wait a moment and try again.";
      }
      return serverMessage || "Unable to complete the request. Please try again.";
  }
}

async function request(path, options = {}) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    const response = await fetch(`${apiRoot}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...options.headers
      }
    });

    let body = null;
    if (response.status !== 204) {
      const responseText = await response.text();
      if (responseText) {
        try {
          body = JSON.parse(responseText);
        } catch {
          body = null;
        }
      }
    }

    if (!response.ok) {
      throw new ApiError(
        getErrorMessage(response.status, body?.message),
        response.status,
        body?.code || ""
      );
    }

    return body;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError("The authentication service took too long to respond. Please try again.");
    }
    if (error instanceof TypeError) {
      throw new ApiError("Unable to connect to the authentication service. Please try again later.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function signIn(email, password) {
  const response = await request("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  const data = response?.data;
  if (
    typeof data?.accessToken !== "string" ||
    !data.accessToken ||
    typeof data.tokenType !== "string" ||
    data.tokenType.toLowerCase() !== "bearer" ||
    !Number.isFinite(data.expiresIn) ||
    data.expiresIn <= 0 ||
    typeof data.admin?.email !== "string" ||
    !data.admin.email ||
    typeof data.admin?.name !== "string" ||
    !data.admin.name.trim() ||
    typeof data.admin?.role !== "string" ||
    !data.admin.role
  ) {
    throw new ApiError("The authentication service returned an invalid response. Please try again.");
  }

  return {
    accessToken: data.accessToken,
    tokenType: "Bearer",
    expiresAt: Date.now() + data.expiresIn * 1000,
    admin: {
      email: data.admin.email,
      name: data.admin.name,
      role: data.admin.role
    }
  };
}

export function revokeSession(session) {
  return request("/auth/logout", {
    method: "POST",
    headers: { Authorization: `${session.tokenType} ${session.accessToken}` }
  });
}
