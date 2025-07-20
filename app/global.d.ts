// global.d.ts の上部に Photo を定義（または import して）：
type Photo = {
  url: string;
  position?: string;
};

interface Window {
  gtag: (...args: any[]) => void;

  embedInstagramPost?: (url: string) => void;
  embedFacebookPage?: (url: string) => void;
  showXProfile?: (username: string) => void;
  displayTikTokVideos?: (urls: string[]) => void;
  displayManualYouTubeVideos?: (urls: string[]) => void;
  fetchLatestVideos?: (channelId: string) => void;

  updatePhotoSlider?: (photos: Photo[], own: boolean) => void;
  createCalendar?: (date: Date, own: boolean) => void;
  savePhotos?: () => void;
}
