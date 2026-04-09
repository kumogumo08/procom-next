import Image from 'next/image';

import { BENTO_FEATURES } from './bentoFeatures';
import styles from './top.module.css';

function BentoCardImage({ src, mediaClassName }: { src: string | null; mediaClassName: string }) {
  if (!src) return null;
  return (
    <div className={`${styles.bentoCardMedia} ${mediaClassName}`.trim()}>
      <Image
        src={src}
        alt=""
        fill
        sizes="(max-width: 767px) 92vw, (max-width: 919px) 90vw, 440px"
        className={styles.bentoCardMediaImg}
        priority={false}
      />
    </div>
  );
}

export default function TopLandingBento() {
  const [wide, videoPhoto, search, mobileProfile] = BENTO_FEATURES;

  return (
    <section className={styles.bentoSection} aria-labelledby="bento-heading">
      <div className={styles.bentoInner}>
        <h2 id="bento-heading" className={styles.bentoTitle}>
          できること
        </h2>
        <p className={styles.bentoLead}>機能名より、あなたにとってのメリットを伝えます。</p>

        <article className={`${styles.bentoCell} ${styles.bentoWide}`}>
          <BentoCardImage src={wide.imageSrc} mediaClassName={styles.bentoCardMediaWide} />
          <div className={styles.bentoCardBody}>
            <h3 className={styles.bentoCellTitle}>{wide.title}</h3>
            <p className={styles.bentoCellDesc}>{wide.description}</p>
          </div>
        </article>

        <div className={styles.bentoSplit}>
          <article className={`${styles.bentoCell} ${styles.bentoTall}`}>
            <BentoCardImage src={mobileProfile.imageSrc} mediaClassName={styles.bentoCardMediaMobile} />
            <div className={styles.bentoCardBody}>
              <h3 className={styles.bentoCellTitle}>{mobileProfile.title}</h3>
              <p className={styles.bentoCellDesc}>{mobileProfile.description}</p>
            </div>
          </article>
          <div className={styles.bentoStack}>
            <article className={`${styles.bentoCell} ${styles.bentoCompact} ${styles.bentoCompactSearch}`}>
              <BentoCardImage src={search.imageSrc} mediaClassName={styles.bentoCardMediaSearch} />
              <div className={styles.bentoCardBody}>
                <h3 className={styles.bentoCellTitle}>{search.title}</h3>
                <p className={styles.bentoCellDesc}>{search.description}</p>
              </div>
            </article>
            <article className={`${styles.bentoCell} ${styles.bentoCompact} ${styles.bentoCompactVideo}`}>
              <BentoCardImage src={videoPhoto.imageSrc} mediaClassName={styles.bentoCardMediaTall} />
              <div className={styles.bentoCardBody}>
                <h3 className={styles.bentoCellTitle}>{videoPhoto.title}</h3>
                <p className={styles.bentoCellDesc}>{videoPhoto.description}</p>
              </div>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
}
