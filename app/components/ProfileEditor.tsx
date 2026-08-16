'use client';

import { useState, useRef, useEffect } from 'react';

const TEN_QUESTIONS_TEMPLATE = `＼＼ 10の質問 ／／

1. 活動ジャンルは？
2. 一番好きな作品・活動は？
3. 得意なことは？
4. 苦手なことは？
5. 黒歴史は…ある？
6. 好きな時間の過ごし方は？
7. 無人島に1つだけ持ってくなら？
8. 最近ハマって？いることは？
9. これからの目標は？
10. 最後に一言！`;

type Props = {
  uid: string;
  initialName?: string;
  initialTitle?: string;
  initialBio?: string;
  isEditable: boolean;
  onDraftChange?: (draft: { name: string; title: string; bio: string }) => void;
};

// 改行＋XSS対策用のエスケープ関数
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default function ProfileEditor({
  initialName = '',
  initialTitle = '',
  initialBio = '',
  isEditable,
  onDraftChange,
}: Props) {
  const [name, setName] = useState(initialName);
  const [title, setTitle] = useState(initialTitle);
  const [bio, setBio] = useState(initialBio);
  const [isEditing, setIsEditing] = useState(false);

  const nameCleared = useRef(false);
  const titleCleared = useRef(false);
  const bioCleared = useRef(false);

  const latestProfileRef = useRef({
    name: initialName,
    title: initialTitle,
    bio: initialBio,
  });

  useEffect(() => {
    onDraftChange?.({ name, title, bio });
  }, [name, title, bio, onDraftChange]);

  const handleFinishEditing = () => {
    latestProfileRef.current = { name, title, bio };
    nameCleared.current = false;
    titleCleared.current = false;
    bioCleared.current = false;
    setIsEditing(false);
  };

  const handleCancel = () => {
    // ✅ 最新状態に戻す（初期値ではなく）
    setName(latestProfileRef.current.name);
    setTitle(latestProfileRef.current.title);
    setBio(latestProfileRef.current.bio);

    nameCleared.current = false;
    titleCleared.current = false;
    bioCleared.current = false;
    setIsEditing(false);
  };

  return (
    <div className="profile-info">
      {/* 上部表示部分：常に表示 */}
      <h2 id="nameTitle">
        <span id="name">{name}</span>
        <span id="title">{title && `（${title}）`}</span>
      </h2>

      {bio.trim() !== '' && (
        <div
          id="bio"
          dangerouslySetInnerHTML={{
            __html: escapeHtml(bio).replace(/\n/g, '<br>'),
          }}
        />
      )}

      {isEditable && (
        <>
          {!isEditing ? (
            <div id="edit-section" className="auth-only">
              <button id="editBtn" onClick={() => setIsEditing(true)}>
                プロフィールを編集
              </button>
            </div>
          ) : (
            <div className="editFormOverlay">
              <button
                className="close-btn"
                onClick={handleCancel}
                aria-label="閉じる"
              >
                ✖
              </button>

              <h3 style={{ fontSize: '1.3rem', marginBottom: '1rem' }}>プロフィール編集</h3>

              <div className="form-row">
                <label htmlFor="nameInput">名前：</label>
                <div className="input-with-delete">
                  <input
                    type="text"
                    id="nameInput"
                    value={name}
                    onChange={e => {
                      setName(e.target.value);
                      nameCleared.current = false;
                    }}
                  />
                  <button
                    type="button"
                    className="delete-btn"
                    onClick={() => {
                      setName('');
                      nameCleared.current = true;
                    }}
                  >
                    ✖
                  </button>
                </div>
              </div>
              <div className="form-row">
              <label htmlFor="titleInput">肩書：</label>
              <div className="input-with-delete">
                <input
                  type="text"
                  id="titleInput"
                  value={title}
                  onChange={e => {
                    setTitle(e.target.value);
                    titleCleared.current = false;
                  }}
                />
                <button
                  type="button"
                  className="delete-btn"
                  onClick={() => {
                    setTitle('');
                    titleCleared.current = true;
                  }}
                >
                  ✖
                </button>
              </div>
            </div>
              <div className="form-row">
                <label htmlFor="bioInput">プロフィール：</label>
                <div className="input-with-delete">
                  <textarea
                    id="bioInput"
                    rows={30}
                    style={{
                      width: '100%',
                      minHeight: '300px',
                      padding: '12px',
                      fontSize: '1rem',
                      boxSizing: 'border-box',
                      borderRadius: '6px',
                      border: '1px solid #ccc',
                      resize: 'vertical',
                    }}
                    value={bio}
                    onChange={e => {
                      setBio(e.target.value);
                      bioCleared.current = false;
                    }}
                  />
                  <button
                    type="button"
                    className="delete-btn"
                    onClick={() => {
                      setBio('');
                      bioCleared.current = true;
                    }}
                  >
                    ✖
                  </button>
                </div>
                </div>
                {/* 🔽 このボタンを追加！ */}
              <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                <button
                  onClick={() => setBio(prev => prev + '\n\n' + TEN_QUESTIONS_TEMPLATE)}
                  className="ten-questions-btn"
                >
                  🎀 10の質問を挿入する
                </button>
              </div>
              <button type="button" id="saveBtn" onClick={handleFinishEditing}>
                完了
              </button>
              <button type="button" id="cancelBtn" onClick={handleCancel}>
                キャンセル
              </button>
            </div>
            
          )}
        </>
      )}
    </div>
  );
}