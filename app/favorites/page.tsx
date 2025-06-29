"use client";

import { useEffect, useState } from 'react'
import Head from 'next/head'

type FavoriteUser = {
  username: string
  name?: string
  title?: string
  photoUrl?: string
}

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<FavoriteUser[]>([])
  const [message, setMessage] = useState('')
  const [headerHtml, setHeaderHtml] = useState('')
  const [footerHtml, setFooterHtml] = useState('')

  useEffect(() => {
    fetch('/header.html')
      .then(res => res.text())
      .then(setHeaderHtml)

    fetch('/footer.html')
      .then(res => res.text())
      .then(setFooterHtml)

    const fetchFavorites = async () => {
      try {
        const sessionRes = await fetch('/session')
        const sessionData = await sessionRes.json()

        if (!sessionData.loggedIn) {
          setMessage('お気に入りを表示するにはログインが必要です。')
          return
        }

        const res = await fetch(`/api/favorites/users?uid=${sessionData.uid}`);
        if (!res.ok) throw new Error('取得失敗')
        const data: FavoriteUser[] = await res.json()

        if (data.length === 0) {
          setMessage('お気に入りに登録されたユーザーはいません。')
          return
        }

        setFavorites(data)
      } catch (err) {
        setMessage('データの取得に失敗しました。')
        console.error('❌ お気に入り取得エラー:', err)
      }
    }

    fetchFavorites()
  }, [])

  return (
    <>
      <Head>
        <title>お気に入り一覧 - Procom</title>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>

      <div dangerouslySetInnerHTML={{ __html: headerHtml }} />

      <header style={{ textAlign: 'center', padding: '1.5em 0' }}>
        <h1>お気に入り一覧</h1>
      </header>

      <main>
        <div id="message" style={{ textAlign: 'center', padding: '1em', color: 'red' }}>{message}</div>
        <div className="user-list">
          {favorites.map((user, i) => (
            <div className="user-card" key={i}>
              <img
                src={user.photoUrl || '/default-icon.png'}
                alt="icon"
                style={{ width: '80px', borderRadius: '50%', marginBottom: '10px' }}
              />
              <h3>{user.name || user.username}</h3>
              <p>{user.title ? `（${user.title}）` : ''}</p>
              <a href={`/user/${user.username}`}>▶ プロフィールを見る</a>
            </div>
          ))}
        </div>
      </main>

      <div dangerouslySetInnerHTML={{ __html: footerHtml }} />

      <style jsx>{`
        .user-list {
          display: flex;
          flex-wrap: wrap;
          gap: 20px;
          padding: 20px;
          justify-content: center;
        }

        .user-card {
          border: 1px solid #ccc;
          padding: 15px;
          margin: 10px;
          border-radius: 12px;
          background: #fdfdfd;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
          transition: 0.2s;
          max-width: 250px;
          text-align: center;
        }

        .user-card:hover {
          background: #f4faff;
          transform: translateY(-2px);
        }
      `}</style>
    </>
  )
}
