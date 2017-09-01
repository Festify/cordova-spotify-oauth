import 'whatwg-fetch';

import config from './lib/config';
import exec from './lib/exec-promise';
import * as Storage from './lib/native-storage';

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

    return Storage.get<AuthorizationData>(config.NATIVE_STORAGE_KEY) 
        .catch(() => null) // Ignore errors
        .then(data => {
            if (data) {
                const expiry = Date.now() + 60 * 5 * 1000;
                if (data.expiresAt > expiry) {
                    return Promise.resolve(data);
                } else {
                    const refreshPromise = refresh(cfg, data);
                    refreshPromise
                        .then(data => Storage.set(config.NATIVE_STORAGE_KEY, data))
                        .catch(err => console.error("Failed to store Spotify OAuth data", err));
                    return refreshPromise;
                }
            } else {
                const oauthPromise = oauth(cfg);
                oauthPromise
                    .then(data => Storage.set(config.NATIVE_STORAGE_KEY, data))
                    .catch(err => console.error("Failed to store Spotify OAuth data", err));
                return oauthPromise;
            }
        });
}

/**
 * Removes all stored data so that `authorize` must perform the full
 * oauth dance again.
 */
export function forget() {
    return Storage.remove(config.NATIVE_STORAGE_KEY);
}

function oauth(cfg: Config): Promise<AuthorizationData> {
    return exec("authorize", [
        cfg.clientId,
        cfg.redirectUrl,
        cfg.tokenExchangeUrl,
        cfg.scopes
    ]) as Promise<AuthorizationData>;
}

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