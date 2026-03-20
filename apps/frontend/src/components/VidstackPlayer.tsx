import React, { useEffect, useMemo, useRef } from 'react';
import Hls from 'hls.js';
import { isHLSProvider } from 'vidstack';
import '../vidstack-setup';

interface VidstackPlayerProps {
    src: string;
    title?: string;
    poster?: string;
    autoPlay?: boolean;
    muted?: boolean;
    isLive?: boolean;
    style?: React.CSSProperties;
}

const VidstackPlayer: React.FC<VidstackPlayerProps> = ({
    src,
    title = 'Player',
    poster,
    autoPlay = false,
    muted = false,
    isLive = false,
    style,
}) => {
    const playerRef = useRef<HTMLElement | null>(null);

    const sourceType = useMemo(() => {
        const normalised = src.toLowerCase();
        if (normalised.includes('.m3u8')) {
            return 'application/x-mpegurl';
        }
        if (normalised.includes('.mp4')) {
            return 'video/mp4';
        }
        return undefined;
    }, [src]);

    useEffect(() => {
        const player = playerRef.current;
        if (!player) {
            return;
        }

        const onProviderChange = (event: Event) => {
            const provider = (event as CustomEvent).detail;
            if (isHLSProvider(provider)) {
                provider.library = Hls;
            }
        };

        player.addEventListener('provider-change', onProviderChange);
        return () => {
            player.removeEventListener('provider-change', onProviderChange);
        };
    }, []);

    const playerStyle = useMemo<React.CSSProperties>(() => ({
        width: '100%',
        height: '100%',
        aspectRatio: '16 / 9',
        background: '#020617',
        borderRadius: '18px',
        overflow: 'hidden',
        ...style,
    }), [style]);

    return (
        React.createElement(
            'media-player',
            {
                ref: playerRef,
                title,
                src,
                poster,
                autoplay: autoPlay ? '' : undefined,
                muted: muted ? '' : undefined,
                playsinline: '',
                crossorigin: '',
                'view-type': 'video',
                'stream-type': isLive ? 'live' : 'on-demand',
                style: playerStyle,
            },
            React.createElement(
                'media-provider',
                null,
                React.createElement('source', { src, type: sourceType }),
                poster ? React.createElement('media-poster', { alt: `${title} poster` }) : null,
            ),
            React.createElement('media-community-skin', null),
        )
    );
};

export default VidstackPlayer;
