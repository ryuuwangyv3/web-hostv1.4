import { get, set, del, keys, clear } from 'idb-keyval';

/**
 * VFS (Virtual File System) using IndexedDB for large storage (+5GB support)
 * This provides a simple file system interface in the browser.
 */

export interface VFSFile {
  name: string;
  path: string;
  content: string | ArrayBuffer;
  type: 'file' | 'directory';
  lastModified: number;
  size: number;
}

const VFS_PREFIX = 'akasha_vfs:';

export const vfs = {
  /**
   * Write a file to VFS
   */
  async writeFile(path: string, content: string | ArrayBuffer): Promise<void> {
    const normalizedPath = path.replace(/^\/+/, '');
    const file: VFSFile = {
      name: normalizedPath.split('/').pop() || normalizedPath,
      path: normalizedPath,
      content,
      type: 'file',
      lastModified: Date.now(),
      size: typeof content === 'string' ? new Blob([content]).size : content.byteLength
    };
    await set(`${VFS_PREFIX}${normalizedPath}`, file);
  },

  /**
   * Read a file from VFS
   */
  async readFile(path: string): Promise<VFSFile | undefined> {
    const normalizedPath = path.replace(/^\/+/, '');
    return await get<VFSFile>(`${VFS_PREFIX}${normalizedPath}`);
  },

  /**
   * Delete a file from VFS
   */
  async deleteFile(path: string): Promise<void> {
    const normalizedPath = path.replace(/^\/+/, '');
    await del(`${VFS_PREFIX}${normalizedPath}`);
  },

  /**
   * List all files in VFS
   */
  async listFiles(): Promise<VFSFile[]> {
    const allKeys = await keys();
    const vfsKeys = allKeys.filter(k => typeof k === 'string' && k.startsWith(VFS_PREFIX));
    const files: VFSFile[] = [];
    
    for (const key of vfsKeys) {
      const file = await get<VFSFile>(key);
      if (file) files.push(file);
    }
    
    return files;
  },

  /**
   * Clear all VFS data
   */
  async clearAll(): Promise<void> {
    const allKeys = await keys();
    const vfsKeys = allKeys.filter(k => typeof k === 'string' && k.startsWith(VFS_PREFIX));
    for (const key of vfsKeys) {
      await del(key);
    }
  },

  /**
   * Get total storage usage in bytes
   */
  async getUsage(): Promise<number> {
    const files = await this.listFiles();
    return files.reduce((acc, f) => acc + f.size, 0);
  },

  /**
   * Check if storage is available and estimate quota
   */
  async getQuota(): Promise<{ usage: number; quota: number }> {
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      return {
        usage: estimate.usage || 0,
        quota: estimate.quota || 0
      };
    }
    return { usage: 0, quota: 0 };
  }
};
