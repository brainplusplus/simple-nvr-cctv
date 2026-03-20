import React from 'react';

interface FileVideoPlayerProps {
    src: string;
    poster?: string;
    style?: React.CSSProperties;
}

const FileVideoPlayer: React.FC<FileVideoPlayerProps> = ({ src, poster, style }) => {
    const videoRef = React.useRef<HTMLVideoElement | null>(null);

    React.useEffect(() => {
        const video = videoRef.current;
        if (!video || !src) {
            return;
        }

        void video.play().catch(() => undefined);
    }, [src]);

    return (
        <video
            ref={videoRef}
            src={src}
            controls={true}
            preload="metadata"
            poster={poster}
            style={{ width: '100%', maxHeight: '520px', background: '#020617', ...style }}
        >
            <track kind="captions" srcLang="en" label="Captions unavailable" src="data:text/vtt,WEBVTT" />
        </video>
    );
};

export default FileVideoPlayer;
