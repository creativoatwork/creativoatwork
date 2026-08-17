import {
  collection, doc, addDoc, setDoc, deleteDoc, getDoc, onSnapshot, query, orderBy,
  serverTimestamp, Timestamp, type DocumentData, type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTION } from '../config';
import { normalize, type Enrichment, type Project, type ProjectFields } from './types';

/**
 * The only module in the admin app that imports firebase/firestore. Pages and components go
 * through these functions, so the storage layer stays swappable and the SDK surface stays in
 * one file.
 */

const col = () => collection(db, COLLECTION);

function toProject(snap: QueryDocumentSnapshot<DocumentData>): Project {
  const d = snap.data();
  const asDate = (v: unknown) => (v instanceof Timestamp ? v.toDate() : null);
  return {
    id: snap.id,
    name: d.name ?? '',
    description: d.description ?? '',
    repoUrl: d.repoUrl ?? '',
    domain: d.domain ?? '',
    host: d.host ?? 'unknown',
    frontend: d.frontend ?? 'unknown',
    database: d.database ?? 'unknown',
    status: d.status ?? 'active',
    notes: d.notes ?? '',
    enrichment: (d.enrichment ?? {}) as Project['enrichment'],
    enrichedAt: asDate(d.enrichedAt),
    createdAt: asDate(d.createdAt),
    updatedAt: asDate(d.updatedAt),
  };
}

/**
 * Live subscription to the whole collection, newest first.
 *
 * Unbounded on purpose: the realistic dataset is tens of documents, and client-side filtering
 * over a small array supports substring search across every field, which Firestore cannot do at
 * any price. Revisit past ~500 documents — see backlog.md.
 */
export function subscribeProjects(
  onData: (projects: Project[]) => void,
  onError: (err: { code: string; message: string }) => void,
): () => void {
  return onSnapshot(
    query(col(), orderBy('updatedAt', 'desc')),
    (snap) => onData(snap.docs.map(toProject)),
    (err) => onError({ code: err.code, message: err.message }),
  );
}

/** createdAt and updatedAt are server-stamped; the rules reject anything in the future. */
export async function createProject(fields: ProjectFields): Promise<string> {
  const ref = await addDoc(col(), {
    ...normalize(fields),
    enrichment: {},
    enrichedAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * Full-document write. The rules require every field present (hasAll) and `createdAt` unchanged
 * from the stored value, so the original must be sent back verbatim.
 */
export async function updateProject(
  id: string,
  fields: ProjectFields,
  createdAt: Date | null,
  enrichment: Enrichment,
  enrichedAt: Date | null,
): Promise<void> {
  // The rules require every field present (hasAll) and createdAt unchanged, so the whole
  // document is rewritten. `enrichment` is passed in rather than read off the form: the form
  // never owns it, so it can never write a stale copy back over a fresh gather.
  await setDoc(doc(db, COLLECTION, id), {
    ...normalize(fields),
    enrichment,
    enrichedAt: enrichedAt ? Timestamp.fromDate(enrichedAt) : null,
    createdAt: createdAt ? Timestamp.fromDate(createdAt) : serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Writes gathered enrichment onto a project the caller did not load — the bulk import's case,
 * where the document was created a moment ago and only its ID is known.
 *
 * The read is not optional. `update` requires `createdAt` to equal the stored value, and a
 * serverTimestamp() written at create time is only knowable by reading it back; sending anything
 * else is a permission-denied. The editable fields are re-read too, so this can never write a
 * stale copy of a field it does not own.
 */
export async function saveEnrichmentById(
  id: string,
  enrichment: Enrichment,
  at: Date,
): Promise<void> {
  const snap = await getDoc(doc(db, COLLECTION, id));
  if (!snap.exists()) throw Object.assign(new Error('Project no longer exists.'), { code: 'not-found' });
  const p = toProject(snap as QueryDocumentSnapshot<DocumentData>);
  const fields: ProjectFields = {
    name: p.name, description: p.description, repoUrl: p.repoUrl, domain: p.domain,
    host: p.host, frontend: p.frontend, database: p.database, status: p.status, notes: p.notes,
  };
  await updateProject(id, fields, p.createdAt, enrichment, at);
}

export async function deleteProject(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
}
