/**
 * 初期設定の公開判定と保存計画。Firestore には接続しない。
 * 実行: npx tsx scripts/onboarding-check.ts
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  canExposeProfileToViewer,
  isOnboardingBlocked,
  profileLoginPath,
  safeLoginRedirect,
} from '@/lib/onboarding';
import {
  PENDING_REGISTRATION,
  authCleanupDecision,
  claimsToPersist,
  initialNewUserProfile,
  registrationResumeAction,
  repeatRegistrationAction,
} from '@/lib/registration';
import { isProfilePublic } from '@/lib/userSeo';
import { resolveSectionOrder, showsFixedCalendar } from '@/lib/blockLayout';
import {
  acceptOwnedSetupPhoto,
  applySetupWrites,
  buildSetupPhotoUrl,
  inspectSetupImage,
  planSetupComplete,
  planSetupDraft,
  resolveSetupUid,
  SETUP_STORAGE_BUCKET,
  setupFormInitial,
} from '@/lib/onboardingSetup';
import {
  hasOnboardingPhoto,
  isOnboardingProfileComplete,
  isProfilePublicWithOnboarding,
  ONBOARDING_TEXT_MAX,
  readOnboardingGate,
} from '@/lib/onboarding';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const ready = {
  name: '山田',
  title: '配信者',
  photos: [{ url: 'https://example.com/a.jpg' }],
};

assert(isProfilePublicWithOnboarding({ name: '既存' }) === true, '1. フィールドなし・isPublic未設定は公開');
assert(isProfilePublic({ name: '既存' }) === true, '1. 既存判定も公開のまま');

assert(
  isProfilePublicWithOnboarding({ name: '既存', isPublic: false }) === false,
  '2. フィールドなし・isPublic:false は非掲載'
);
assert(isProfilePublic({ isPublic: false }) === false, '2. 既存判定の非掲載は維持');

assert(
  isProfilePublicWithOnboarding({
    onboardingStatus: 'required',
    name: ' ',
    title: '',
    photos: [],
  }) === false,
  '3. required・3項目未完成は非公開'
);
assert(
  isOnboardingProfileComplete({
    onboardingStatus: 'required',
    name: ' ',
    title: '',
    photos: [],
  }) === false,
  '3. required・3項目未完成は未完成'
);

assert(isOnboardingProfileComplete({ onboardingStatus: 'required', ...ready }) === true, '4. requiredでも3項目が揃えば完成判定');
assert(
  isProfilePublicWithOnboarding({ onboardingStatus: 'required', ...ready }) === false,
  '4. required・3項目完成でも未完了扱い'
);
assert(
  isProfilePublic({ onboardingStatus: 'required', ...ready }) === true,
  '4. 既存の isProfilePublic は required を見ない'
);

assert(
  isProfilePublicWithOnboarding({ onboardingStatus: 'complete', ...ready }) === true,
  '5. complete・isPublic未設定は公開'
);
assert(
  isProfilePublicWithOnboarding({ onboardingStatus: 'complete', ...ready, isPublic: false }) === false,
  '6. complete・isPublic:false は非掲載'
);

assert(isOnboardingProfileComplete({ ...ready, name: '   ' }) === false, '7. 名前が空白のみは未完成');
assert(isOnboardingProfileComplete({ ...ready, title: ' \n ' }) === false, '8. 肩書きが空白のみは未完成');
assert(isOnboardingProfileComplete({ ...ready, photos: [] }) === false, '9. 写真が空配列は未完成');
assert(hasOnboardingPhoto({ photos: [] }) === false, '9. 空配列は写真なし');

assert(readOnboardingGate({ onboardingStatus: 'pending' }) === 'unknown', '10. 未知の状態');
assert(isProfilePublicWithOnboarding({ onboardingStatus: 'pending', ...ready }) === false, '10. 未知の状態は非公開');
assert(isProfilePublicWithOnboarding({ onboardingStatus: '', ...ready }) === false, '10. 空文字は非公開');
assert(isProfilePublicWithOnboarding({ onboardingStatus: null, ...ready }) === false, '10. null は非公開');

const existing = {
  name: '既存ユーザー',
  title: '肩書き',
  bio: '',
  photos: [{ url: 'https://example.com/a.jpg', position: 50 }],
  youtubeChannelId: '',
  instagramPostUrl: '',
  xUsername: '',
  tiktokUrls: [],
  calendarEvents: [],
};
const before = JSON.stringify(existing);
assert(readOnboardingGate(existing) === 'legacy', '11. onboardingStatus が無い既存データは legacy');
assert(isProfilePublicWithOnboarding(existing) === isProfilePublic(existing), '11. 既存データは従来の公開判定と同じ');
assert(JSON.stringify(existing) === before, '11. 判定は既存オブジェクトを書き換えない');
assert(!Object.prototype.hasOwnProperty.call(existing, 'onboardingStatus'), '11. 判定は onboardingStatus を足さない');
assert(!Object.prototype.hasOwnProperty.call(existing, 'isPublic'), '11. 判定は isPublic を足さない');

const name48 = 'あ'.repeat(ONBOARDING_TEXT_MAX);
assert(isOnboardingProfileComplete({ ...ready, name: name48, title: name48 }) === true, '48文字は完成');
assert(isOnboardingProfileComplete({ ...ready, name: `${name48}あ` }) === false, '名前が49文字は未完成');
assert(isOnboardingProfileComplete({ ...ready, title: `${name48}あ` }) === false, '肩書きが49文字は未完成');
assert(isOnboardingProfileComplete({ ...ready, photos: [{ url: ' http://example.com/a.jpg ' }] }) === false, 'https 以外の写真は未完成');

const owner = 'userA1234';
const other = 'userB1234';
const fileId = '11111111-1111-4111-8111-111111111111';
const token = '22222222-2222-4222-8222-222222222222';
const ownedUrl = buildSetupPhotoUrl(SETUP_STORAGE_BUCKET, `photos/${owner}/${fileId}.jpg`, token);
const otherUrl = buildSetupPhotoUrl(SETUP_STORAGE_BUCKET, `photos/${other}/${fileId}.jpg`, token);
assert(typeof ownedUrl === 'string' && typeof otherUrl === 'string', 'テスト用のStorage URLを作れる');

const stored = {
  onboardingStatus: 'required' as const,
  name: '登録名',
  title: '',
  photos: [],
  calendarEvents: [{ date: '2020-01-01', events: ['配信'] }],
  tiktokUrls: ['https://www.tiktok.com/@name/video/1'],
  settings: { sectionOrder: ['YouTube', 'X'], blockLayoutVersion: 1, showYouTube: false },
};

const anonymous = resolveSetupUid(undefined, owner);
const foreign = resolveSetupUid(owner, other);
assert(!anonymous.ok && anonymous.status === 401, '1. 未認証では保存できない');
assert(!foreign.ok && foreign.status === 403, '2. 本人以外のUIDでは保存できない');
assert(resolveSetupUid(owner, owner).ok === true, '2. 本人のUIDは保存対象になる');

const basePlan = {
  existingProfile: stored,
  sessionUid: owner,
  claimedUid: owner,
  bucketName: SETUP_STORAGE_BUCKET,
  name: '登録名',
  title: '配信者',
  photoUrl: ownedUrl,
  photoExists: true,
};

const blankName = planSetupComplete({ ...basePlan, name: '   ' });
assert(!blankName.ok && blankName.field === 'name', '3. 名前が空白なら完了不可');
const blankTitle = planSetupComplete({ ...basePlan, title: ' \n ' });
assert(!blankTitle.ok && blankTitle.field === 'title', '4. 肩書きが空白なら完了不可');
const longName = planSetupComplete({ ...basePlan, name: `${name48}あ` });
assert(!longName.ok && longName.field === 'name', '5. 49文字以上なら完了不可');
const noPhoto = planSetupComplete({ ...basePlan, photoUrl: '', photoExists: false });
assert(!noPhoto.ok && noPhoto.field === 'photo', '6. 写真なしでは完了不可');
const externalPhoto = planSetupComplete({
  ...basePlan,
  photoUrl: 'https://example.com/a.jpg',
  photoExists: true,
});
assert(!externalPhoto.ok && externalPhoto.field === 'photo', '7. 外部URLの写真では完了不可');
const otherPhoto = planSetupComplete({ ...basePlan, photoUrl: otherUrl, photoExists: true });
assert(!otherPhoto.ok && otherPhoto.field === 'photo', '8. 別ユーザーのStorage写真では完了不可');
const prefixedUid = buildSetupPhotoUrl(SETUP_STORAGE_BUCKET, `photos/${owner}x/${fileId}.jpg`, token);
assert(
  !planSetupComplete({ ...basePlan, photoUrl: prefixedUid, photoExists: true }).ok,
  '8. UIDの前方一致では所有にしない'
);
assert(
  !acceptOwnedSetupPhoto(
    `https://firebasestorage.googleapis.com.evil.example/v0/b/${SETUP_STORAGE_BUCKET}/o/photos%2F${owner}%2F${fileId}.jpg`,
    owner,
    SETUP_STORAGE_BUCKET,
    true
  ).ok,
  '8. ホスト名の前方一致では所有にしない'
);
assert(!planSetupComplete({ ...basePlan, photoExists: false }).ok, '6. 実在しない写真では完了不可');

const draft = planSetupDraft({
  existingProfile: stored,
  sessionUid: owner,
  claimedUid: owner,
  bucketName: SETUP_STORAGE_BUCKET,
  nameProvided: true,
  titleProvided: true,
  photoProvided: false,
  name: '登録名',
  title: '配信者',
  photoUrl: undefined,
  photoExists: false,
});
assert(draft.ok === true, '9. 途中保存できる');
if (draft.ok) {
  assert(draft.writes.onboardingStatus === undefined, '9. 途中保存ではrequiredを維持する');
  const drafted = applySetupWrites(stored, draft.writes);
  assert(drafted.onboardingStatus === 'required', '9. 途中保存後もrequired');
  assert(JSON.stringify(drafted.calendarEvents) === JSON.stringify(stored.calendarEvents), '13. カレンダーを保持');
  assert(JSON.stringify(drafted.settings) === JSON.stringify(stored.settings), '13. ブロック情報を保持');
  assert(JSON.stringify(drafted.tiktokUrls) === JSON.stringify(stored.tiktokUrls), '13. SNS情報を保持');
}

const published = planSetupComplete(basePlan);
assert(published.ok === true && published.writes.onboardingStatus === 'complete', '10. 完了処理だけがcompleteにする');
if (published.ok) {
  const after = applySetupWrites(stored, published.writes);
  assert(after.calendarEvents[0].events[0] === '配信', '13. 完了後もカレンダーを保持');
  assert(after.settings.blockLayoutVersion === 1, '13. 完了後もblockLayoutVersionを保持');
  const again = planSetupComplete({ ...basePlan, existingProfile: after });
  assert(!again.ok && again.status === 409, '11. 完了後の再送信は書き戻さない');
  const parallel = planSetupComplete(basePlan);
  assert(JSON.stringify(parallel) === JSON.stringify(published), '11. 同じ状態の複数タブは同じ完了結果');
}

const legacyBefore = JSON.stringify(existing);
const legacyDraft = planSetupDraft({
  existingProfile: existing,
  sessionUid: owner,
  claimedUid: undefined,
  bucketName: SETUP_STORAGE_BUCKET,
  nameProvided: true,
  titleProvided: true,
  photoProvided: true,
  name: '改ざん',
  title: '改ざん',
  photoUrl: ownedUrl,
  photoExists: true,
});
const legacyComplete = planSetupComplete({ ...basePlan, existingProfile: existing });
assert(!legacyDraft.ok && legacyDraft.status === 403, '12. 既存ユーザーの途中保存を拒否');
assert(!legacyComplete.ok && legacyComplete.status === 403, '12. 既存ユーザーの完了を拒否');
assert(JSON.stringify(existing) === legacyBefore, '12. 既存ユーザーのデータを変更しない');

const completeProfile = { ...stored, onboardingStatus: 'complete' as const, name: '登録名', title: '配信者' };
const back = planSetupComplete({ ...basePlan, existingProfile: completeProfile });
assert(!back.ok && back.status === 409, '12. completeをrequiredへ戻さない');

assert(setupFormInitial(stored).name === '登録名', '14. 登録済みの名前を初期表示');
if (draft.ok) {
  const resumed = setupFormInitial(applySetupWrites(stored, draft.writes));
  assert(resumed.name === '登録名' && resumed.title === '配信者', '15. 保存済みの名前と肩書きを再開時に返す');
}

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0x00]);
assert(inspectSetupImage('image/jpeg', jpeg).ok === true, 'JPEGを受け付ける');
assert(inspectSetupImage('image/svg+xml', jpeg).ok === false, 'SVGは受け付けない');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const userRoute = readFileSync(join(root, 'app/api/user/[uid]/route.ts'), 'utf8');
const registerRoute = readFileSync(join(root, 'app/api/register/route.ts'), 'utf8');
const loginClient = readFileSync(join(root, 'app/login/LoginClient.tsx'), 'utf8');
const setupServer = readFileSync(join(root, 'app/lib/onboardingSetupServer.ts'), 'utf8');
const photoRoute = readFileSync(join(root, 'app/api/profile/setup/photo/route.ts'), 'utf8');
assert(!userRoute.includes('onboardingStatus'), '通常のプロフィール保存はonboardingStatusを扱わない');
assert(userRoute.includes('isOnboardingBlocked'), '公開APIは未完了プロフィールを隠す');
assert(registerRoute.includes("redirectTo: '/profile/setup'"), '新規登録後は初期設定へ進む');
assert(registerRoute.includes('.create('), '新規文書は上書きせず作成する');
assert(loginClient.includes('safeLoginRedirect'), '再ログインはサーバーの遷移先を使う');
assert(setupServer.includes('.exists('), '画像の実在を確認する');
assert(setupServer.includes('runTransaction'), '状態変更はトランザクションで行う');
assert(!setupServer.includes('noteUserListing'), '初期設定の保存から一覧同期を呼ばない');
assert(!setupServer.includes('uploadPhotos'), '既存画像を先に消すアップロードは使わない');
assert(!setupServer.includes("onboardingStatus'] = 'required'"), 'requiredを書き込まない');
assert(!photoRoute.includes('getFiles'), '既存のStorage一覧を削除しない');

const legacyProfile = { name: '既存ユーザー', title: '肩書き', photos: [{ url: 'https://example.com/a.jpg' }] };
const requiredProfile = { ...legacyProfile, onboardingStatus: 'required' as const };
const unknownProfile = { ...legacyProfile, onboardingStatus: 'later' };
const finishedProfile = { ...legacyProfile, onboardingStatus: 'complete' as const };
const privateComplete = { ...finishedProfile, isPublic: false };

assert(profileLoginPath('userA1234', legacyProfile) === '/user/userA1234', '1. 既存ユーザーは初期設定を要求されない');
assert(isOnboardingBlocked(legacyProfile) === false, '1. 既存ユーザーは本文を隠さない');
assert(initialNewUserProfile('新規').onboardingStatus === 'required', '2. 新規ユーザーだけrequiredになる');
const freshProfile = initialNewUserProfile('新規');
const freshOrder = resolveSectionOrder(freshProfile.settings.sectionOrder, freshProfile.settings.blockLayoutVersion);
assert(freshProfile.settings.blockLayoutVersion === 1, '2. 新規ユーザーはblockLayoutVersion 1');
assert(Array.isArray(freshProfile.settings.sectionOrder) && freshProfile.settings.sectionOrder.length === 0, '2. 新規ユーザーのsectionOrderは空');
assert(freshOrder.length === 0, '2. 空配列を既定ブロックへ補完しない');
assert(showsFixedCalendar(freshProfile.settings.calendarLayout, freshOrder) === false, '2. 新規ユーザーに固定カレンダーを出さない');
assert(repeatRegistrationAction(true) === 'reject-existing', '2. 既存文書はrequired化しない');
assert(registrationResumeAction({ documentExists: true, claim: PENDING_REGISTRATION }) === 'keep', '2. ログインでも既存文書は作らない');
assert(isOnboardingBlocked(requiredProfile) === true, '3. requiredでは公開本文を出さない');
assert(canExposeProfileToViewer(requiredProfile, null, 'userA1234') === false, '4. requiredは第三者のAPIへ出さない');
assert(canExposeProfileToViewer(requiredProfile, 'userA1234', 'userA1234') === true, '4. 本人の初期設定用アクセスは残す');
assert(isProfilePublicWithOnboarding(requiredProfile) === false, '5. requiredはトップの掲載対象外');
assert(isProfilePublicWithOnboarding(requiredProfile) === false, '6. requiredはユーザー一覧の対象外');
assert(isProfilePublicWithOnboarding(requiredProfile) === false, '7. requiredはサイトマップの掲載対象外');
assert(isOnboardingBlocked(unknownProfile) === true, '8. unknownも非公開');
assert(canExposeProfileToViewer(unknownProfile, null, 'userA1234') === false, '8. unknownはAPIにも出さない');
assert(isProfilePublicWithOnboarding(finishedProfile) === true, '9. completeは公開可能');
assert(isOnboardingBlocked(privateComplete) === false, '10. completeかつisPublic:falseは本文の非表示対象にしない');
assert(isProfilePublicWithOnboarding(privateComplete) === false, '10. completeかつisPublic:falseは従来どおり非掲載');
assert(isProfilePublicWithOnboarding(legacyProfile) === isProfilePublic(legacyProfile), '11. legacyは従来どおり');
assert(profileLoginPath('userA1234', requiredProfile) === '/profile/setup', '12. ログアウト後もrequiredなら初期設定に戻る');
assert(safeLoginRedirect('userA1234', '/profile/setup') === '/profile/setup', '12. 初期設定への遷移を受け付ける');
assert(safeLoginRedirect('userA1234', 'https://evil.example') === '/user/userA1234', '12. 外部への遷移先は捨てる');
assert(isProfilePublicWithOnboarding(stored) === false, '13. 途中保存のrequiredは公開されない');
assert(published.ok === true && published.writes.onboardingStatus === 'complete', '14. 公開操作の成功後にcompleteになる');
if (published.ok) {
  const listed = applySetupWrites(stored, published.writes);
  assert(isProfilePublicWithOnboarding(listed) === true, '15. completeになると掲載同期の対象になる');
  assert(JSON.stringify(listed.calendarEvents) === JSON.stringify(stored.calendarEvents), '16. カレンダーを維持');
  assert(listed.settings.blockLayoutVersion === 1, '16. ブロック配置を維持');
}
assert(
  authCleanupDecision({ createdUid: 'newUser123', failedUid: 'newUser123', documentCreated: false }) === 'delete-created-user',
  '17. このリクエストで作成したAuthだけ削除する'
);
assert(
  authCleanupDecision({ createdUid: 'newUser123', failedUid: 'oldUser123', documentCreated: false }) === 'keep',
  '17. 別のAuthユーザーは削除しない'
);
assert(
  authCleanupDecision({ createdUid: 'newUser123', failedUid: 'newUser123', documentCreated: true }) === 'keep',
  '17. 文書作成後のAuthユーザーは削除しない'
);
assert(repeatRegistrationAction(false) === 'reject-auth-only', '17. 再登録ではAuthだけのアカウントを新規作成しない');
assert(
  registrationResumeAction({ documentExists: false, claim: PENDING_REGISTRATION }) === 'create-missing-document',
  '17. ログイン済みの中断登録だけ文書を作る'
);
assert(
  registrationResumeAction({ documentExists: false, claim: undefined }) === 'keep',
  '17. Authだけでは新規扱いにしない'
);
const staleClaims = claimsToPersist({ procomPasswordCheck: 'hash', procomRegistration: 'pending', role: 'x' }, true);
assert(staleClaims.changed && staleClaims.next?.procomPasswordCheck === undefined, '17. パスワード由来のclaimは残さない');
assert(staleClaims.next?.role === 'x', '17. 無関係なclaimは残す');
assert(!registerRoute.includes('procomPasswordCheck'), '17. 登録処理はパスワードハッシュをclaimへ書かない');
assert(resolveSetupUid(owner, other).ok === false, '18. ユーザーAはユーザーBの初期設定を操作できない');
const hiddenTitle = 'Procom';
const hiddenDescription = 'このプロフィールは公開されていません';
assert(!hiddenTitle.includes(String(requiredProfile.name)) && !hiddenDescription.includes(String(requiredProfile.title)), '19. 未完了のSEO文面に名前と肩書きを出さない');
assert(isOnboardingBlocked(requiredProfile) === true, '19. 未完了は個別のSEO情報を使わない');
const initLogin = readFileSync(join(root, 'app/api/init/login/route.ts'), 'utf8');
assert(initLogin.includes('status: 410'), '20. 旧ログインAPIが410のまま');
assert(!initLogin.includes('setSessionCookie'), '20. 旧ログインAPIはセッションを発行しない');
const listing = readFileSync(join(root, 'app/lib/listing/firestoreListing.ts'), 'utf8');
const legacyList = readFileSync(join(root, 'app/lib/listing/legacyDirectory.ts'), 'utf8');
const completeRoute = readFileSync(join(root, 'app/api/profile/setup/complete/route.ts'), 'utf8');
const setupDraftRoute = readFileSync(join(root, 'app/api/profile/setup/route.ts'), 'utf8');
assert(listing.includes('isProfilePublicWithOnboarding'), '掲載同期は初期設定を考慮する');
assert(legacyList.includes('profile.onboardingStatus'), '旧一覧は初期設定の状態を読む');
assert(completeRoute.includes('noteUserListing'), '公開完了は掲載同期を呼ぶ');
assert(!setupDraftRoute.includes('noteUserListing'), '途中保存は掲載同期を呼ばない');
const firebaseInit = readFileSync(join(root, 'app/lib/firebase.ts'), 'utf8');
const firebaseAdminInit = readFileSync(join(root, 'app/lib/firebase-admin.ts'), 'utf8');
const clientInit = readFileSync(join(root, 'app/lib/firebaseClient.ts'), 'utf8');
const sessionLogin = readFileSync(join(root, 'app/api/session/login/route.ts'), 'utf8');
assert(firebaseInit.indexOf('assertServerEmulator') < firebaseInit.indexOf('readFileSync'), '管理SDKは鍵より先にEmulator設定を確認する');
assert(firebaseAdminInit.indexOf('assertServerEmulator') < firebaseAdminInit.indexOf('readFileSync'), '一覧用の管理SDKも鍵より先にEmulator設定を確認する');
assert(clientInit.includes('assertClientEmulator') && clientInit.includes('connectAuthEmulator'), 'クライアントはEmulatorが無いと本番設定へ戻らない');
assert(sessionLogin.includes('getUser(uid)') && sessionLogin.includes('userRef.create('), '復旧は最新ユーザーとcreateを使う');
assert(!sessionLogin.includes('userRef.set(') && !sessionLogin.includes('decoded.custom'), '復旧は既存文書と古いトークンclaimを使わない');
assert(registerRoute.includes('setCustomUserClaims(uid, null).catch'), 'claim削除の失敗では登録済み文書を残す');

console.log('onboarding-check ok');
