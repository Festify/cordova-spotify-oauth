import exec from './lib/exec-promise';

/**
 * The authorization data.
 */
export interface AuthorizationData {
    accessToken: string;
    encryptedRefreshToken: string;
    expiresIn: number;
}

/**
 * Method parameters for `authorize`.
 */
export interface Config {
    clientId: string;
    redirectUri: string;
    scopes: string[];
    tokenExchangeUrl: string;
    tokenRefreshUrl: string;
}

export default function authorize(config: Config) {
    
}