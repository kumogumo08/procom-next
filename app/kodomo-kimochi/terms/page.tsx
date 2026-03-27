export default function TermsPage() {
    const sectionStyle: React.CSSProperties = {
      background: "#ffffff",
      border: "1px solid #e5e7eb",
      borderRadius: "16px",
      padding: "20px",
      marginBottom: "20px",
      boxShadow: "0 4px 12px rgba(0,0,0,0.04)",
    };
  
    const jaStyle: React.CSSProperties = {
      margin: 0,
      fontSize: "16px",
      lineHeight: 1.9,
      color: "#1f2937",
    };
  
    const enStyle: React.CSSProperties = {
      margin: "12px 0 0",
      fontSize: "14px",
      lineHeight: 1.8,
      color: "#6b7280",
      borderTop: "1px dashed #e5e7eb",
      paddingTop: "12px",
    };
  
    const h2Style: React.CSSProperties = {
      margin: "0 0 14px",
      fontSize: "20px",
      fontWeight: 700,
      color: "#111827",
    };
  
    const listStyle: React.CSSProperties = {
      margin: "0",
      paddingLeft: "20px",
      color: "#1f2937",
      lineHeight: 1.9,
    };
  
    const smallTitleStyle: React.CSSProperties = {
      display: "inline-block",
      fontSize: "12px",
      fontWeight: 700,
      color: "#7c3aed",
      background: "#f3e8ff",
      padding: "4px 10px",
      borderRadius: "999px",
      marginBottom: "12px",
    };
  
    return (
      <main
        style={{
          minHeight: "100vh",
          background: "#f9fafb",
          padding: "24px 16px 60px",
        }}
      >
        <div
          style={{
            maxWidth: "840px",
            margin: "0 auto",
          }}
        >
          <div
            style={{
              background: "linear-gradient(135deg, #fdf2f8 0%, #eff6ff 100%)",
              border: "1px solid #e5e7eb",
              borderRadius: "20px",
              padding: "28px 20px",
              marginBottom: "24px",
            }}
          >
            <div style={smallTitleStyle}>Terms of Service</div>
  
            <h1
              style={{
                margin: "0 0 14px",
                fontSize: "30px",
                lineHeight: 1.3,
                color: "#111827",
              }}
            >
              利用規約
            </h1>
  
            <p
              style={{
                margin: 0,
                fontSize: "16px",
                lineHeight: 1.9,
                color: "#374151",
              }}
            >
              本利用規約（以下、「本規約」といいます。）は、「子供のきもち」（以下、「本アプリ」といいます。）の利用条件を定めるものです。
              ユーザーは、本規約に同意のうえ、本アプリを利用するものとします。
            </p>
  
            <p
              style={{
                margin: "12px 0 0",
                fontSize: "14px",
                lineHeight: 1.8,
                color: "#6b7280",
              }}
            >
              {"These Terms of Service (the \"Terms\") define the conditions for using the application \"Child Emotion Tracker\" (the \"App\"). "}
              By using the App, you agree to these Terms.
            </p>
          </div>
  
          <section style={sectionStyle}>
            <h2 style={h2Style}>第1条（適用）</h2>
            <p style={jaStyle}>
              本規約は、ユーザーと本アプリ提供者との間の、本アプリの利用に関する一切の関係に適用されます。
            </p>
            <p style={enStyle}>
              Article 1 (Scope)<br />
              These Terms apply to all relationships between the user and the provider regarding the use of the App.
            </p>
          </section>
  
          <section style={sectionStyle}>
            <h2 style={h2Style}>第2条（サービス内容）</h2>
            <p style={jaStyle}>
              本アプリは、子どもの感情を記録・可視化し、保護者の関わり方の参考情報を提供することを目的としています。
              医療行為、診断、治療を目的としたものではありません。
            </p>
            <p style={enStyle}>
              Article 2 (Service Description)<br />
              The App records and visualizes children&apos;s emotions and provides guidance for parents.
              It is not intended for medical purposes, diagnosis, or treatment.
            </p>
          </section>
  
          <section style={sectionStyle}>
            <h2 style={h2Style}>第3条（利用料金）</h2>
            <p style={jaStyle}>
              本アプリは一部無料で利用できますが、一部機能は有料（アプリ内課金）となる場合があります。
              有料機能は買い切り型であり、サブスクリプションは発生しません。
              購入および課金は各ストア（Apple App Store等）の規約に従います。
            </p>
            <p style={enStyle}>
              Article 3 (Fees)<br />
              The App is partially free, but some features require payment (in-app purchases).
              Paid features are one-time purchases, and no subscriptions are charged.
              Payments follow the policies of the respective platform (e.g., Apple App Store).
            </p>
          </section>
  
          <section style={sectionStyle}>
            <h2 style={h2Style}>第4条（禁止事項）</h2>
            <ul style={listStyle}>
              <li>法令または公序良俗に違反する行為</li>
              <li>本アプリの運営を妨害する行為</li>
              <li>不正アクセスまたはその試み</li>
              <li>その他不適切と判断される行為</li>
            </ul>
            <p style={enStyle}>
              Article 4 (Prohibited Activities)<br />
              Violating laws or public order / Interfering with the App / Unauthorized access / Other inappropriate actions
            </p>
          </section>
  
          <section style={sectionStyle}>
            <h2 style={h2Style}>第5条（免責事項）</h2>
            <p style={jaStyle}>
              本アプリの情報は参考目的であり、その正確性・完全性を保証するものではありません。
              本アプリの利用により生じたいかなる損害についても、提供者は責任を負いません。
              データの保存・保持は保証されず、消失についても責任を負いません。
            </p>
            <p style={enStyle}>
              Article 5 (Disclaimer)<br />
              The information in the App is for reference only and is not guaranteed to be accurate or complete.
              The provider is not liable for any damages arising from the use of the App.
              Data storage is not guaranteed, and the provider is not responsible for data loss.
            </p>
          </section>
  
          <section style={sectionStyle}>
            <h2 style={h2Style}>第6条（変更・停止）</h2>
            <p style={jaStyle}>
              提供者は、事前通知なく本アプリの内容変更または提供停止を行うことがあります。
            </p>
            <p style={enStyle}>
              Article 6 (Changes &amp; Suspension)<br />
              The provider may change or discontinue the App without prior notice.
            </p>
          </section>
  
          <section style={sectionStyle}>
            <h2 style={h2Style}>第7条（規約変更）</h2>
            <p style={jaStyle}>
              提供者は必要に応じて、本規約を通知なく変更できるものとします。
            </p>
            <p style={enStyle}>
              Article 7 (Modification)<br />
              The provider may modify these Terms without prior notice.
            </p>
          </section>
  
          <section style={sectionStyle}>
            <h2 style={h2Style}>第8条（準拠法・管轄）</h2>
            <p style={jaStyle}>
              本規約は日本法を準拠法とし、紛争は提供者所在地を管轄する裁判所とします。
            </p>
            <p style={enStyle}>
              Article 8 (Governing Law)<br />
              These Terms are governed by the laws of Japan.
              Any disputes shall be subject to the jurisdiction of the provider&apos;s local court.
            </p>
          </section>
  
          <section style={sectionStyle}>
            <h2 style={h2Style}>第9条（未成年）</h2>
            <p style={jaStyle}>
              未成年は保護者の同意のもとで本アプリを利用するものとします。
            </p>
            <p style={enStyle}>
              Article 9 (Minors)<br />
              Minors must use the App with parental consent.
            </p>
          </section>
  
          <section style={sectionStyle}>
            <h2 style={h2Style}>第10条（お問い合わせ）</h2>
            <p style={jaStyle}>お問い合わせ：ebidevlab.app@gmail.com</p>
            <p style={enStyle}>
              Article 10 (Contact)<br />
              Contact: ebidevlab.app@gmail.com
            </p>
          </section>
  
          <div
            style={{
              textAlign: "center",
              color: "#6b7280",
              fontSize: "14px",
              marginTop: "28px",
            }}
          >
            制定日：2026年4月 / Effective Date: April 2026
          </div>
        </div>
      </main>
    );
  }