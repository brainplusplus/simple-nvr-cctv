import React, { useEffect, useMemo, useRef, useState } from 'react';
import LiveStreamPlayer from './LiveStreamPlayer';
import { camerasApi } from '../api/cameras';
import { usePlyr } from '../hooks/usePlyr';

interface CameraLivePlayerProps {
    cameraId: string;
    poster?: string;
    emptyLabel: string;
    errorLabel: string;
    controls?: boolean;
    autoPlay?: boolean;
    muted?: boolean;
    preferLowLatency?: boolean;
    allowFallback?: boolean;
    style?: React.CSSProperties;
}

const CameraLivePlayer: React.FC<CameraLivePlayerProps> = ({
    cameraId,
    poster,
    emptyLabel,
    errorLabel,
    controls = true,
    autoPlay = false,
    muted = true,
    preferLowLatency = false,
    allowFallback = true,
    style,
}) => {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const [transport, setTransport] = useState<'webrtc' | 'fallback'>(preferLowLatency ? 'webrtc' : 'fallback');
    const [showLoading, setShowLoading] = useState(preferLowLatency);

    const hlsUrl = useMemo(() => camerasApi.getLivePlaylistUrl(cameraId), [cameraId]);

    usePlyr(videoRef, controls && transport === 'webrtc');

    useEffect(() => {
        if (!cameraId) {
            setTransport('fallback');
            setShowLoading(false);
            return;
        }
        setTransport(preferLowLatency ? 'webrtc' : 'fallback');
        setShowLoading(preferLowLatency);
    }, [cameraId, preferLowLatency]);

    useEffect(() => {
        if (!preferLowLatency || !cameraId || transport !== 'webrtc') {
            return;
        }

        const video = videoRef.current;
        if (!video) {
            return;
        }

        let closed = false;
        let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
        let peer: RTCPeerConnection | null = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        });

        const closePeer = () => {
            if (fallbackTimer) {
                clearTimeout(fallbackTimer);
                fallbackTimer = null;
            }
            if (peer) {
                peer.ontrack = null;
                peer.onconnectionstatechange = null;
                peer.close();
                peer = null;
            }
        };

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

        const handlePlayable = () => {
            if (fallbackTimer) {
                clearTimeout(fallbackTimer);
                fallbackTimer = null;
            }
            if (!closed) {
                setShowLoading(false);
            }
        };

        video.addEventListener('loadeddata', handlePlayable);
        video.addEventListener('playing', handlePlayable);

        const connect = async () => {
            if (!peer) {
                return;
            }

            try {
                peer.addTransceiver('video', { direction: 'recvonly' });
                peer.ontrack = (event) => {
                    const [stream] = event.streams;
                    if (stream) {
                        video.srcObject = stream;
                        void attemptAutoplay();
                    }
                };
                peer.onconnectionstatechange = () => {
                    if (!peer || closed) {
                        return;
                    }
                    if (peer.connectionState === 'failed' || peer.connectionState === 'disconnected' || peer.connectionState === 'closed') {
                        closePeer();
                        if (allowFallback) {
                            setTransport('fallback');
                        }
                        setShowLoading(false);
                    }
                };

                const offer = await peer.createOffer();
                await peer.setLocalDescription(offer);

                const answer = await camerasApi.createWebRTCAnswer(cameraId, {
                    type: 'offer',
                    sdp: offer.sdp ?? '',
                });

                await peer.setRemoteDescription({ type: answer.type, sdp: answer.sdp });
            } catch {
                closePeer();
                if (!closed) {
                    if (allowFallback) {
                        setTransport('fallback');
                    }
                    setShowLoading(false);
                }
            }
        };

        void connect();
        fallbackTimer = setTimeout(() => {
            closePeer();
            if (!closed) {
                if (allowFallback) {
                    setTransport('fallback');
                }
                setShowLoading(false);
            }
        }, 8000);

        return () => {
            closed = true;
            video.removeEventListener('loadeddata', handlePlayable);
            video.removeEventListener('playing', handlePlayable);
            closePeer();
            if (video.srcObject) {
                const stream = video.srcObject as MediaStream;
                stream.getTracks().forEach((track) => {
                    track.stop();
                });
                video.srcObject = null;
            }
        };
    }, [allowFallback, autoPlay, cameraId, preferLowLatency, transport]);

    if (transport === 'fallback') {
        return (
            <LiveStreamPlayer
                src={hlsUrl}
                poster={poster}
                emptyLabel={emptyLabel}
                errorLabel={errorLabel}
                controls={controls}
                autoPlay={autoPlay}
                muted={muted}
                style={style}
            />
        );
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
            {showLoading && <div style={overlayStyle}>{emptyLabel}</div>}
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
    objectFit: 'cover',
    background: '#020617',
};

const overlayStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    display: 'grid',
    placeItems: 'center',
    background: 'linear-gradient(180deg, rgba(2, 6, 23, 0.35), rgba(2, 6, 23, 0.75))',
    color: '#e2e8f0',
    fontWeight: 600,
    textAlign: 'center',
    padding: '16px',
};

export default CameraLivePlayer;
