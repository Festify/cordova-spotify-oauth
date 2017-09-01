import 'whatwg-fetch';

import config from './lib/config';
import exec from './lib/exec-promise';

/**
 * The authorization data as returned from the native clients.
 */
interface NativeAuthorizationData {
    access_token: string;
    encrypted_refresh_token: string;
    expires_in: number;
}

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
 * Method parameters for `authorize`.
 */
export interface Config {
    /** The client ID as per the Spotify dev console. */
    clientId: string;

    /** The redirect URI as entered in the Spotify dev console. */
    redirectUrl: string;

    /** Requested OAuth scopes. */
    scopes: string[];

    /** The token exchange URL. */
    tokenExchangeUrl: string;

    /** The token refresh URL. */
    tokenRefreshUrl: string;
}

/**
 * Obtains a fresh access token.
 * 
 * The method either returns a cached one, if it is still valid (+ 5min margin),
 * gets a new one through the refresh token, or performs the full OAuth dance, depending
 * on which data is currently stored.
 * 
 * @param cfg OAuth config
 */
export function authorize(cfg: Config) {
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

    const lsData = localStorage.getItem(config.LOCAL_STORAGE_KEY);

    if (lsData) {
        const authData = JSON.parse(lsData) as AuthorizationData;

        const expiry = Date.now() + 60 * 5 * 1000; // 5min margin
        if (authData.expiresAt > expiry) {
            return Promise.resolve(authData);
        } else {
            return refresh(cfg, authData)
                .then(data => {
                    localStorage.setItem(config.LOCAL_STORAGE_KEY, JSON.stringify(data));
                    return data;
                });
        }
    } else {
        return oauth(cfg)
            .then(nativeAuthData => ({
                accessToken: nativeAuthData.access_token,
                encryptedRefreshToken: nativeAuthData.encrypted_refresh_token,
                expiresAt: Date.now() + nativeAuthData.expires_in
            }))
            .then(data => {
                localStorage.setItem(config.LOCAL_STORAGE_KEY, JSON.stringify(data));
                return data;
            });
    }
}

/**
 * Removes all stored data so that `authorize` must perform the full
 * oauth dance again.
 */
export function forget() {
    return localStorage.removeItem(config.LOCAL_STORAGE_KEY);
}

/**
 * Performs the OAuth dance.
 * 
 * @param cfg OAuth2 config
 */
function oauth(cfg: Config): Promise<NativeAuthorizationData> {
    return exec("authorize", [
        cfg.clientId,
        cfg.redirectUrl,
        cfg.tokenExchangeUrl,
        cfg.scopes
    ]) as Promise<NativeAuthorizationData>;
}

/**
 * Refreshes the given access token.
 * 
 * @param cfg OAuth2 config
 * @param data The auth data to refresh
 */
function refresh(cfg: Config, data: AuthorizationData): Promise<AuthorizationData> {
    return fetch(cfg.tokenRefreshUrl, {
        method: 'post',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'refresh_token=' + data.encryptedRefreshToken
    })
        .then(resp => {
            if (!resp.ok) {
                return Promise.reject(new Error("got invalid HTTP status code " + resp.status));
            } else {
                return Promise.resolve(resp);
            }
        })
        .then(resp => resp.json())  
        .then(({ access_token, expires_in }) => ({
            accessToken: access_token,
            encryptedRefreshToken: data.encryptedRefreshToken,
            expiresAt: Date.now() + expires_in
        }) as AuthorizationData)
}