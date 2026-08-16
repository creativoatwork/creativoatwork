import {
  collection, doc, addDoc, setDoc, deleteDoc, onSnapshot, query, orderBy,
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

export async function deleteProject(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
}
