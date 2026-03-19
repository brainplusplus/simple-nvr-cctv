package services

import (
	"context"
	"fmt"
	"net"
	"os/exec"
	"sync"
	"time"

	"simple-nvr-cctv/internal/models"

	"github.com/pion/rtp"
	"github.com/pion/webrtc/v4"
)

type WebRTCSessionDescription struct {
	Type string `json:"type"`
	SDP  string `json:"sdp"`
}

func (s *RecordingService) CreateWebRTCAnswer(ctx context.Context, cameraID string, offer WebRTCSessionDescription) (*WebRTCSessionDescription, error) {
	if s.cameraRepo == nil {
		return nil, fmt.Errorf("camera repository is not configured")
	}

	camera, err := s.cameraRepo.Get(ctx, cameraID)
	if err != nil {
		return nil, err
	}

	mediaEngine := &webrtc.MediaEngine{}
	if err := mediaEngine.RegisterDefaultCodecs(); err != nil {
		return nil, err
	}

	api := webrtc.NewAPI(webrtc.WithMediaEngine(mediaEngine))
	peerConnection, err := api.NewPeerConnection(webrtc.Configuration{})
	if err != nil {
		return nil, err
	}

	videoTrack, err := webrtc.NewTrackLocalStaticRTP(
		webrtc.RTPCodecCapability{
			MimeType:    webrtc.MimeTypeH264,
			ClockRate:   90000,
			Channels:    0,
			SDPFmtpLine: "level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f",
		},
		"video",
		cameraID,
	)
	if err != nil {
		peerConnection.Close()
		return nil, err
	}

	rtpSender, err := peerConnection.AddTrack(videoTrack)
	if err != nil {
		peerConnection.Close()
		return nil, err
	}

	go drainRTCP(rtpSender)

	packetConn, err := net.ListenPacket("udp4", "127.0.0.1:0")
	if err != nil {
		peerConnection.Close()
		return nil, err
	}

	var (
		cleanupOnce sync.Once
		cancel      context.CancelFunc
		process     ManagedProcess
	)

	cleanup := func() {
		cleanupOnce.Do(func() {
			if cancel != nil {
				cancel()
			}
			if process != nil {
				_ = process.Stop(2 * time.Second)
			}
			_ = packetConn.Close()
			_ = peerConnection.Close()
		})
	}

	peerConnection.OnConnectionStateChange(func(state webrtc.PeerConnectionState) {
		s.cfg.Logger.Printf("camera=%s webrtc_state=%s", cameraID, state.String())
		switch state {
		case webrtc.PeerConnectionStateFailed, webrtc.PeerConnectionStateClosed, webrtc.PeerConnectionStateDisconnected:
			cleanup()
		}
	})

	remoteOffer, err := toWebRTCSDP(offer)
	if err != nil {
		cleanup()
		return nil, err
	}
	if err := peerConnection.SetRemoteDescription(remoteOffer); err != nil {
		cleanup()
		return nil, err
	}

	answer, err := peerConnection.CreateAnswer(nil)
	if err != nil {
		cleanup()
		return nil, err
	}
	gatherComplete := webrtc.GatheringCompletePromise(peerConnection)
	if err := peerConnection.SetLocalDescription(answer); err != nil {
		cleanup()
		return nil, err
	}
	<-gatherComplete

	go forwardRTPToTrack(packetConn, videoTrack, cleanup)

	process, cancel, err = s.startWebRTCProcess(*camera, packetConn.LocalAddr().(*net.UDPAddr).Port)
	if err != nil {
		cleanup()
		return nil, err
	}

	local := peerConnection.LocalDescription()
	if local == nil {
		cleanup()
		return nil, fmt.Errorf("failed to build local session description")
	}

	return &WebRTCSessionDescription{Type: local.Type.String(), SDP: local.SDP}, nil
}

func (s *RecordingService) startWebRTCProcess(camera models.Camera, port int) (ManagedProcess, context.CancelFunc, error) {
	ctx, cancel := context.WithCancel(context.Background())
	args := []string{
		"-hide_banner",
		"-loglevel", "warning",
		"-rtsp_transport", "tcp",
		"-analyzeduration", "10000000",
		"-probesize", "10000000",
		"-i", camera.RTSPURL,
		"-an",
		"-c:v", "libx264",
		"-preset", "ultrafast",
		"-tune", "zerolatency",
		"-pix_fmt", "yuv420p",
		"-profile:v", "baseline",
		"-level", "3.1",
		"-x264-params", "repeat-headers=1",
		"-g", "30",
		"-keyint_min", "30",
		"-sc_threshold", "0",
		"-f", "rtp",
		fmt.Sprintf("rtp://127.0.0.1:%d?pkt_size=1200", port),
	}

	cmd := exec.CommandContext(ctx, s.cfg.FFmpegBinary, args...)
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		cancel()
		return nil, nil, err
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		cancel()
		return nil, nil, err
	}
	if err := cmd.Start(); err != nil {
		cancel()
		return nil, nil, err
	}

	go logPipe(s.cfg.Logger, camera.ID, "webrtc-stdout", stdout)
	go logPipe(s.cfg.Logger, camera.ID, "webrtc-stderr", stderr)

	return &execManagedProcess{cmd: cmd}, cancel, nil
}

func forwardRTPToTrack(packetConn net.PacketConn, track *webrtc.TrackLocalStaticRTP, cleanup func()) {
	buffer := make([]byte, 1600)
	for {
		n, _, err := packetConn.ReadFrom(buffer)
		if err != nil {
			cleanup()
			return
		}

		packet := &rtp.Packet{}
		if err := packet.Unmarshal(buffer[:n]); err != nil {
			continue
		}

		if err := track.WriteRTP(packet); err != nil {
			cleanup()
			return
		}
	}
}

func drainRTCP(sender *webrtc.RTPSender) {
	buffer := make([]byte, 1500)
	for {
		if _, _, err := sender.Read(buffer); err != nil {
			return
		}
	}
}

func toWebRTCSDP(description WebRTCSessionDescription) (webrtc.SessionDescription, error) {
	var sdpType webrtc.SDPType
	switch description.Type {
	case webrtc.SDPTypeOffer.String():
		sdpType = webrtc.SDPTypeOffer
	case webrtc.SDPTypePranswer.String():
		sdpType = webrtc.SDPTypePranswer
	case webrtc.SDPTypeAnswer.String():
		sdpType = webrtc.SDPTypeAnswer
	case webrtc.SDPTypeRollback.String():
		sdpType = webrtc.SDPTypeRollback
	default:
		return webrtc.SessionDescription{}, fmt.Errorf("unsupported SDP type %q", description.Type)
	}

	return webrtc.SessionDescription{Type: sdpType, SDP: description.SDP}, nil
}
