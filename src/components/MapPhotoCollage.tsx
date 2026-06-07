import { useMemo } from 'react';
import { MapPin } from 'lucide-react';
import { PREFECTURES } from '../data/prefectures';
import type { PrefectureVisit, VisitPhoto } from '../types';

type CollagePhoto = {
  id: string;
  src: string;
  placeName: string;
  prefectureName: string;
  visit: PrefectureVisit;
};

type Props = {
  visits: PrefectureVisit[];
  isRefreshing?: boolean;
  onOpenVisit: (visit: PrefectureVisit) => void;
};

function getPhotoSrc(photo: VisitPhoto) {
  return photo.thumbnail_url ?? photo.public_url ?? photo.original_url ?? '';
}

export function MapPhotoCollage({ visits, isRefreshing = false, onOpenVisit }: Props) {
  const photos = useMemo<CollagePhoto[]>(() => {
    return visits
      .flatMap((visit) => {
        const prefectureName = PREFECTURES.find((prefecture) => prefecture.id === visit.prefecture_id)?.name ?? '旅';
        return (visit.photos ?? []).map((photo) => ({
          id: photo.id,
          src: getPhotoSrc(photo),
          placeName: visit.place_name,
          prefectureName,
          visit,
        }));
      })
      .filter((photo) => photo.src)
      .slice(0, 3);
  }, [visits]);

  if (photos.length === 0) return null;

  return (
    <div className={`map-photo-collage ${isRefreshing ? 'is-refreshing' : ''}`} aria-label="地図の写真アルバム">
      {photos.map((photo, index) => (
        <button
          key={`${photo.id}-${index}`}
          className={`map-polaroid-photo slot-${index + 1} ${index === 2 ? 'is-small' : 'is-medium'}`}
          type="button"
          onClick={() => onOpenVisit(photo.visit)}
          aria-label={`${photo.prefectureName} ${photo.placeName}の思い出を見る`}
        >
          <span className="map-polaroid-tape" aria-hidden="true" />
          <img
            src={photo.src}
            alt={`${photo.prefectureName} ${photo.placeName}の写真`}
            width={160}
            height={125}
            loading="lazy"
            decoding="async"
            onError={(event) => {
              event.currentTarget.closest('.map-polaroid-photo')?.setAttribute('hidden', 'true');
            }}
          />
          <span className="map-polaroid-caption">
            <span>
              <MapPin size={10} />
              {photo.prefectureName}
            </span>
            <strong>{photo.placeName}</strong>
          </span>
        </button>
      ))}
    </div>
  );
}
