import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { useMapStore } from '../../store';
import { useDataStore } from '../../store';
import { fitMapToPoints } from '../../utils/mapUtils';

export function FitViewControl() {
  const map = useMap();
  const currentFileId = useMapStore((state) => state.currentFileId);
  const fitToViewTrigger = useMapStore((state) => state.fitToViewTrigger);
  const points = useDataStore((state) => state.points);
  const currentFileIdRef = useRef(currentFileId);
  const pointsRef = useRef(points);

  // 监听触发器变化
  useEffect(() => {
    currentFileIdRef.current = currentFileId;
    pointsRef.current = points;
    
    if (fitToViewTrigger > 0 && currentFileIdRef.current) {
      const currentPoints = pointsRef.current.get(currentFileIdRef.current) || [];
      fitMapToPoints(map, currentPoints, { padding: [50, 50], maxZoom: 24 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitToViewTrigger, currentFileId, points]);

  useEffect(() => {
    const FitViewButton = L.Control.extend({
      options: { position: 'topleft' },

      onAdd: function () {
        const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
        const button = L.DomUtil.create('a', 'leaflet-control-fit-view', container);

        button.innerHTML = `
          <svg width="20" height="20" viewBox="0 0 20 20" style="display: block; margin: 5px auto;">
            <path d="M2 2 L2 6 M2 2 L6 2" stroke="currentColor" stroke-width="2" fill="none"/>
            <path d="M18 2 L18 6 M18 2 L14 2" stroke="currentColor" stroke-width="2" fill="none"/>
            <path d="M2 18 L2 14 M2 18 L6 18" stroke="currentColor" stroke-width="2" fill="none"/>
            <path d="M18 18 L18 14 M18 18 L14 18" stroke="currentColor" stroke-width="2" fill="none"/>
          </svg>
        `;
        button.href = '#';
        button.title = '适应所有点位';
        button.style.width = '30px';
        button.style.height = '30px';
        button.style.display = 'flex';
        button.style.alignItems = 'center';
        button.style.justifyContent = 'center';

        L.DomEvent.on(button, 'click', function (e) {
          L.DomEvent.stopPropagation(e);
          L.DomEvent.preventDefault(e);
          if (currentFileIdRef.current) {
            const currentPoints = pointsRef.current.get(currentFileIdRef.current) || [];
            fitMapToPoints(map, currentPoints, { padding: [50, 50], maxZoom: 24 });
          }
        });

        return container;
      },
    });

    const control = new FitViewButton();
    map.addControl(control);

    return () => {
      map.removeControl(control);
    };
  }, [map]);

  return null;
}
