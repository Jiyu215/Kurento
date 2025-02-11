import * as React from "react";
import * as kurentoUtils from 'kurento-utils'; //이렇게 설정해야 webrtc undefined오류가 뜨지않음
import { useLocation, useNavigate } from "react-router-dom"; // Outlet을 사용하여 하위 라우트 렌더링
import { useEffect, useRef, useState } from 'react';
import WaitingRoom from "../WaitingRoom/WaitingRoom";
import { VideoCameraFilled, VideoCameraOutlined, AudioOutlined, AudioMutedOutlined, CommentOutlined, SmileOutlined, PhoneOutlined, CloseOutlined, SendOutlined } from "@ant-design/icons";
import { message } from "antd";

//Participant 클래스 정의
class Participant{
    constructor(userId, userName, videoOn = true, audioOn = true){
        this.userId = userId;
        this.userName = userName;
        this.videoOn = videoOn;
        this.audioOn = audioOn;
        this.rtcPeer = null;

        let container = document.createElement('div');
        let span = document.createElement('span');
	    let video = document.createElement('video');

        container.id = userId;
        container.appendChild(video);
        container.appendChild(span);
        document.getElementById('participant').appendChild(container);

        span.appendChild(document.createTextNode(userId));

        video.id = 'video-' + userId;
        video.autoplay = true;
        video.controls = false;

        this.getElement = () => {
            return container;
        }
    
        this.getVideoElement = () => {
            return video;
        }    
    }

    offerToReceiveVideo = (error, offerSdp, wp) => {
		if (error) return console.error ("sdp offer error")
		console.log('Invoking SDP offer callback function');

		var msg =  { id : "receiveVideoFrom",
				sender : this.userId,
				sdpOffer : offerSdp
			};
		this.sendMessage(msg);
	}

    onIceCandidate = (candidate, wp) => {
        const message = {
            eventId: 'onIceCandidate',
            userId: this.userId,
            candidate: candidate,
            sdpMid: candidate.sdpMid,  // sdp 연결 시 필요한 정보
            sdpMLineIndex: candidate.sdpMLineIndex  // sdp 연결 시 필요한 정보
        }

        this.sendMessage(message);
    }

    dispose = () => {
        if(this.rtcPeer){
            this.rtcPeer.dispose();
            this.rtcPeer = null;
        }
    }
}

