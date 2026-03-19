import React from 'react';
import VidstackPlayer from './VidstackPlayer';

interface FileVideoPlayerProps {
    src: string;
    poster?: string;
    style?: React.CSSProperties;
}

const FileVideoPlayer: React.FC<FileVideoPlayerProps> = ({ src, poster, style }) => {
    return <VidstackPlayer src={src} poster={poster} style={style} title="Recording Playback" />;
};

export default FileVideoPlayer;
