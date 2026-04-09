import styles from './top.module.css';

export default function TopLandingBento() {
  return (
    <section className={styles.bentoSection} aria-labelledby="bento-heading">
      <div className={styles.bentoInner}>
        <h2 id="bento-heading" className={styles.bentoTitle}>
          できること
        </h2>
        <p className={styles.bentoLead}>機能名より、あなたにとってのメリットを伝えます。</p>

        <article className={`${styles.bentoCell} ${styles.bentoWide}`}>
          <h3 className={styles.bentoCellTitle}>SNSも実績も、1ページで伝わる</h3>
          <p className={styles.bentoCellDesc}>
            リンクが増えても、公式の入口はこれひとつ。見せたい順に並べられます。
          </p>
        </article>

        <div className={styles.bentoSplit}>
          <article className={`${styles.bentoCell} ${styles.bentoTall}`}>
            <h3 className={styles.bentoCellTitle}>動画や写真で、活動を見せられる</h3>
            <p className={styles.bentoCellDesc}>
              埋め込みやスライドで、静止画だけでは足りない魅力も補います。
            </p>
          </article>
          <div className={styles.bentoStack}>
            <article className={`${styles.bentoCell} ${styles.bentoCompact}`}>
              <h3 className={styles.bentoCellTitle}>検索から、新しい出会いが生まれる</h3>
              <p className={styles.bentoCellDesc}>
                名前や肩書きで見つけてもらい、ファンやクライアントにつながります。
              </p>
            </article>
            <article className={`${styles.bentoCell} ${styles.bentoCompact}`}>
              <h3 className={styles.bentoCellTitle}>スマホでも、読みやすいプロフィール</h3>
              <p className={styles.bentoCellDesc}>
                発信に追いつく表示設計。外出先からも更新しやすい体験です。
              </p>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
}
