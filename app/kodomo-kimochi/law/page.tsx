export default function LawPage() {
  const sectionStyle: React.CSSProperties = {
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "16px",
    padding: "24px",
    marginBottom: "20px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.04)",
  };

  const headingStyle: React.CSSProperties = {
    fontSize: "18px",
    fontWeight: 700,
    marginBottom: "12px",
    color: "#111827",
  };

  const jaStyle: React.CSSProperties = {
    margin: 0,
    marginBottom: "10px",
    color: "#111827",
  };

  const enStyle: React.CSSProperties = {
    margin: 0,
    color: "#4b5563",
    fontSize: "15px",
  };

  const labelStyle: React.CSSProperties = {
    display: "inline-block",
    fontSize: "12px",
    fontWeight: 700,
    padding: "4px 10px",
    borderRadius: "999px",
    marginBottom: "10px",
  };

  return (
    <main
      style={{
        padding: "48px 20px",
        maxWidth: "880px",
        margin: "0 auto",
        lineHeight: "1.9",
        backgroundColor: "#f9fafb",
      }}
    >
      <div style={{ marginBottom: "32px", textAlign: "center" }}>
        <h1
          style={{
            fontSize: "32px",
            fontWeight: 800,
            marginBottom: "12px",
            color: "#111827",
          }}
        >
          特定商取引法に基づく表記
        </h1>
        <p style={{ margin: 0, fontSize: "16px", color: "#6b7280" }}>
          Act on Specified Commercial Transactions
        </p>
      </div>

      <section style={sectionStyle}>
        <h2 style={headingStyle}>事業者情報 / Business Information</h2>

        <div style={{ marginBottom: "18px" }}>
          <div style={{ ...labelStyle, background: "#eef2ff", color: "#3730a3" }}>事業者名 / Business Name</div>
          <p style={jaStyle}>EBI Dev Lab</p>
          <p style={enStyle}>EBI Dev Lab</p>
        </div>

        <div style={{ marginBottom: "18px" }}>
          <div style={{ ...labelStyle, background: "#eef2ff", color: "#3730a3" }}>代表者名 / Representative</div>
          <p style={jaStyle}>海老澤 享史</p>
          <p style={enStyle}>Takashi Ebisawa</p>
        </div>

        <div>
          <div style={{ ...labelStyle, background: "#eef2ff", color: "#3730a3" }}>所在地 / Address</div>
          <p style={jaStyle}>〒150-0021 東京都渋谷区恵比寿西2丁目4番8号ウィンド恵比寿ビル8F</p>
          <p style={enStyle}>Wind Ebisu Building 8F, 2-4-8 Ebisu Nishi, Shibuya-ku, Tokyo 150-0021, Japan</p>
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={headingStyle}>連絡先 / Contact</h2>
        <p style={jaStyle}>
          メールアドレス: ebidevlab.app@gmail.com
          <br />
          ※お問い合わせはメールにてお願いいたします。
        </p>
        <p style={enStyle}>
          Email: ebidevlab.app@gmail.com
          <br />
          Please contact us by email.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={headingStyle}>販売条件 / Sales Terms</h2>

        <div style={{ marginBottom: "18px" }}>
          <div style={{ ...labelStyle, background: "#ecfeff", color: "#155e75" }}>販売価格 / Sales Price</div>
          <p style={jaStyle}>各アプリ内課金画面に表示された金額（税込）とします。</p>
          <p style={enStyle}>The sales price is the amount displayed on the in-app purchase screen, including tax.</p>
        </div>

        <div style={{ marginBottom: "18px" }}>
          <div style={{ ...labelStyle, background: "#ecfeff", color: "#155e75" }}>
            商品代金以外の必要料金 / Additional Fees
          </div>
          <p style={jaStyle}>インターネット接続に必要な通信料金は、お客様のご負担となります。</p>
          <p style={enStyle}>Internet connection and communication charges are the responsibility of the customer.</p>
        </div>

        <div style={{ marginBottom: "18px" }}>
          <div style={{ ...labelStyle, background: "#ecfeff", color: "#155e75" }}>支払方法 / Payment Method</div>
          <p style={jaStyle}>Apple App Storeが定める支払方法に従います。</p>
          <p style={enStyle}>Payment shall be made according to the payment methods specified by the Apple App Store.</p>
        </div>

        <div>
          <div style={{ ...labelStyle, background: "#ecfeff", color: "#155e75" }}>支払時期 / Time of Payment</div>
          <p style={jaStyle}>各ストアの規約に基づき、購入時に決済されます。</p>
          <p style={enStyle}>Payment is processed at the time of purchase in accordance with the terms of each store.</p>
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={headingStyle}>提供時期・返品 / Delivery & Refund Policy</h2>

        <div style={{ marginBottom: "18px" }}>
          <div style={{ ...labelStyle, background: "#f0fdf4", color: "#166534" }}>商品の引渡時期 / Delivery Time</div>
          <p style={jaStyle}>決済完了後、直ちに利用可能となります。</p>
          <p style={enStyle}>The digital content becomes available immediately after payment is completed.</p>
        </div>

        <div>
          <div style={{ ...labelStyle, background: "#fef2f2", color: "#991b1b" }}>
            返品・キャンセルについて / Returns and Cancellations
          </div>
          <p style={jaStyle}>
            デジタルコンテンツの性質上、購入後の返品・キャンセルはできません。
            <br />
            ただし、各ストアの規約に基づき返金対応が行われる場合があります。
          </p>
          <p style={enStyle}>
            Due to the nature of digital content, returns and cancellations are generally not accepted after purchase.
            <br />
            However, refunds may be available in accordance with the policies of each store.
          </p>
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={headingStyle}>動作環境 / System Requirements</h2>
        <p style={jaStyle}>
          iOS対応端末にてご利用いただけます。
          <br />
          詳細はApp Storeの記載をご確認ください。
        </p>
        <p style={enStyle}>
          This app is available on compatible iOS devices.
          <br />
          Please refer to the App Store listing for details.
        </p>
      </section>

      <div
        style={{
          textAlign: "center",
          marginTop: "36px",
          color: "#6b7280",
          fontSize: "14px",
        }}
      >
        制定日：2026年4月
        <br />
        Effective Date: April 2026
      </div>
    </main>
  );
}