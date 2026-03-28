const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

function formatErrorMessage(payload) {
  if (typeof payload === "string") {
    return payload;
  }

  if (Array.isArray(payload)) {
    return payload
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }
        if (item && typeof item === "object" && "msg" in item) {
          return String(item.msg);
        }
        return JSON.stringify(item);
      })
      .join(", ");
  }

  if (payload && typeof payload === "object") {
    if ("detail" in payload) {
      return formatErrorMessage(payload.detail);
    }
    if ("message" in payload) {
      return String(payload.message);
    }
    return JSON.stringify(payload);
  }

  return "Request failed.";
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(options.headers || {}),
    },
  });

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    throw new Error(formatErrorMessage(payload));
  }

  return payload;
}

export const api = {
  get(path) {
    return request(path);
  },
  post(path, body, options = {}) {
    return request(path, {
      method: "POST",
      body: body instanceof FormData ? body : JSON.stringify(body),
      ...options,
    });
  },
  patch(path, body) {
    return request(path, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },
  put(path, body) {
    return request(path, {
      method: "PUT",
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
  },
  delete(path) {
    return request(path, {
      method: "DELETE",
    });
  },
  async download(path) {
    const response = await fetch(`${API_BASE_URL}${path}`);
    if (!response.ok) {
      throw new Error("Download failed.");
    }
    return response.blob();
  },
};
