import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fileService, type FileUploadInput } from '@/services/fileService';
import { queryKeys } from '@/hooks/useEntities';
import type { FileItem } from '@/types';

function invalidateFiles(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['files'] });
  qc.invalidateQueries({ queryKey: queryKeys.dashboard });
  qc.invalidateQueries({ queryKey: queryKeys.analytics });
}

/** Upload di un file tramite il file service (Storage in prod, data-URI in demo). */
export function useUploadFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: FileUploadInput) => fileService.upload(input),
    onSuccess: () => invalidateFiles(qc),
  });
}

/** Elimina un file (oggetto Storage + metadati). */
export function useRemoveFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: FileItem) => fileService.remove(file),
    onSuccess: () => invalidateFiles(qc),
  });
}

/**
 * Risolve l'URL utilizzabile (firmato in prod) per anteprima/download.
 * In produzione l'URL firmato è temporaneo e viene rigenerato al cambio file.
 */
export function useFileUrl(file: FileItem | undefined) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!file) {
      setUrl(null);
      return;
    }
    fileService
      .resolveUrl(file)
      .then((resolved) => {
        if (active) setUrl(resolved);
      })
      .catch(() => {
        if (active) setUrl(null);
      });
    return () => {
      active = false;
    };
  }, [file]);

  return url;
}
