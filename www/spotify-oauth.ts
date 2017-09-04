import 'whatwg-fetch';
import exec from './lib/exec-promise';

/**
 * The local storage key where the auth data is cached.
 * 
 * The data is stored as stringified JSON object.
 */
export const LOCAL_STORAGE_KEY = "SpotifyOAuthData";

/**
 * The authorization data.
 */
export interface AuthorizationData {
    /** A valid access token. */
    accessToken: string;

    /** The encrypted refresh token. */
    encryptedRefreshToken: string;

    /** The date (from UTC, in milliseconds) when the given access token expires. */
    expiresAt: number;
}

/**
 * OAuth configuration data.
 */
export interface Config {
    /** The client ID as per the Spotify dev console. */
    clientId: string;

    /** The redirect URI as entered in the Spotify dev console. */
    redirectUrl: string;

    /** 
     * Safety margin time (in milliseconds) for the token refresh. 
     * 
     * The plugin applies a safety margin to the token lifetime in order
     * to give the token user enough time to perform all operations needed.
     * 
     * Otherwise the plugin might hand out a token that is already expired
     * before it could ever be used.
     * 
     * The safety margin defaults to 30s.
     */
    refreshSafetyMargin?: number;

    /** Requested OAuth scopes. */
    scopes: string[];

    /** The token exchange URL. */
    tokenExchangeUrl: string;

    /** The token refresh URL. */
    tokenRefreshUrl: string;
}

/**
 * Obtains valid authorization data.
 * 
 * This method performs the necessary steps in order to obtain a valid
 * access token. It performs the OAuth dance prompting the user to log in,
 * exchanges the obtained authorization code for an access and a refresh
 * token, caches those, and returns both to the developer.
 * 
 * When it is invoked again, it will first check whether the cached access
 * token is still valid (including a configurable safety margin), and return it
 * directly if that is the case. Otherwise, the method will transparently
 * refresh the token and return that.
 * 
 * Bottom line - always call this if you need a valid access token in your code.
 * 
 * @param cfg OAuth configuration
 */
export function authorize(cfg: Config): Promise<AuthorizationData> {
    if (!cfg.clientId) {
        throw new Error("missing clientId");
    }
    if (!cfg.redirectUrl) {
        throw new Error("missing redirectUri");
    }
    if (!Array.isArray(cfg.scopes)) {
        throw new Error("missing scopes");
    }
    if (!cfg.tokenExchangeUrl) {
        throw new Error("missing tokenExchangeUrl");
    }
    if (!cfg.tokenRefreshUrl) {
        throw new Error("missing tokenRefreshUrl");
    }
    if ((cfg.refreshSafetyMargin || 0) < 0) {
        throw new Error("safety margin < 0");
    }

    const lsData = localStorage.getItem(LOCAL_STORAGE_KEY);

    if (lsData) {
        const authData = JSON.parse(lsData) as AuthorizationData;

        const margin = (cfg.refreshSafetyMargin != undefined) 
            ? cfg.refreshSafetyMargin
            : 30000;
        const expiry = Date.now() + margin;
        if (authData.expiresAt > expiry) {
            return Promise.resolve(authData);
        } else {
            return saveAndHandleErrors(refresh(cfg, authData), "refresh_failed");
        }
    } else {
        return saveAndHandleErrors(oauth(cfg), "auth_failed");
    }
}

/**
 * Removes all cached data so that `authorize` performs the full
 * oauth dance again.
 * 
 * This is akin to a "logout".
 */
export function forget() {
    return localStorage.removeItem(LOCAL_STORAGE_KEY);
}

/**
 * Performs the OAuth dance.
 * 
 * @param cfg OAuth2 config
 * @hidden
 */
function oauth(cfg: Config): Promise<AuthorizationData> {
    return exec("getCode", [
        cfg.clientId,
        cfg.redirectUrl,
        cfg.scopes
    ])
        .then(({ code }) => fetch(cfg.tokenExchangeUrl, {
            method: 'post',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: 'code=' + code
        }))
        .then(handleHttpErrors)
        .then(resp => resp.json())
        .then(({ access_token, expires_in, refresh_token }) => ({
            accessToken: access_token,
            encryptedRefreshToken: refresh_token,
            expiresAt: expires_in * 1000 + Date.now()
        }));
}

/**
 * Refreshes the given access token.
 * 
 * @param cfg OAuth2 config
 * @param data The auth data to refresh
 * @hidden
 */
function refresh(cfg: Config, data: AuthorizationData): Promise<AuthorizationData> {
    return fetch(cfg.tokenRefreshUrl, {
        method: 'post',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'refresh_token=' + data.encryptedRefreshToken
    })
        .then(handleHttpErrors)
        .then(resp => resp.json())  
        .then(({ access_token, expires_in }) => ({
            accessToken: access_token,
            encryptedRefreshToken: data.encryptedRefreshToken,
            expiresAt: expires_in * 1000 + Date.now()
        }))
}

/**
 * Handles HTTP erros gracefully and returns the response
 * if everything is okay.
 * 
 * @param resp the HTTP response to handle
 * @hidden
 */
function handleHttpErrors(resp: Response): Promise<Response> {
    return resp.ok ?
        Promise.resolve(resp) :
        Promise.reject(Promise.reject(new Error("got invalid HTTP status code " + resp.status)));
}

/**
 * Saves the given Authorization data to the local storage and
 * appropriately handles errors.
 * 
 * @param pr the Promise with the AuthorizationData
 * @param errorName the error name to assign in case of failure
 * @hidden
 */
function saveAndHandleErrors(pr: Promise<AuthorizationData>, errorName: string): Promise<AuthorizationData> {
    return pr
        .then(data => {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
            return data;
        })
        .catch(err => {
            const e = new Error(err.message);
            e.name = errorName;
            return Promise.reject(e);
        });
}