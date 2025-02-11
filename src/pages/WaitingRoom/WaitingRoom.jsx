import React, { useEffect, useRef, useState } from "react";
// import axios from "axios";
import { VideoCameraFilled, VideoCameraOutlined, AudioOutlined, AudioMutedOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom"; // Outlet을 사용하여 하위 라우트 렌더링
import JoinRoom from "./JoinRoom";
import CreateRoom from "./CreateRoom";

const WaitingRoom = ({action, onDataChange}) => {
  const [stream, setStream] = useState(null);
  const [videoOn, setVideoOn] = useState(true); // 비디오 상태 (처음에는 꺼짐)
  const [audioOn, setAudioOn] = useState(true); // 마이크 상태 (처음에는 꺼짐)
  const [userName, setUserName] = useState(""); // 이름 상태
  const [roomId, setRoomId] = useState(""); // 방코드 상태
  const videoRef = useRef(null); // 비디오 스트림 참조
  
  const navigate = useNavigate();

  useEffect(() => {
    // 비디오 스트림 가져오기
    const getVideoStream = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setStream(mediaStream);

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }

        // 비디오 트랙을 가져와서 꺼진 상태로 설정
        const videoTrack = mediaStream.getVideoTracks()[0];
        videoTrack.enabled = true; // 처음에는 비디오를 끄고 시작

      } catch (error) {
        console.error("Error accessing webcam:", error);
      }
    };

    getVideoStream();

    // 컴포넌트 언마운트 시 스트림 정리
    return () => {
      if (stream) {
        const tracks = stream.getTracks();
        tracks.forEach((track) => track.stop());
      }
    };
  }, []);

  // 비디오 토글
  const toggleVideo = () => {
    const videoTrack = stream?.getVideoTracks()[0]; // 비디오 트랙 가져오기
    if (videoTrack) {
      videoTrack.enabled = !videoOn; // 비디오 켜기/끄기
      setVideoOn(!videoOn); // 비디오 상태 변경
    }
  };

  // 오디오 토글
  const toggleAudio = () => {
    const audioTrack = stream?.getAudioTracks()[0]; // 오디오 트랙 가져오기
    if (audioTrack) {
      audioTrack.enabled = !audioOn; // 마이크 켜기/끄기
      setAudioOn(!audioOn); // 오디오 상태 변경
    }
  };

  // 이름 입력 변경 핸들러
  const handleNameChange = (e) => {
    setUserName(e.target.value); // 입력된 이름을 상태에 반영
  };

  // 방코드 입력 변경 핸들러
  const handleRoomIdChange = (e) => {
    setRoomId(e.target.value); // 입력된 방코드를 상태에 반영
  };

  // 방참가 API 호출
  const handleJoin = async() => {
    if (!userName.trim() && !roomId.trim()) {
      alert("이름과 방코드를 입력해주세요.");
      return;
    }

    if (!userName.trim()) {
      alert("이름을 입력해주세요.");
      return;
    }
    
    if (!roomId.trim()) {
      alert("방코드를 입력해주세요.");
      return;
    }

    onDataChange({ userName, roomId, videoOn, audioOn });
  };

  // 방 생성 API 호출
  const handleCreateRoom = async() => {
    if (!userName.trim()) {
      alert("이름을 입력해주세요.");
      return;
    }

    onDataChange({ userName, roomId, videoOn, audioOn });
  };

  // "WebSite Name" 클릭 시 홈 페이지로 이동하는 함수
  const handleGoHome = () => {
    navigate("/"); // 홈으로 이동
  };

  return (
    <div className="WaitingRoom">
      <header>
        <div onClick={handleGoHome}>
          <span><VideoCameraFilled /></span> WebSite Name
        </div>
      </header>
      <section>
        <div className="left">
          <div className="join">
          {action === "create" ? (
              <CreateRoom
                name={userName}
                onNameChange={handleNameChange}
                onCreate={handleCreateRoom}
              />
            ) : action === "join" ? (
              <JoinRoom
                name={userName}
                roomId={roomId}
                onNameChange={handleNameChange}
                onRoomIdChange={handleRoomIdChange}
                onJoin={handleJoin}
              />
            ) : null}
          </div>
          <div className="setting">
            <p>마이크/비디오 설정</p>
            <div className="onoff">
              <div onClick={toggleAudio}>
                <span style={{ backgroundColor: audioOn ? "#0060FF" : "#EB5757" }}>
                  {audioOn ? <AudioOutlined /> : <AudioMutedOutlined />}
                </span>
                마이크 {audioOn ? "켜짐" : "꺼짐"}
              </div>
              <div onClick={toggleVideo}>
                <span style={{ backgroundColor: videoOn ? "#0060FF" : "#EB5757" }}>
                  {videoOn ? <VideoCameraFilled /> : <VideoCameraOutlined />}
                </span>
                카메라 {videoOn ? "켜짐" : "꺼짐"}
              </div>
            </div>
          </div>
        </div>
        <div className="right">
          <div>
            <video ref={videoRef} autoPlay playsInline />
            {userName && (<div className="nickname">{userName}</div>)}
            {!audioOn && (<div className="audio"><AudioMutedOutlined /></div>)}
          </div>
        </div>
      </section>
    </div>
  );
}

export default WaitingRoom;
