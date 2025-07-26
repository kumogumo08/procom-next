'use client';

import React, { useState, useEffect } from 'react';

interface CustomSNSLink {
  label: string;
  url: string;
  color?: string;
}

interface SNSButtonBlockProps {
  customLinks?: CustomSNSLink[];
  isEditable?: boolean;
  onChange?: (links: CustomSNSLink[]) => void;
}

const colorOptions = ['#1DA1F2', '#E1306C', '#6441A5', '#FF4500', '#28a745', '#000000', '#FF66CC'];

export default function SNSButtonBlock({
  customLinks = [],
  isEditable = false,
  onChange,
}: SNSButtonBlockProps) {
  const [links, setLinks] = useState<CustomSNSLink[]>(customLinks);
  const [newLink, setNewLink] = useState<CustomSNSLink>({
    label: '',
    url: '',
    color: colorOptions[0],
  });

  useEffect(() => {
    setLinks(customLinks);
  }, [customLinks]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNewLink((prev) => ({ ...prev, [name]: value }));
  };

  const handleColorSelect = (color: string) => {
    setNewLink((prev) => ({ ...prev, color }));
  };

const handleAddLink = () => {
  if (links.length >= 6) {
    alert('SNSボタンは最大6個までです。');
    return;
  }

  if (!newLink.label || !newLink.url) return;

  const updated = [...links, newLink];
  setLinks(updated);
  onChange?.(updated);
  setNewLink({ label: '', url: '', color: colorOptions[0] });
};

  const handleDelete = (index: number) => {
    const updated = links.filter((_, i) => i !== index);
    setLinks(updated);
    onChange?.(updated);
  };

return (
  <div
  className="mt-6"
  style={{
    maxWidth: '1200px',
    margin: '0 auto',
  }}
>
    {/* ✅ ボタンを中央に固定するラッパー */}
    <div className="w-full flex flex-wrap justify-center">
      <div className="max-w-[700px] w-full flex flex-wrap justify-center gap-4">
        {links.map((link, index) => (
          <div key={index} className="relative">
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-white font-semibold text-base shadow-lg hover:opacity-90 transition text-center inline-flex items-center justify-center"
            style={{
              backgroundColor: link.color || '#555',
              width: '100px',       // ✅ 幅を固定
              height: '100px',      // ✅ 高さも固定で正方形に
              borderRadius: '16px',// ✅ 角丸（お好みで調整、16〜20pxくらいが自然）
              overflow: 'hidden',  // ✅ テキストはみ出し防止
              fontSize: '20px',
              whiteSpace: 'normal',
              wordBreak: 'break-word',
            }}
          >
            {link.label}
          </a>

            {isEditable && (
              <button
                onClick={() => handleDelete(index)}
                className="absolute -top-2 -right-2 text-xs bg-red-600 text-white w-5 h-5 rounded-full"
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>
    </div>


      {isEditable && (
        <div className="mt-6 p-4 border rounded-md bg-gray-50">
          <h4 className="font-bold mb-2">SNSボタンを追加</h4>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <input
              type="text"
              name="label"
              value={newLink.label}
              onChange={handleChange}
              placeholder="名前 (例: Twitch)"
              className="border px-2 py-1 rounded"
            />
            <input
              type="text"
              name="url"
              value={newLink.url}
              onChange={handleChange}
              placeholder="URL"
              className="border px-2 py-1 rounded"
            />
          </div>

          <div className="mb-4">
            <p className="text-sm font-medium mb-1">ボタンの色を選んでください：</p>
            <div className="flex gap-2 flex-wrap">
              {colorOptions.map((color) => (
                <button
                  key={color}
                  onClick={() => handleColorSelect(color)}
                  style={{
                    backgroundColor: color,
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    border: newLink.color === color ? '2px solid #000' : '1px solid #ccc',
                  }}
                  aria-label={`色 ${color}`}
                />
              ))}
            </div>
          </div>

          <button
            onClick={handleAddLink}
            className="bg-blue-500 text-white px-4 py-1 rounded hover:bg-blue-600"
          >
            追加する
          </button>
        </div>
      )}
    </div>
  );
}
