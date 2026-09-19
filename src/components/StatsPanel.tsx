import { BarChart3, Bed, MapPin, Trophy } from 'lucide-react';
import { PREFECTURES, REGIONS } from '../data/prefectures';
import type { PrefectureVisit } from '../types';

type Props = {
  visits: PrefectureVisit[];
};

export function StatsPanel({ visits }: Props) {
  const visitedIds = new Set(visits.map((visit) => visit.prefecture_id));
  const progress = Math.round((visitedIds.size / 47) * 100);
  const counts = visits.reduce<Map<number, number>>((map, visit) => {
    map.set(visit.prefecture_id, (map.get(visit.prefecture_id) ?? 0) + 1);
    return map;
  }, new Map());
  const ranking = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  const topName = ranking[0] ? PREFECTURES.find((pref) => pref.id === ranking[0][0])?.name : 'これから';
  const totalNights = visits.reduce((sum, visit) => sum + (visit.nights ?? 0), 0);

  return (
    <section className="stats-grid">
      <div className="stat-card hero-stat">
        <Trophy size={22} />
        <span>制覇率</span>
        <strong>{visitedIds.size}/47県</strong>
        <div className="progress-track">
          <div style={{ width: `${progress}%` }} />
        </div>
        <small>{progress}% 達成</small>
      </div>
      <div className="stat-card">
        <MapPin size={22} />
        <span>旅行回数</span>
        <strong>{visits.length}回</strong>
      </div>
      <div className="stat-card">
        <BarChart3 size={22} />
        <span>一番行った県</span>
        <strong>{topName}</strong>
      </div>
      <div className="stat-card">
        <Bed size={22} />
        <span>総宿泊数</span>
        <strong>{totalNights}泊</strong>
      </div>
      <div className="region-card">
        {REGIONS.map((region) => {
          const regionPrefs = PREFECTURES.filter((pref) => pref.region === region);
          const done = regionPrefs.filter((pref) => visitedIds.has(pref.id)).length;
          return (
            <div key={region} className="region-row">
              <span>{region}</span>
              <div className="mini-track">
                <div style={{ width: `${(done / regionPrefs.length) * 100}%` }} />
              </div>
              <small>
                {done}/{regionPrefs.length}
              </small>
            </div>
          );
        })}
      </div>
      {ranking.length > 0 && (
        <div className="ranking-card">
          <span className="ranking-card-label">訪問回数ランキング</span>
          <div className="ranking-chip-row">
            {ranking.map(([prefectureId, count], index) => (
              <span key={prefectureId} className="ranking-chip">
                <em>{index + 1}位</em>
                {PREFECTURES.find((pref) => pref.id === prefectureId)?.name}
                <b>{count}回</b>
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
