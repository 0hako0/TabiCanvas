import { useEffect, useMemo, useState } from 'react';
import { Camera } from 'lucide-react';
import { PREFECTURES } from '../data/prefectures';
import type { PrefectureVisit, VisitPhoto } from '../types';

type CollagePhoto = {
  id: string;
  src: string;
  placeName: string;
  prefectureName: string;
  visitedOn: string;
  visit: PrefectureVisit;
};

type Props = {
  visits: PrefectureVisit[];
  onOpenVisit: (visit: PrefectureVisit) => void;
};

function getPhotoSrc(photo: VisitPhoto) {
  return photo.thumbnail_url ?? photo.public_url ?? photo.original_url ?? '';
}

export function MapPhotoCollage({ visits, onOpenVisit }: Props) {
  const [slideIndex, setSlideIndex] = useState(0);
  const photos = useMemo<CollagePhoto[]>(() => {
    return visits
      .flatMap((visit) => {
        const prefectureName = PREFECTURES.find((prefecture) => prefecture.id === visit.prefecture_id)?.name ?? '旅';
        return (visit.photos ?? []).map((photo) => ({
          id: photo.id,
          src: getPhotoSrc(photo),
          placeName: visit.place_name,
          prefectureName,
          visitedOn: visit.visited_on,
          visit,
        }));
      })
      .filter((photo) => photo.src)
      .slice(0, 12);
  }, [visits]);

  useEffect(() => {
    if (photos.length <= 5) return undefined;
    const timer = window.setInterval(() => {
      setSlideIndex((current) => (current + 1) % photos.length);
    }, 5200);
    return () => window.clearInterval(timer);
  }, [photos.length]);

  const visiblePhotos = useMemo(() => {
    if (photos.length <= 5) return photos;
    return Array.from({ length: 5 }, (_, index) => photos[(slideIndex + index) % photos.length]);
  }, [photos, slideIndex]);

  if (visiblePhotos.length === 0) return null;

  return (
    <div className="map-photo-collage" aria-label="地図の写真アルバム">
      {visiblePhotos.map((photo, index) => (
        <button
          key={`${photo.id}-${index}`}
          className={`map-polaroid-photo slot-${index + 1}`}
          type="button"
          onClick={() => onOpenVisit(photo.visit)}
          aria-label={`${photo.prefectureName} ${photo.placeName}の思い出を見る`}
        >
          <span className="map-polaroid-tape" aria-hidden="true" />
          <img src={photo.src} alt={`${photo.prefectureName} ${photo.placeName}の写真`} loading="lazy" decoding="async" />
          <span className="map-polaroid-caption">
            <Camera size={11} />
            {photo.prefectureName}
          </span>
        </button>
      ))}
    </div>
  );
}
