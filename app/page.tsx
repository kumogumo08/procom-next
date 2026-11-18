// app/page.tsx
import { permanentRedirect } from 'next/navigation';

/** 正規URLは /top。ここへ戻るリンクは置かない。 */
export default function Home() {
  permanentRedirect('/top');
}