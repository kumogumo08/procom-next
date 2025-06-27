// src/types/globals.d.ts
export {};

declare global {
  interface Window {
    createCalendar?: (date: Date, isOwnPage: boolean) => void;
    updatePhotoSlider?: (photos: any[], isOwnPage: boolean) => void;
    displayManualYouTubeVideos?: (urls: string[]) => void;
    displayTikTokVideos?: (urls?: string[]) => void;
    showXProfile?: (username?: string) => void;
    embedInstagramPost?: (url?: string | boolean) => void;
    saveYouTubeSettings?: () => void;
    addManualVideoInput?: () => void;
    fetchLatestVideos?: (channelId: string) => void;
    savePhotos?: () => void;
    FB?: any;
  }
}