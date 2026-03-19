import React from 'react';
import VidstackPlayer from './VidstackPlayer';

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
    if (!src) {
        return <div style={fallbackStyle}>{emptyLabel}</div>;
    }

    return (
        <VidstackPlayer
            src={src}
            poster={poster}
            autoPlay={autoPlay}
            muted={muted}
            isLive={true}
            title={controls ? 'Live Stream' : 'NVR Preview'}
            style={{ ...containerStyle, ...style }}
        />
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
