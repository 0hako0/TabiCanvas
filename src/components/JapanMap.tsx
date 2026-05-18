import japan from '@svg-maps/japan';
import { PREFECTURES } from '../data/prefectures';
import type { Prefecture } from '../types';

type SvgMapLocation = {
  id: string;
  name: string;
  path: string;
};

type Props = {
  selectedId: number;
  visitCounts: Map<number, number>;
  onSelect: (prefecture: Prefecture) => void;
  onPreview?: (prefecture: Prefecture) => void;
};

const SVG_ID_TO_PREFECTURE_ID: Record<string, number> = {
  hokkaido: 1,
  aomori: 2,
  iwate: 3,
  miyagi: 4,
  akita: 5,
  yamagata: 6,
  fukushima: 7,
  ibaraki: 8,
  tochigi: 9,
  gunma: 10,
  saitama: 11,
  chiba: 12,
  tokyo: 13,
  kanagawa: 14,
  niigata: 15,
  toyama: 16,
  ishikawa: 17,
  fukui: 18,
  yamanashi: 19,
  nagano: 20,
  gifu: 21,
  shizuoka: 22,
  aichi: 23,
  mie: 24,
  shiga: 25,
  kyoto: 26,
  osaka: 27,
  hyogo: 28,
  nara: 29,
  wakayama: 30,
  tottori: 31,
  shimane: 32,
  okayama: 33,
  hiroshima: 34,
  yamaguchi: 35,
  tokushima: 36,
  kagawa: 37,
  ehime: 38,
  kochi: 39,
  fukuoka: 40,
  saga: 41,
  nagasaki: 42,
  kumamoto: 43,
  oita: 44,
  miyazaki: 45,
  kagoshima: 46,
  okinawa: 47,
};

const PREFECTURE_BY_ID = new Map(PREFECTURES.map((prefecture) => [prefecture.id, prefecture]));

export function JapanMap({ selectedId, visitCounts, onSelect, onPreview }: Props) {
  return (
    <div className="map-card" aria-label="日本地図">
      <div className="map-toolbar">
        <div>
          <p className="eyebrow">Japan map</p>
          <h2>47都道府県マップ</h2>
        </div>
        <div className="map-legend" aria-label="訪問回数の凡例">
          <span className="legend-swatch visit-0" />0
          <span className="legend-swatch visit-2" />2
          <span className="legend-swatch visit-4" />4+
        </div>
      </div>

      <svg viewBox={japan.viewBox} role="img" className="japan-map prefecture-map">
        <title>都道府県別の訪問状況</title>
        <defs>
          <pattern id="paper-texture" width="8" height="8" patternUnits="userSpaceOnUse">
            <path d="M0 3.5 H8 M3.5 0 V8" className="map-texture-line" />
          </pattern>
        </defs>
        {(japan.locations as SvgMapLocation[]).map((location) => {
          const prefectureId = SVG_ID_TO_PREFECTURE_ID[location.id];
          const prefecture = PREFECTURE_BY_ID.get(prefectureId);
          if (!prefecture) return null;
          const count = visitCounts.get(prefecture.id) ?? 0;
          const isSelected = selectedId === prefecture.id;

          return (
            <path
              key={location.id}
              d={location.path}
              role="button"
              tabIndex={0}
              className={`prefecture-path visit-${Math.min(count, 4)} ${isSelected ? 'is-selected' : ''}`}
              aria-label={`${prefecture.name} ${count}回訪問`}
              onMouseEnter={() => onPreview?.(prefecture)}
              onFocus={() => onPreview?.(prefecture)}
              onClick={() => onSelect(prefecture)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') onSelect(prefecture);
              }}
            >
              <title>{`${prefecture.name} ${count}回訪問`}</title>
            </path>
          );
        })}
      </svg>
    </div>
  );
}
