export default function SupportPage() {
    return (
      <main style={{ padding: 24, maxWidth: 860, margin: '0 auto', lineHeight: 1.7 }}>
        <h1>ワンタップライフ サポート</h1>
  
        <p>
          ワンタップライフに関するご質問・不具合報告は、以下のメールアドレスまでご連絡ください。
        </p>
  
        <p>
          <strong>お問い合わせ先：</strong>
          <a href="mailto:ebidevlab.app@gmail.com">ebidevlab.app@gmail.com</a>
        </p>
  
        <h2>不具合報告の際に教えてほしい情報</h2>
        <ul>
          <li>ご利用端末（例：iPhone 15 / Pixel 8 など）</li>
          <li>OSバージョン（例：iOS 17.4 / Android 14 など）</li>
          <li>発生した内容（どの画面で／何をしたら起きたか）</li>
          <li>可能であればスクリーンショット</li>
        </ul>
  
        <h2>よくある質問</h2>
        <h3>Q. データはどこに保存されますか？</h3>
        <p>端末内（ローカル）に保存されます。外部サーバーへ送信されることはありません。</p>
  
        <h3>Q. アプリを削除するとデータはどうなりますか？</h3>
        <p>アプリを削除すると、端末内に保存されたデータも削除されます。</p>
  
        <p style={{ marginTop: 24, opacity: 0.7, fontSize: 12 }}>
          ※ 本ページの内容は必要に応じて更新される場合があります。
        </p>
      </main>
    );
  }