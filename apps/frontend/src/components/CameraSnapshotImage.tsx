import React, { useEffect, useState } from 'react';

interface CameraSnapshotImageProps {
    src: string;
    alt: string;
    style?: React.CSSProperties;
    fallbackLabel: string;
    refreshIntervalMs?: number;
}

const CameraSnapshotImage: React.FC<CameraSnapshotImageProps> = ({ src, alt, style, fallbackLabel, refreshIntervalMs }) => {
    const [objectUrl, setObjectUrl] = useState<string | null>(null);

    useEffect(() => {
        if (!src) {
            return;
        }

        let cancelled = false;
        let nextObjectUrl: string | null = null;
        let timerId: number | null = null;

        const loadSnapshot = async () => {
            try {
                const response = await fetch(src);
                if (!response.ok) {
                    return;
                }

                const blob = await response.blob();
                nextObjectUrl = URL.createObjectURL(blob);
                if (!cancelled) {
                    setObjectUrl((current) => {
                        if (current) {
                            URL.revokeObjectURL(current);
                        }
                        return nextObjectUrl;
                    });
                }
            } catch {
                return;
            }

            if (!cancelled && refreshIntervalMs && refreshIntervalMs > 0) {
                timerId = window.setTimeout(() => {
                    void loadSnapshot();
                }, refreshIntervalMs);
            }
        };

        void loadSnapshot();

        return () => {
            cancelled = true;
            if (timerId !== null) {
                window.clearTimeout(timerId);
            }
            if (nextObjectUrl) {
                URL.revokeObjectURL(nextObjectUrl);
            }
        };
    }, [refreshIntervalMs, src]);

    if (!objectUrl) {
        return <div style={{ ...fallbackStyle, ...style }}>{fallbackLabel}</div>;
    }

    return <img src={objectUrl} alt={alt} style={style} />;
};

const fallbackStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    display: 'grid',
    placeItems: 'center',
    color: '#cbd5e1',
    background: '#0f172a',
    textAlign: 'center',
    padding: '16px',
};

export default CameraSnapshotImage;
