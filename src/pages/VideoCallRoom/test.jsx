import React, { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from "react-router-dom";
import { VideoCameraFilled, VideoCameraOutlined, AudioOutlined, AudioMutedOutlined, CommentOutlined, SmileOutlined, PhoneOutlined, CloseOutlined, SendOutlined } from "@ant-design/icons";
import kurentoUtils from 'kurento-utils';
import axios from 'axios';

function VideoCallRoom() {
    const location = useLocation();
    const navigate = useNavigate();

    const { name, userId, videoOn, audioOn, creator, participants } = location.state || {};
    const [participantsList, setParticipantsList] = useState(participants || []);
    const { name: creatorName, userId: creatorUserId } = creator || {};
    const [videoOnOff, setVideoOnOff] = useState(videoOn);
    const [audioOnOff, setAudioOnOff] = useState(audioOn);
    const [chatOn, setChatOn] = useState(false);
    const [emojiOn, setEmojiOn] = useState(false);
    const [leftWidth, setLeftWidth] = useState('100%');
    const [rightWidth, setRightWidth] = useState('0%');

    const ws = useRef(null);  // 웹소켓 연결을 위한 ref
    const localVideoRef = useRef(null);  // 로컬 비디오를 위한 ref
    const [localStream, setLocalStream] = useState(null);  // 로컬 미디어 스트림 상태
    const [messages, setMessages] = useState([]);  // 채팅 메시지 상태
    const [newMessage, setNewMessage] = useState("");  // 새 메시지 상태

    // WebSocket 서버 URL
    const wsServerUrl = 'ws://localhost:8080';

    // 현재 날짜와 시간 얻기
    const currentDate = new Date();

    // 날짜 포맷
    const options = {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true, // 12시간제
    };

    // 한국어 형식으로 날짜와 시간 포맷
    const formattedDate = currentDate.toLocaleString('ko-KR', options);

    const exit = () => {
        navigate("/"); // 홈으로 이동
    };

    // 공통 함수로 chat과 emoji를 토글하는 함수
    const toggleSection = (section) => {
        if (section === 'chat') {
            setChatOn(true); // Chat을 활성화
            setEmojiOn(false); // Emoji는 비활성화
        } else if (section === 'emoji') {
            setEmojiOn(true); // Emoji를 활성화
            setChatOn(false); // Chat은 비활성화
        }
    };

    const toggleChat = () => {
        setChatOn(!chatOn);
        if (emojiOn) setEmojiOn(false); // 이모지가 열려있으면 닫기
        setLeftWidth(chatOn ? '100%' : '75%');
        setRightWidth(chatOn ? '0%' : '25%');
    };

    const toggleEmoji = () => {
        setEmojiOn(!emojiOn);
        if (chatOn) setChatOn(false); // 채팅이 열려있으면 닫기
        setLeftWidth(emojiOn ? '100%' : '75%');
        setRightWidth(emojiOn ? '0%' : '25%');
    };

    const toggleClose = () => {
        setChatOn(false); // 채팅 닫기
        setEmojiOn(false); // 이모지 닫기
        setLeftWidth('100%'); // 기본 왼쪽 영역 크기
        setRightWidth('0%'); // 기본 오른쪽 영역 크기
    };

    const toggleAudio = () => {
        setAudioOnOff(!audioOnOff); // 오디오 토글
        if (localStream) {
            localStream.getAudioTracks().forEach(track => track.enabled = !audioOnOff);
            setLocalStream(new MediaStream(localStream)); // 상태 업데이트
        }
    };

    const toggleVideo = () => {
        setVideoOnOff(!videoOnOff); // 비디오 토글
        if (localStream) {
            localStream.getVideoTracks().forEach(track => track.enabled = !videoOnOff);
            setLocalStream(new MediaStream(localStream)); // 상태 업데이트
        }
    };

    // 웹소켓 연결 및 메시지 처리
    useEffect(() => {
        ws.current = new WebSocket(wsServerUrl);

        ws.current.onopen = () => {
            console.log('WebSocket connection opened.');
        };

        ws.current.onmessage = (message) => {
            let parsedMessage = JSON.parse(message.data);
            console.info('Received message: ' + message.data);

            switch (parsedMessage.eventId) {
                case 'existingParticipants':
                    onExistingParticipants(parsedMessage);
                    break;
                case 'newParticipantArrived':
                    onNewParticipant(parsedMessage);
                    break;
                case 'participantLeft':
                    onParticipantLeft(parsedMessage);
                    break;
                case 'receiveVideoAnswer':
                    receiveVideoResponse(parsedMessage);
                    break;
                case 'iceCandidate':
                    handleIceCandidate(parsedMessage);
                    break;
                default:
                    console.error('Unrecognized message', parsedMessage);
            }
        };

        return () => {
            if (ws.current) {
                ws.current.close();  // 웹소켓 연결 종료
            }
        };
    }, []);

    // 기존 참가자 처리
    const onExistingParticipants = (message) => {
        let participants = message.payload.data;
        let videoConstraints = { video: true, audio: true };

        navigator.mediaDevices.getUserMedia(videoConstraints)
            .then(stream => {
                setLocalStream(stream);
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = stream;
                }

                // 참가자 리스트 상태 업데이트
                setParticipantsList(participants);

                participants.forEach(participant => {
                    createPeerConnection(participant);
                });
            })
            .catch(err => {
                console.error('Error getting media: ', err);
            });
    };

    // 새로운 참가자 처리
    const onNewParticipant = (message) => {
        let participant = message.payload.data;
        createPeerConnection(participant);
    };

    // 참가자 퇴장 처리
    const onParticipantLeft = (message) => {
        let participant = message.payload.data;
        // 여기서 참가자가 떠난 후 피어 연결 해제 등 처리
        console.log(participant.userName + ' left the room.');
    };

    // 비디오 응답 처리
    const receiveVideoResponse = (message) => {
        const participant = message.payload.data;
        const peerConnection = participantsList[participant.userId].rtcPeer;
        peerConnection.setRemoteDescription(new RTCSessionDescription(participant.sdpAnswer), function () {
            console.log('Set remote description successfully');
        });
    };

    // ICE 후보 처리
    const handleIceCandidate = (message) => {
        const participant = message.payload.data;
        participantsList[participant.userId].rtcPeer.addIceCandidate(new RTCIceCandidate(participant.candidate));
    };

    // PeerConnection 생성
    const createPeerConnection = (participant) => {
        let peerConnection = new RTCPeerConnection();
        participantsList[participant.userName] = { rtcPeer: peerConnection };

        // ICE 후보 처리
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                sendIceCandidate(event.candidate, participant);
            }
        };

        // 스트림 연결
        if (localStream) {
            localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, localStream);
            });
        }

        // 받는 스트림 처리
        peerConnection.ontrack = (event) => {
            const remoteStream = event.streams[0];
            const remoteVideoElement = document.createElement('video');
            remoteVideoElement.srcObject = remoteStream;
            remoteVideoElement.autoplay = true;
            remoteVideoElement.playsInline = true;  // 모바일에서 inline으로 재생
            remoteVideoElement.id = `remote-video-${participant.userId}`; // 고유 ID
            document.getElementById('videoContainer').appendChild(remoteVideoElement);
        };

        // Offer 보내기
        peerConnection.createOffer({ offerToReceiveAudio: 1, offerToReceiveVideo: 1 })
            .then(offer => {
                return peerConnection.setLocalDescription(offer);
            })
            .then(() => {
                sendOfferToServer(peerConnection.localDescription, participant);
            })
            .catch(error => {
                console.error("Error creating offer:", error);
            });
    };

    // ICE 후보를 서버로 전송
    const sendIceCandidate = (candidate, participant) => {
        const message = {
            eventId: 'iceCandidate',
            userId: participant.userId,
            candidate: candidate
        };
        ws.current.send(JSON.stringify(message));
    };

    // Offer를 서버로 전송
    const sendOfferToServer = (offer, participant) => {
        const message = {
            eventId: 'sendVideoOffer',
            userId: participant.userId,
            sdpOffer: offer
        };
        ws.current.send(JSON.stringify(message));
    };

    // 메시지 전송
    const sendMessage = () => {
        if (newMessage.trim() !== "") {
            const message = {
                senderId: userId,
                message: newMessage,
                timestamp: Date.now(),
            };

            // 메시지 상태에 추가
            setMessages([...messages, message]);

            // 서버로 메시지 전송
            ws.current.send(JSON.stringify({
                eventId: 'sendMessage',
                userId: userId,
                message: newMessage
            }));

            // 메시지 입력 초기화
            setNewMessage("");
        }
    };

    return (
        <div className="VideoCallRoom">
            <header>
                <div>
                    <div className="icon"> <VideoCameraFilled /> </div>
                    <div className="title">
                        <p className="titlename">{name}님의 통화방</p>
                        <p className="date">{formattedDate}</p>
                    </div>
                </div>
            </header>
            <section style={{ display: 'flex' }}>
                <div className="left" style={{ width: leftWidth }}>
                    <div className="participant">
                        {/* 참가자 목록 및 비디오 설정 */}
                        {participantsList.map((participant, index) => (
                            <div key={index}>
                                <p>{participant.userId}</p>
                            </div>
                        ))}

                        {/* 비디오 컨테이너 */}
                        <div id="videoContainer">
                            
                        </div>
                    </div>
                    <div className="setting">
                        <div className="setting-icon">
                            {/* 오디오 토글 버튼 */}
                            <span style={{ backgroundColor: audioOnOff ? "#0060FF" : "#EB5757" }} onClick={toggleAudio}>
                                {audioOnOff ? <AudioOutlined /> : <AudioMutedOutlined />}
                            </span>

                            {/* 비디오 토글 버튼 */}
                            <span style={{ backgroundColor: videoOnOff ? "#0060FF" : "#EB5757" }} onClick={toggleVideo}>
                                {videoOnOff ? <VideoCameraFilled /> : <VideoCameraOutlined />}
                            </span>

                            <span className="chat" onClick={toggleChat}>
                                <CommentOutlined />
                            </span>
                            <span className="emoji" onClick={toggleEmoji}>
                                <SmileOutlined />
                            </span>
                            <span onClick={exit} className="exit">
                                <PhoneOutlined />
                            </span>
                        </div>
                    </div>
                </div>
                <div className="right" style={{ width: rightWidth }}>
                    <div className="select">
                        <p className={`select-chat ${chatOn ? 'active' : ''}`} onClick={() => toggleSection('chat')}>Chat</p>
                        <p className={`select-emoji ${emojiOn ? 'active' : ''}`} onClick={() => toggleSection('emoji')}>Emoji</p>
                        <p className="close" onClick={toggleClose}><CloseOutlined /></p>
                    </div>

                    {/* 채팅창 조건부 렌더링 */}
                    {chatOn && (
                        <div className="chat">
                            {messages.map((message, index) => (
                                <p key={index}>{message.message}</p>
                            ))}
                        </div>
                    )}

                    {/* 이모지 창 조건부 렌더링 */}
                    {emojiOn && (
                        <div className="emoji">
                            emoji
                        </div>
                    )}

                    <div className="sender-box">
                        <div className="sender">
                            <div className="user-select">
                                <span>수신자: </span>
                                <select name="user" id="">
                                    <option value="all">모두에게</option>
                                    <option value="my">나에게</option>
                                </select>
                            </div>
                            <div className="input-send">
                                <div>
                                    <input 
                                        type="text" 
                                        placeholder="메시지 보내기" 
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)} 
                                    />
                                    <button onClick={sendMessage}> 
                                        <SendOutlined />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}

export default VideoCallRoom;