const VideoRoom = () =>{
    const navigate = useNavigate();
    const location = useLocation();
    const action = location.state?.action;

    const [userData, setUserData] = useState({ userName: "", roomId: "", videoOn: true, audioOn: true }); // 대기실 사용자 데이터
    const [prevUserData, setPrevUserData] = useState({ userName: "", roomId: "", videoOn: true, audioOn: true }); // 이전 상태 저장
    const participants = {};
    // const [participants, setParticipants] = useState({}); // 참가자 객체

    const [chatOn, setChatOn] = useState(false);
    const [emojiOn, setEmojiOn] = useState(false);
    const [leftWidth, setLeftWidth] = useState('100%');
    const [rightWidth, setRightWidth] = useState('0%');
    const [displayOn, setDisplayOn] = useState('none');
    const [messages, setMessages] = useState([]);  // 채팅 메시지 상태
    const [newMessage, setNewMessage] = useState("");  // 새 메시지 상태
    

    const wsServerUrl = 'http://127.0.0.1:8080';
    const ws = useRef(null);  // 웹소켓 연결을 위한 ref    

    const handleUserDataChange = (data) => {
        setUserData(data); // 대기실에서 받은 데이터로 상태 업데이트
    };

    //채팅 & 이모지
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

    //방참가 함수
    const joinRoom = () => {
        const message = {
            id: 'joinRoom',
            userName: userData.userName,
            roomId: userData.roomId
        };

        sendMessage(message);
    }
    
    //방생성 함수
    const createRoom = () => {
        const message = {
            eventId: 'createRoom',
            userName: userData.userName
        };

        sendMessage(message);
    }

    //방생성 or 방참가 실행
    useEffect(() => { 
        if (JSON.stringify(prevUserData) !== JSON.stringify(userData)) {
            if(action=="create") createRoom(); //방 생성 
            if(action=="join") joinRoom(); //방 참가

            setPrevUserData(userData); // 이전 상태 업데이트
            console.log("변경완료", userData);

            return;
        }
    }, [userData, prevUserData]); // userData가 변경될 때마다 실행됨

    //웹소켓 연결
    useEffect(() => {
        ws.current = new WebSocket(wsServerUrl);

        ws.current.onopen = () => {
            console.log('WebSocket connection opened.');
        };

        ws.current.onmessage = (message) => {
            let parsedMessage = JSON.parse(message.data);
            console.info('Received message: ' + message.data);

            switch (parsedMessage.action) {
                case 'sendExistingUsers': //기존 참가자에게 새로운 참가자 알림
                    sendExistingUsers(parsedMessage);
                    break;
                case 'newUserJoined': //새로운 사용자에게 기존 참가자 알림
                    newUserJoined(parsedMessage);
                    break;
                case 'roomCreated': //새로운 방 생성
                    roomCreated(parsedMessage);
                    break;
                case 'receiveVideoAnswer': //비디오 연결
                    receiveVideoResponse(parsedMessage);
                    break;
                case 'onIceCandidate': //사용자 peer연결
                    onIceCandidate(parsedMessage);
                    break;
                case 'exitRoom': //사용자 방 나가기
                    userLeft(parsedMessage);
                    break;
                default:
                    console.error('Unrecognized message', parsedMessage);
              }
        };

        return () => {
            if(ws.current){
                console.log("Closing WebSocket connection.");
                ws.current.close();  // 웹소켓 연결 종료
            }
        }
    }, []);

    
    //프론트메시지 백엔드에게 전달하는 함수
    const sendMessage = (message) => {
        let jsonMessage = JSON.stringify(message);
        console.log('Sending message: ' + jsonMessage);
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(jsonMessage);
        }
    }

    //방 생성 후, 백엔드 메시지 받기
    const roomCreated = (response) => {
        const {action, userId, userName, roomId} = response;
        console.log('Received createRoomResponse:', response);
    }

    const newUserJoined = (request) => {
        receiveVideo(request);
    }

    const sendExistingUsers = (msg) => {
        const constraints = {
            audio : true,
            video : true
        };

        console.log(msg.userName + "님이 방에 입장하셨습니다.");
        let participant = new Participant(msg.userId);
        participants[msg.userId] = participant;

        navigator.mediaDevices.getUserMedia(constraints)
        .then(function(stream) {
			var options = {
				localVideo: participant.getVideoElement(),
				mediaConstraints: constraints,
				onicecandidate: participant.onIceCandidate.bind(participant)
			};

			participant.rtcPeer = new kurentoUtils.WebRtcPeer.WebRtcPeerSendonly(options,
				function (error) {
					if (error) {
						console.error(error);
						return;
					}
					this.generateOffer(participant.offerToReceiveVideo.bind(participant));
				});

			msg.data.forEach(receiveVideo);
		})
		.catch(function(error) {
			console.error("Error accessing media devices:", error);
		});

        let options = {
            localVideo: participant.getVideoElement(),
            mediaConstraints: constraints,
            onicecandidate: participant.onIceCandidate.bind(participant)
        }
        participant.rtcPeer = new kurentoUtils.WebRtcPeer.WebRtcPeerSendonly(options,
            function (error) {
                if(error) {
                    return console.error(error);
                }
                this.generateOffer (participant.offerToReceiveVideo.bind(participant));
        });
    
        msg.data.forEach(receiveVideo);
    }

    const receiveVideoResponse = (result) => {
        participants[result.userId].rtcPeer.processAnswer(result.sdpAnswer, function (error) {
            if (error) return console.error (error);
        });
    }

    const onIceCandidate = (result) => {
        participants[result.userId].rtcPeer.addIceCandidate(result.candidate, function (error) {
	        if (error) {
		      console.error("Error adding candidate: " + error);
		      return;
	        }
	    });
    }

    //onIcecandidate값 전달 함수 - peer 연결
    const receiveVideo = (sender) => {
        let participant = new Participant(sender.userName, sender.userId, sender.videoOn, sender.audioOn);
        participants[sender.userId] = participant;

        let options = {
            remoteVideo: participant.getVideoElement(),
            onicecandidate: participant.onIceCandidate.bind(participant)
        }
        
        participant.rtcPeer = new kurentoUtils.WebRtcPeer.WebRtcPeerRecvonly(options,
			function (error) {
                if(error) { 
                    return console.error(error); 
                }
                this.generateOffer(participant.offerToReceiveVideo.bind(participant));
        });

    }

    //사용자 방 나가기
    const exitRoom = () => {
        const message = {
            eventId: "exitRoom",
            userId: userData.userId
        };
        sendMessage(message);

        navigate('/');
    }

    //방을 나간 참가자 처리
    const userLeft = (request) => {
        console.log(participant.userName+"님이 나갔습니다.");
        let participant = participants[request.userId];

        participant.dispose();
        delete participants[request.userId];
    }

    return(
        <>
            {!userData.userName ? (
                <WaitingRoom action={action} onDataChange={handleUserDataChange} />
            ) : (
                <div className="VideoCallRoom">
                <header>
                    <div>
                        <div className="icon"> <VideoCameraFilled /> </div>
                        <div className="title">
                            <p className="titlename">님의 통화방</p>
                            <p className="date">시간</p>
                        </div>
                    </div>
                </header>
                <section style={{ display: 'flex' }}>
                    <div className="left" style={{ width: leftWidth }}>
                        <div id="participant" className="participant">
                            {/* 참가자 목록 및 비디오 설정 */}
                            
                        </div>
                        <div className="setting">
                            <div className="setting-icon">
                                {/* 오디오 토글 버튼 */}
                                <span style={{ backgroundColor: userData.audioOn ? "#0060FF" : "#EB5757" }}>
                                    {userData.audioOn ? <AudioOutlined /> : <AudioMutedOutlined />}
                                </span>
    
                                {/* 비디오 토글 버튼 */}
                                <span style={{ backgroundColor: userData.videoOn ? "#0060FF" : "#EB5757" }}>
                                    {userData.videoOn ? <VideoCameraFilled /> : <VideoCameraOutlined />}
                                </span>
    
                                <span className="chat">
                                    <CommentOutlined />
                                </span>
                                <span className="emoji">
                                    <SmileOutlined />
                                </span>
                                <span onClick={exitRoom} className="exit">
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
            )}
        </>
    );
}

export default VideoRoom;