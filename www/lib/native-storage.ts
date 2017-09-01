/* Cordova native storage plugin promise wrapper */

declare namespace NativeStorage {
    export function clear(
        success: () => void,
        err: (err: NativeStorageError) => void
    );

    export function getItem<T = number | boolean | object>(
        id: string, 
        success: (val: T) => void, 
        err: (err: NativeStorageError) => void
    );

    export function remove(
        id: string,
        success: () => void,
        err: (err: NativeStorageError) => void
    );

    export function setItem<T = number | boolean | object>(
        id: string, 
        item: T, 
        success: () => void, 
        err: (err: NativeStorageError) => void
    );
}

export interface NativeStorageError extends Error {
    code: NativeStorageErrorType
}

export enum NativeStorageErrorType {
    NATIVE_WRITE_FAILED = 1,
    ITEM_NOT_FOUND = 2,
    NULL_REFERENCE = 3,
    UNDEFINED_TYPE = 4,
    JSON_ERROR = 5,
    WRONG_PARAMETER = 6,
}

/**
 * Retreives an item from the native storage.
 * 
 * @param key the key of the item to retreive.
 */
export function get<T = number | boolean | object>(key: string): Promise<T | null> {
    return new Promise((res, rej) => NativeStorage.getItem(key, res, err => {
        if (err.code == NativeStorageErrorType.ITEM_NOT_FOUND) {
            return res(null);
        } else {
            return rej(err);
        }
    }));
}

/**
 * Removes an item from the native storage.
 * 
 * @param key the key of the item to remove.
 */
export function remove(key: string): Promise<void> {
    return new Promise((res, rej) => NativeStorage.remove(key, res, rej));
}

/**
 * Sets an item in the native storage.
 * 
 * @param key the key of the item to set.
 * @param val the value to set.
 */
export function set<T = number | boolean | object>(key: string, val: T): Promise<T> {
    return new Promise((res, rej) => NativeStorage.setItem(key, val, res, rej));
}