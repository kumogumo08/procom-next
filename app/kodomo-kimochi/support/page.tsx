export default function SupportPage() {
    return (
      <main style={{ maxWidth: 800, margin: "0 auto", padding: 20, lineHeight: 1.8 }}>
        <h1>サポート / Support</h1>
  
        <p>
          「子供のきもち」をご利用いただきありがとうございます。
          本アプリに関するお問い合わせ、不具合報告、ご要望は以下のメールアドレスまでご連絡ください。
        </p>
        <p>
          {`Thank you for using "Kodomo no Kimochi".
          For inquiries, bug reports, or feedback, please contact us at the email address below.`}
        </p>
  
        <h2>お問い合わせ先 / Contact</h2>
        <p>
          <a href="mailto:ebidevlab.app@gmail.com">ebidevlab.app@gmail.com</a>
        </p>
  
        <h2>対応内容 / What We Support</h2>
        <ul>
          <li>アプリの不具合に関するお問い合わせ</li>
          <li>機能に関するご質問</li>
          <li>ご要望・改善提案</li>
  
          <li>Bug reports</li>
          <li>Questions about features</li>
          <li>Requests and suggestions for improvement</li>
        </ul>
  
        <h2>ご連絡時のお願い / Information to Include</h2>
        <p>お問い合わせの際は、可能な範囲で以下の情報を記載してください。</p>
        <p>Please include the following information if possible:</p>
        <ul>
          <li>ご利用端末（iPhone / iPad など）</li>
          <li>OSのバージョン</li>
          <li>発生している問題の内容</li>
          <li>問題が発生した手順</li>
  
          <li>Your device (iPhone, iPad, etc.)</li>
          <li>OS version</li>
          <li>Description of the issue</li>
          <li>Steps to reproduce the issue</li>
        </ul>
  
        <h2>補足 / Note</h2>
        <p>
          本アプリは、子どもの気持ちを言葉にするきっかけ作りや、
          親子のコミュニケーション支援を目的としたアプリです。
          医療・診断・治療を目的としたものではありません。
        </p>
        <p>
          This app is designed to help children express their feelings and support parent-child communication.
          It is not intended for medical, diagnostic, or treatment purposes.
        </p>
  
        <p style={{ marginTop: 40 }}>
          運営者：EBI Dev Lab
        </p>
        <p>
          Operator: EBI Dev Lab
        </p>
      </main>
    );
  }