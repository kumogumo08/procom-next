'use client';

import { useEffect, useState } from 'react';

type Props = {
    uid: string;
    isEditable: boolean;
};

export default function FacebookEmbedBlock({ uid, isEditable }: Props) {
    const [fbUrl, setFbUrl] = useState('');
    const [inputValue, setInputValue] = useState('');

    const isFacebookPage = (url: string) => {
        if (!url) return false;
        const domain = url.toLowerCase();
        return domain.startsWith('https://www.facebook.com/') &&
            !domain.includes('profile.php') &&
            !domain.includes('/people/');
    };

    useEffect(() => {
        const fetchFacebookUrl = async () => {
            try {
                const res = await fetch(`/api/user/${uid}`);
                if (!res.ok) throw new Error('取得失敗');
                const data = await res.json();
                const url = data.profile?.facebookUrl || '';
                setFbUrl(url);
                setInputValue(url);
            } catch (err) {
                console.error('❌ Facebook URL取得エラー:', err);
            }
        };
        fetchFacebookUrl();
    }, [uid]);

    useEffect(() => {
        // ✅ fb-rootが存在しない場合はbodyの先頭に追加
        if (!document.getElementById('fb-root')) {
            const fbRoot = document.createElement('div');
            fbRoot.id = 'fb-root';
            document.body.prepend(fbRoot);
        }

        // ✅ Facebook SDKのスクリプトが未読み込みなら追加
        if (fbUrl && isFacebookPage(fbUrl) && !document.getElementById('facebook-jssdk')) {
            const script = document.createElement('script');
            script.id = 'facebook-jssdk';
            script.src = 'https://connect.facebook.net/ja_JP/sdk.js#xfbml=1&version=v19.0';
            script.async = true;
            document.body.appendChild(script);
        }

        // ✅ すでにSDKが読み込まれている場合、再パース
        if (fbUrl && typeof window !== 'undefined' && window.FB) {
            setTimeout(() => {
                window.FB?.XFBML.parse();
            }, 500);
        }
    }, [fbUrl]);

    const handleSave = async () => {
        try {
            const res = await fetch(`/api/user/${uid}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    profile: { facebookUrl: inputValue }
                })
            });

            if (!res.ok) throw new Error('保存失敗');
            setFbUrl(inputValue);
            alert('✅ FacebookページURLを保存しました');
        } catch (err) {
            console.error('❌ 保存エラー:', err);
            alert('❌ FacebookページURLの保存に失敗しました');
        }
    };

    return (
        <div className="facebook-section">
            <h3>📘 Facebookページ</h3>

            {isEditable && (
                <>
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="https://www.facebook.com/xxxxxx"
                        style={{ width: '100%', padding: '8px' }}
                    />
                    <button onClick={handleSave} style={{ marginTop: '10px' }}>
                        保存して表示
                    </button>
                </>
            )}

            {/* ✅ 表示部分 */}
            {fbUrl && (
                <>
                    <div
                        id="fbEmbedContainer"
                        style={{
                            display: isFacebookPage(fbUrl) ? 'block' : 'none',
                            marginTop: '20px',
                        }}
                    >
                        <div
                            className="fb-page"
                            data-href={fbUrl}
                            data-tabs="timeline"
                            data-width=""
                            data-height=""
                            data-small-header="false"
                            data-adapt-container-width="true"
                            data-hide-cover="false"
                            data-show-facepile="true"
                        >
                            <blockquote cite={fbUrl} className="fb-xfbml-parse-ignore">
                                <a href={fbUrl}>Facebook</a>
                            </blockquote>
                        </div>
                    </div>

                    {/* 🔗 フォールバックボタンは常に表示 */}
                    <div style={{ marginTop: '20px', textAlign: 'center' }}>
                        <a
                            href={fbUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="facebook-button"
                            style={{
                                display: 'inline-block',
                                backgroundColor: '#1877f2',
                                color: '#fff',
                                padding: '8px 16px',
                                borderRadius: '5px',
                                textDecoration: 'none',
                                fontWeight: 'bold',
                            }}
                        >
                            <i
                                className="fab fa-facebook-square"
                                style={{ marginRight: '8px' }}
                            ></i>
                            Facebook プロフィールを見る
                        </a>
                    </div>
                </>
            )}
        </div>
    );
    }
