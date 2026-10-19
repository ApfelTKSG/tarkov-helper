'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function RaidPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/maps');
  }, [router]);
  return (
    <main className="p-6">
      <Link href="/maps">マップ別ページに移動</Link>
    </main>
  );
}
