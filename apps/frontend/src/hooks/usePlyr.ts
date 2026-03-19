import { useEffect, type RefObject } from 'react';
import Plyr from 'plyr';

export function usePlyr(videoRef: RefObject<HTMLVideoElement | null>, enabled: boolean): void {
    useEffect(() => {
        if (!enabled || !videoRef.current) {
            return;
        }

        const player = new Plyr(videoRef.current, {
            controls: [
                'play-large',
                'restart',
                'rewind',
                'play',
                'fast-forward',
                'progress',
                'current-time',
                'mute',
                'volume',
                'settings',
                'pip',
                'fullscreen',
            ],
        });

        return () => {
            player.destroy();
        };
    }, [enabled, videoRef]);
}
