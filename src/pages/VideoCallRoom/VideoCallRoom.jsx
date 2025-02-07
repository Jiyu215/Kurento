import React, { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from "react-router-dom";
import { VideoCameraFilled, VideoCameraOutlined, AudioOutlined, AudioMutedOutlined, CommentOutlined, SmileOutlined, PhoneOutlined, CloseOutlined, SendOutlined } from "@ant-design/icons";
import kurentoUtils from 'kurento-utils';
import axios from 'axios';

function VideoCallRoom() {
    const location = useLocation();
    const navigate = useNavigate();

    
    const { userId, roomId, participants, creator ,videoOn, audioOn } = location.state || {};
    const [participantsList, setParticipantsList] = useState(participants || []);
    const [rtcPeers, setRtcPeers] = useState({});

    const { name: creatorName, userId: creatorUserId } = creator || {};
    const [videoOnOff, setVideoOnOff] = useState(videoOn);
    const [audioOnOff, setAudioOnOff] = useState(audioOn);
    const [chatOn, setChatOn] = useState(false);
    const [emojiOn, setEmojiOn] = useState(false);
    const [leftWidth, setLeftWidth] = useState('100%');
    const [rightWidth, setRightWidth] = useState('0%');
    const [displayOn, setDisplayOn] = useState('none');

    const ws = useRef(null);  // 웹소켓 연결을 위한 ref
    const localVideoRef = useRef(null);  // 로컬 비디오를 위한 ref
    const [localStream, setLocalStream] = useState(null);  // 로컬 미디어 스트림 상태
    const [messages, setMessages] = useState([]);  // 채팅 메시지 상태
    const [newMessage, setNewMessage] = useState("");  // 새 메시지 상태

    // WebSocket 서버 URL
    const wsServerUrl = 'http://127.0.0.1:8888/kurento';

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
        console.log("Exiting the room.");
        navigate("/"); // 홈으로 이동
    };

    // 공통 함수로 chat과 emoji를 토글하는 함수
    const toggleSection = (section) => {
        console.log(`Toggling section: ${section}`);
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
        setDisplayOn(chatOn ? 'none' : 'block');
        console.log(`Toggled chat: ${chatOn ? "open" : "closed"}`);
    };

    const toggleEmoji = () => {
        setEmojiOn(!emojiOn);
        if (chatOn) setChatOn(false); // 채팅이 열려있으면 닫기
        setLeftWidth(emojiOn ? '100%' : '75%');
        setRightWidth(emojiOn ? '0%' : '25%');
        setDisplayOn(emojiOn ? 'none' : 'block');
        console.log(`Toggled emoji: ${emojiOn ? "open" : "closed"}`);
    };

    const toggleClose = () => {
        setChatOn(false); // 채팅 닫기
        setEmojiOn(false); // 이모지 닫기
        setLeftWidth('100%'); // 기본 왼쪽 영역 크기
        setRightWidth('0%'); // 기본 오른쪽 영역 크기
        setDisplayOn('none'); // 닫기
        console.log("Closed chat and emoji.");
    };

    const toggleAudio = () => {
        setAudioOnOff(!audioOnOff); // 오디오 토글
        if (localStream) {
            localStream.getAudioTracks().forEach(track => track.enabled = !audioOnOff);
            setLocalStream(new MediaStream(localStream)); // 상태 업데이트
        }
        console.log(`Audio toggled: ${audioOnOff ? "on" : "off"}`);
    };

    const toggleVideo = () => {
        setVideoOnOff(!videoOnOff); // 비디오 토글
        if (localStream) {
            localStream.getVideoTracks().forEach(track => track.enabled = !videoOnOff);
            setLocalStream(new MediaStream(localStream)); // 상태 업데이트
        }
        console.log(`Video toggled: ${videoOnOff ? "on" : "off"}`);
    };

    useEffect(() => {
        ws.current = new WebSocket(wsServerUrl);

        ws.current.onopen = () => {
            console.log('WebSocket connection opened.');
            // 서버에서 예상하는 메서드 이름을 사용하도록 수정
            const message = {
                userId: 1,
                userName: "참가",
              };
             // ws.current.send(JSON.stringify(message));
             console.log("console.log(participantsList);",participantsList);
              onNewParticipant(JSON.stringify(message));
              onExistingParticipants(JSON.stringify(message));
        };

        ws.current.onmessage = (message) => {
            let parsedMessage = JSON.parse(message.data);
            console.info('Received message: ' + message.data);
            

            switch (parsedMessage.eventId) {

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
                console.log("Closing WebSocket connection.");
                ws.current.close();  // 웹소켓 연결 종료
            }
        };
    }, []);

    const onExistingParticipants = (message) => {
        let participants = parseJsonMessage(message);
        console.log("기존 참가자:", participants);
        
        navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            .then(stream => {
                setLocalStream(stream);
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = stream;
                }

                setParticipantsList(participants);
                participants.forEach(participant => {
                    createPeerConnection(participant);
                });
            })
            .catch(err => console.error('미디어 오류:', err));
    };


    const onNewParticipant = (message) => {
        let participant = parseJsonMessage(message);
        console.log("새로운 참가자가 도착했습니다:", participant);
        createPeerConnection(participant);  // 새 참가자에 대한 피어 연결 생성
    };
    

    // 참가자 퇴장 처리
    const onParticipantLeft = (message) => {
        let participant = message.payload.data;
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

    const createPeerConnection = (participant) => {
        console.log(`참가자(${participant.userId})의 피어 연결 생성`);
    
        let peerConnection = new RTCPeerConnection();
        setRtcPeers(prevRtcPeers => ({
            ...prevRtcPeers,
            [participant.userId]: peerConnection,  // rtcPeer를 rtcPeers 상태에 추가
        }));
    
        // ICE 후보 처리, 스트림 연결 등은 동일하게 처리
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                sendIceCandidate(event.candidate, participant);
            }
        };
    
        if (localStream) {
            localStream.getTracks().forEach(track => {
                peerConnection.addTrack(track, localStream);
            });
        }

        
        peerConnection.ontrack = (event) => {
            console.log("ontrack 이벤트 발생", event);
            const remoteStream = event.streams[0];
            const remoteVideoElement = document.createElement('video');
            remoteVideoElement.srcObject = remoteStream;
            remoteVideoElement.autoplay = true;
            remoteVideoElement.playsInline = true;  
            remoteVideoElement.id = `remote-video-${participant.userId}`;
            document.getElementById('videoContainer').appendChild(remoteVideoElement);
        };
    
        peerConnection.createOffer({ offerToReceiveAudio: 1, offerToReceiveVideo: 1 })
            .then(offer => {
                return peerConnection.setLocalDescription(offer);
            })
            .then(() => {
                sendOfferToServer(peerConnection.localDescription, participant);
            })
            .catch(error => {
                console.error("Offer 생성 오류:", error);
            });
    };
    

    // ICE 후보를 서버로 전송
    const sendIceCandidate = (candidate, participant) => {
        const message = {
            eventId: 'iceCandidate',
            userId: participant.userId,
            candidate: candidate
        };
        console.log(`Sending ICE candidate for participant: ${participant.userId}`);
        ws.current.send(JSON.stringify(message));
    };

    // Offer를 서버로 전송
    const sendOfferToServer = (offer, participant) => {
        const message = {
            eventId: 'sendVideoOffer',
            userId: participant.userId,
            sdpOffer: offer
        };
        console.log(`Sending video offer to server for participant: ${participant.userId}`);
        ws.current.send(JSON.stringify(message));
    };

    // JSON 문자열을 객체로 파싱하는 함수
    const parseJsonMessage = (message) => {
        try {
            // 문자열을 파싱하여 객체로 변환
            return JSON.parse(message);
        } catch (error) {
            // 파싱 오류가 발생하면 오류 메시지를 출력하고, 빈 객체를 반환
            console.error("Error parsing JSON:", error);
            return {};
        }
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
            console.log("Message sent:", newMessage);
        }
    };

    return (
        
        <div className="VideoCallRoom">
            <header>
                <div>
                    <div className="icon"> <VideoCameraFilled /> </div>
                    <div className="title">
                        <p className="titlename">{creator.name}님의 통화방</p>
                        <p className="date">{formattedDate}</p>
                    </div>
                </div>
            </header>
            <section style={{ display: 'flex' }}>
                <div className="left" style={{ width: leftWidth }}>
                    <div className="participant">
                        {/* 참가자 목록 및 비디오 설정 */}
                        {console.log(Array.isArray(participantsList))}
                        {Array.isArray(participantsList) && participantsList.map((participant, index) => (
                            <div key={index}>
                                <div id="videoContainer">
                                    <video ref={localVideoRef} autoPlay playsInline muted style={{ width: "100%" }} />
                                </div>
                                <p>{participant.userId}</p>
                            </div>
                        ))}
                        
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
                <div className="right" style={{ width: rightWidth, display:displayOn }}>
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
