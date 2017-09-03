import 'whatwg-fetch';

import config from './lib/config';
import exec from './lib/exec-promise';

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

    const lsData = localStorage.getItem(config.LOCAL_STORAGE_KEY);

    if (lsData) {
        const authData = JSON.parse(lsData) as AuthorizationData;

        const expiry = Date.now() + 60 * 5 * 1000; // 5min margin
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
 */
function saveAndHandleErrors(pr: Promise<AuthorizationData>, errorName: string): Promise<AuthorizationData> {
    return pr
        .then(data => {
            localStorage.setItem(config.LOCAL_STORAGE_KEY, JSON.stringify(data));
            return data;
        })
        .catch(err => {
            const e = new Error(err.message);
            e.name = errorName;
            return Promise.reject(e);
        });
}