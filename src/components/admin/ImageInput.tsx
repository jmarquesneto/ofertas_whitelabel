"use client";
import { useState } from "react";

/**
 * Campo de imagem com validação no navegador: arquivos grandes demais
 * são recusados antes do envio (evita erro de limite do servidor).
 */
export function ImageInput({
  id, name, accept, maxMb = 8, className = "input",
}: { id: string; name: string; accept: string; maxMb?: number; className?: string }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <input
        id={id}
        name={name}
        type="file"
        accept={accept}
        className={className}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f && f.size > maxMb * 1024 * 1024) {
            setError(`Imagem com ${(f.size / 1024 / 1024).toFixed(1)} MB. O máximo é ${maxMb} MB: reduza ou comprima o arquivo.`);
            e.target.value = "";
          } else setError(null);
        }}
      />
      {error && <span role="alert" className="text-xs font-medium text-red-700">{error}</span>}
    </>
  );
}
