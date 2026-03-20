import React, { useEffect, useRef } from 'react';
import { usePlyr } from '../hooks/usePlyr';

interface FileVideoPlayerProps {
    src: string;
    poster?: string;
    style?: React.CSSProperties;
}

const FileVideoPlayer: React.FC<FileVideoPlayerProps> = ({ src, poster, style }) => {
    const videoRef = useRef<HTMLVideoElement | null>(null);

    usePlyr(videoRef, true);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) {
            return;
        }

        video.src = src;
        video.load();
        void video.play().catch(() => undefined);

        return () => {
            video.pause();
            video.removeAttribute('src');
            video.load();
        };
    }, [src]);

    return (
        <video
            ref={videoRef}
            controls={true}
            preload="metadata"
            poster={poster}
            style={{ width: '100%', maxHeight: '520px', background: '#020617', ...style }}
        >
            <track kind="captions" label="Captions unavailable" />
        </video>
    );
};

export default FileVideoPlayer;
