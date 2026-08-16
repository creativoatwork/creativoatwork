import type { Project } from './types';

export const SCHEMA_VERSION = 1;

export interface Backup {
  schemaVersion: number;
  exportedAt: string;
  projectCount: number;
  projects: Array<Record<string, unknown>>;
}

/**
 * On the free plan there is no point-in-time recovery and no managed backup, so this file is
 * the entire recovery story. It carries document IDs and ISO timestamps so scripts/restore-
 * projects.mjs can rebuild the collection exactly — see the spec, section 7.
 */
export function buildBackup(projects: Project[]): Backup {
  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    projectCount: projects.length,
    projects: projects.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      repoUrl: p.repoUrl,
      domain: p.domain,
      host: p.host,
      frontend: p.frontend,
      database: p.database,
      status: p.status,
      notes: p.notes,
      createdAt: p.createdAt ? p.createdAt.toISOString() : null,
      updatedAt: p.updatedAt ? p.updatedAt.toISOString() : null,
    })),
  };
}

/** Refuses to produce a file it cannot vouch for. A silently truncated backup is worse than none. */
export function downloadBackup(projects: Project[]): void {
  const backup = buildBackup(projects);
  if (backup.projectCount !== backup.projects.length) {
    throw new Error('Refusing to export: project count does not match the serialised list.');
  }
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `admindash-projects-${backup.exportedAt.slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
