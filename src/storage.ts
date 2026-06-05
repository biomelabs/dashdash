import type { RunMeta, Sample } from './types';

const DB_NAME = 'openstride-monitor';
const DB_VERSION = 1;
const META_STORE = 'meta';
const SAMPLE_STORE = 'samples';
const RUN_KEY = 'current-run';

let dbPromise: Promise<IDBDatabase> | null = null;

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
    });
}

function openDb(): Promise<IDBDatabase> {
    if (!('indexedDB' in window)) {
        return Promise.reject(new Error('IndexedDB is not available'));
    }

    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(META_STORE)) {
                db.createObjectStore(META_STORE, { keyPath: 'key' });
            }
            if (!db.objectStoreNames.contains(SAMPLE_STORE)) {
                const store = db.createObjectStore(SAMPLE_STORE, { keyPath: 'seq' });
                store.createIndex('tSec', 'tSec');
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });

    return dbPromise;
}

interface StoredMeta extends RunMeta {
    key: string;
}

export async function loadRun(): Promise<{ meta: RunMeta | null; samples: Sample[] }> {
    try {
        const db = await openDb();
        const tx = db.transaction([META_STORE, SAMPLE_STORE], 'readonly');
        const metaStore = tx.objectStore(META_STORE);
        const sampleStore = tx.objectStore(SAMPLE_STORE);
        const metaRequest = metaStore.get(RUN_KEY);
        const sampleRequest = sampleStore.getAll();

        const [metaRow, samples] = await Promise.all([
            requestToPromise<StoredMeta | undefined>(metaRequest),
            requestToPromise<Sample[]>(sampleRequest),
        ]);
        await transactionDone(tx);

        const meta = metaRow
            ? { startedAtMs: metaRow.startedAtMs, updatedAtMs: metaRow.updatedAtMs, nextSeq: metaRow.nextSeq }
            : null;

        return {
            meta,
            samples: samples.sort((a, b) => a.seq - b.seq),
        };
    } catch (error) {
        console.warn('Unable to load persisted run', error);
        return { meta: null, samples: [] };
    }
}

export async function saveSamples(samples: Sample[], meta: RunMeta | null): Promise<void> {
    if (!samples.length && !meta) return;

    try {
        const db = await openDb();
        const tx = db.transaction([META_STORE, SAMPLE_STORE], 'readwrite');
        const metaStore = tx.objectStore(META_STORE);
        const sampleStore = tx.objectStore(SAMPLE_STORE);

        if (meta) {
            metaStore.put({ ...meta, key: RUN_KEY });
        }
        for (const sample of samples) {
            sampleStore.put(sample);
        }

        await transactionDone(tx);
    } catch (error) {
        console.warn('Unable to persist run samples', error);
    }
}

export async function clearPersistedRun(): Promise<void> {
    try {
        const db = await openDb();
        const tx = db.transaction([META_STORE, SAMPLE_STORE], 'readwrite');
        tx.objectStore(META_STORE).delete(RUN_KEY);
        tx.objectStore(SAMPLE_STORE).clear();
        await transactionDone(tx);
    } catch (error) {
        console.warn('Unable to clear persisted run', error);
    }
}
