'use client';

import { useState } from 'react';

export default function ApiImage({
  src,
  name,
  className,
}: {
  src?: string;
  name: string;
  className: string;
}) {
  const [failedSource, setFailedSource] = useState<string>();
  if (!src || failedSource === src)
    return (
      <span
        className={`${className} flex items-center justify-center bg-slate-900 p-1 text-center text-xs`}
      >
        {name}
      </span>
    );
  // API assets are already hosted images; static exports do not use image optimisation.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      className={className}
      loading="lazy"
      onError={() => setFailedSource(src)}
    />
  );
}
