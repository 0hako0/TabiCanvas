import { Award } from 'lucide-react';
import { PREFECTURES, REGIONS } from '../data/prefectures';
import type { PrefectureVisit } from '../types';

type Props = {
  visits: PrefectureVisit[];
};

export function BadgePanel({ visits }: Props) {
  const visitedIds = new Set(visits.map((visit) => visit.prefecture_id));
  const badges = [
    { label: 'はじめての旅', unlocked: visits.length >= 1 },
    { label: '5県達成', unlocked: visitedIds.size >= 5 },
    { label: '10県達成', unlocked: visitedIds.size >= 10 },
    { label: '20県達成', unlocked: visitedIds.size >= 20 },
    { label: '47都道府県制覇', unlocked: visitedIds.size === 47 },
    ...REGIONS.map((region) => {
      const prefs = PREFECTURES.filter((prefecture) => prefecture.region === region);
      return {
        label: `${region}制覇`,
        unlocked: prefs.every((prefecture) => visitedIds.has(prefecture.id)),
      };
    }),
  ];

  return (
    <section className="panel badge-panel">
      <div className="section-title">
        <Award size={18} />
        <h2>制覇バッジ</h2>
      </div>
      <div className="badge-grid">
        {badges.map((badge) => (
          <span key={badge.label} className={`badge-chip ${badge.unlocked ? 'is-unlocked' : ''}`}>
            {badge.label}
          </span>
        ))}
      </div>
    </section>
  );
}
