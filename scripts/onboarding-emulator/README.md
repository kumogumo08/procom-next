# 初期設定のローカル Emulator

本番 Firebase には接続しません。プロジェクト ID は `demo-procom-local` です。
既存の一覧テスト用 Firestore Emulator（`127.0.0.1:8181`）とは別のポートを使います。

| 用途 | アドレス |
| --- | --- |
| Auth | `127.0.0.1:9099` |
| Firestore | `127.0.0.1:8282` |
| Storage | `127.0.0.1:9199` |
| Emulator Hub | `127.0.0.1:4401` |
| 画面確認用 Next.js | `127.0.0.1:3100` |

本番の鍵ファイルと `SESSION_PASSWORD` はこの起動方法では読みません。秘密情報をコマンドや手順書に書かないでください。

## PowerShell

作業ディレクトリは `procom-next` です。通常の `npm run dev` が起動している場合は、先に止めてください。

最初のターミナル:

```powershell
npm run emulators:start
```

`All emulators ready` と表示されるまで待ちます。このコマンドは本番プロジェクトを使いません。

画面を確認するときは、別のターミナルで次を実行します。

```powershell
npm run dev:emulator
```

ブラウザで `http://127.0.0.1:3100` を開きます。`3100` が使用中のときは、このコマンドは起動せずに停止します。

結合テストは、Emulator が3つとも起動しているときだけ実行します。テスト自身が `3100` で Next.js を短時間起動するので、`npm run dev:emulator` とは同時に実行しないでください。

```powershell
npm run test:onboarding:integration
```

Emulator が足りない場合、登録や保存は始まらずにエラーで終わります。
