import React, { useEffect, useRef } from 'react';
import Hls from 'hls.js';
import { usePlyr } from '../hooks/usePlyr';

interface LiveStreamPlayerProps {
    src: string;
    poster?: string;
    emptyLabel: string;
    errorLabel: string;
    controls?: boolean;
    autoPlay?: boolean;
    muted?: boolean;
    style?: React.CSSProperties;
}

const LiveStreamPlayer: React.FC<LiveStreamPlayerProps> = ({
    src,
    poster,
    emptyLabel,
    errorLabel: _errorLabel,
    controls = true,
    autoPlay = false,
    muted = true,
    style,
}) => {
    const videoRef = useRef<HTMLVideoElement | null>(null);

    usePlyr(videoRef, controls);

    useEffect(() => {
        const video = videoRef.current;
        if (!video || !src) {
            return;
        }

        let hls: Hls | null = null;
        let cancelled = false;

        const attemptAutoplay = async () => {
            if (!autoPlay) {
                return;
            }

            try {
                await video.play();
            } catch {
                return;
            }
        };

        const waitForPlaylist = async (): Promise<boolean> => {
            for (let attempt = 0; attempt < 30; attempt += 1) {
                if (cancelled) {
                    return false;
                }

                try {
                    const response = await fetch(src, { cache: 'no-store' });
                    if (response.ok) {
                        return true;
                    }
                } catch {
                    if (cancelled) {
                        return false;
                    }
                }

                await new Promise((resolve) => window.setTimeout(resolve, 1000));
            }

            return false;
        };

        void (async () => {
            const ready = await waitForPlaylist();
            if (!ready || cancelled) {
                return;
            }

            if (Hls.isSupported()) {
                hls = new Hls({ enableWorker: true, lowLatencyMode: false });
                hls.loadSource(src);
                hls.attachMedia(video);
                hls.on(Hls.Events.MANIFEST_PARSED, () => {
                    if (!cancelled) {
                        void attemptAutoplay();
                    }
                });
                return;
            }

            if (video.canPlayType('application/vnd.apple.mpegurl')) {
                video.src = src;
                void attemptAutoplay();
            }
        })();

        return () => {
            cancelled = true;
            if (hls) {
                hls.destroy();
            }
            video.pause();
            video.removeAttribute('src');
            video.load();
        };
    }, [autoPlay, src]);

    if (!src) {
        return <div style={fallbackStyle}>{emptyLabel}</div>;
    }

    return (
        <div style={{ ...containerStyle, ...style }}>
            <video
                ref={videoRef}
                controls={controls}
                muted={muted}
                playsInline
                poster={poster}
                style={videoStyle}
            >
                <track kind="captions" label="Captions unavailable" />
            </video>
        </div>
    );
};

const containerStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    height: '100%',
    background: '#020617',
    borderRadius: '18px',
    overflow: 'hidden',
};

const videoStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    background: '#020617',
    objectFit: 'cover',
};

const fallbackStyle: React.CSSProperties = {
    width: '100%',
    minHeight: '240px',
    display: 'grid',
    placeItems: 'center',
    borderRadius: '18px',
    background: '#020617',
    color: '#cbd5e1',
    padding: '24px',
    textAlign: 'center',
};

export default LiveStreamPlayer;
