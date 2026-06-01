import PocketBase, { ClientResponseError } from "pocketbase";

const pocketBaseUrl =
  process.env.NEXT_PUBLIC_POCKETBASE_URL ?? "http://127.0.0.1:8090";

let browserClient: PocketBase | undefined;
let browserAuthRefresh: Promise<string> | undefined;

export class PocketBaseAuthError extends Error {
  constructor(message = "An authenticated PocketBase user is required.") {
    super(message);
    this.name = "PocketBaseAuthError";
  }
}

function getRequestPath(url: string) {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

function configurePocketBase(client: PocketBase) {
  const isDevelopment = process.env.NODE_ENV !== "production";
  client.autoCancellation(false);
  client.beforeSend = (url, options) => {
    if (isDevelopment) {
      console.debug("[PocketBase] request", {
        method: options.method ?? "GET",
        path: getRequestPath(url),
      });
    }
    return { url, options };
  };
  client.afterSend = (response, data, options?) => {
    const details = {
      method: (options as { method?: string } | undefined)?.method ?? "GET",
      path: getRequestPath(response.url),
      status: response.status,
    };

    if (response.ok && isDevelopment) {
      console.debug("[PocketBase] response", details);
    } else if (!response.ok) {
      console.error("[PocketBase] rejected response", details, data);
    }

    return data;
  };
  return client;
}

export function getPocketBase() {
  if (typeof window === "undefined") {
    return configurePocketBase(new PocketBase(pocketBaseUrl));
  }

  if (!browserClient) {
    browserClient = configurePocketBase(new PocketBase(pocketBaseUrl));
  }

  return browserClient;
}

export function createServerPocketBase() {
  return configurePocketBase(new PocketBase(pocketBaseUrl));
}

export function getPocketBaseUrl() {
  return pocketBaseUrl.replace(/\/$/, "");
}

export function logPocketBaseError(operation: string, error: unknown) {
  if (error instanceof ClientResponseError) {
    console.error(`[PocketBase] ${operation} failed`, {
      path: getRequestPath(error.url),
      status: error.status,
      message: error.message,
      response: error.response,
    });
    return;
  }

  console.error(`[PocketBase] ${operation} failed`, error);
}

export async function runPocketBaseRequest<T>(
  operation: string,
  request: () => Promise<T>,
) {
  try {
    const result = await request();
    if (process.env.NODE_ENV !== "production") {
      console.debug(`[PocketBase] ${operation} completed`);
    }
    return result;
  } catch (error) {
    logPocketBaseError(operation, error);
    throw error;
  }
}

export function isPocketBaseNotFound(error: unknown) {
  return error instanceof ClientResponseError && error.status === 404;
}

export function getAuthenticatedUserId(client = getPocketBase()) {
  // `record` is the current SDK API. `model` is retained only as a
  // compatibility fallback for auth state serialized by older SDK versions.
  const authRecord = client.authStore.record ?? client.authStore.model;

  if (
    !client.authStore.isValid ||
    !authRecord?.id ||
    (authRecord.collectionName && authRecord.collectionName !== "users")
  ) {
    return null;
  }

  return authRecord.id;
}

export function requireAuthenticatedUserId(client = getPocketBase()) {
  const userId = getAuthenticatedUserId(client);

  if (!userId) {
    const error = new PocketBaseAuthError();
    logPocketBaseError("Resolve authenticated user", error);
    throw error;
  }

  return userId;
}

export function withAuthenticatedUser<T extends Record<string, unknown>>(
  client: PocketBase,
  data: T,
) {
  return {
    ...data,
    user: requireAuthenticatedUserId(client),
  };
}

export function appendAuthenticatedUser(client: PocketBase, data: FormData) {
  data.set("user", requireAuthenticatedUserId(client));
  return data;
}

export async function hydratePocketBaseAuth(client = getPocketBase()) {
  const userId = getAuthenticatedUserId(client);

  if (!userId) {
    throw new PocketBaseAuthError();
  }

  if (!browserAuthRefresh) {
    browserAuthRefresh = runPocketBaseRequest("Refresh authenticated user", () =>
      client.collection("users").authRefresh(),
    )
      .then(() => requireAuthenticatedUserId(client))
      .catch((error) => {
        client.authStore.clear();
        throw error;
      })
      .finally(() => {
        browserAuthRefresh = undefined;
      });
  }

  return browserAuthRefresh;
}
