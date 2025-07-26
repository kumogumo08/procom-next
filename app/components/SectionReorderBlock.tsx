'use client';

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState } from 'react';

interface Props {
  sectionOrder: string[];
  onChange: (newOrder: string[]) => void;
  onSave: () => void;
  onCancel: () => void;
}

export default function SectionReorderBlock({
  sectionOrder,
  onChange,
  onSave,
  onCancel,
}: Props) {
  const [items, setItems] = useState(sectionOrder);

  const sensors = useSensors(useSensor(PointerSensor));

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      const oldIndex = items.indexOf(active.id);
      const newIndex = items.indexOf(over.id);
      const newOrder = arrayMove(items, oldIndex, newIndex);
      setItems(newOrder);
      onChange(newOrder);
    }
  };

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <h3 style={{ textAlign: 'center', fontSize: '1.2rem', marginBottom: 16 }}>
        セクションの順番をドラッグで変更
      </h3>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items} strategy={verticalListSortingStrategy}>
          {items.map((key) => (
            <SortableItem key={key} id={key} />
          ))}
        </SortableContext>
      </DndContext>

      <div
        style={{
          marginTop: 24,
          display: 'flex',
          justifyContent: 'center',
          gap: 16,
        }}
      >
        <button
          onClick={onSave}
          style={{
            backgroundColor: '#22c55e',
            color: '#fff',
            padding: '10px 20px',
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          ✅ 保存する
        </button>
        <button
          onClick={onCancel}
          style={{
            backgroundColor: '#ccc',
            padding: '10px 20px',
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          キャンセル
        </button>
      </div>
    </div>
  );
}

function SortableItem({ id }: { id: string }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    padding: 12,
    marginBottom: 12,
    backgroundColor: isDragging ? '#e0f7ff' : '#f8f8f8',
    borderRadius: 6,
    border: '1px solid #ccc',
    cursor: 'grab',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <span>{getSectionLabel(id)}</span>
      <span style={{ fontSize: '1.2rem', color: '#888' }}>≡</span>
    </div>
  );
}

function getSectionLabel(key: string) {
  const labels: Record<string, string> = {
    YouTube: 'YouTube動画',
    X: 'X（旧Twitter）',
    Instagram: 'Instagram投稿',
    TikTok: 'TikTok動画',
    Facebook: 'Facebookページ',
    BannerLinks: 'バナーリンク',
    SNSButtons: 'SNSボタン',
  };
  return labels[key] || key;
}
