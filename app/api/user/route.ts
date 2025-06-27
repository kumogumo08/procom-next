// app/api/users/route.ts
import { db } from '@/lib/firebase';
import { NextResponse } from 'next/server';

export async function GET() {
  const snapshot = await db.collection('users').get();

  const list = snapshot.docs.map(doc => {
    const data = doc.data();
    const profile = data.profile || {};
    return {
      uid: doc.id,
      profile: {
        ...profile,
        name: profile.name || data.name || '', // 外にある name も拾う
        title: profile.title || data.title || '',
        bio: profile.bio || data.bio || '',
        photos: profile.photos || data.photos || [],
        youtubeChannelId: profile.youtubeChannelId || '',
        instagramPostUrl: profile.instagramPostUrl || '',
        xUsername: profile.xUsername || '',
        tiktokUrls: profile.tiktokUrls || [],
        youtubeMode: profile.youtubeMode || 'latest',
        manualYouTubeUrls: profile.manualYouTubeUrls || []
      }
    };
  });

  return NextResponse.json(list);
}