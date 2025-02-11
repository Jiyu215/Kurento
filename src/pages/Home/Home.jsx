// Home.jsx
import React from "react";
import { useNavigate } from "react-router-dom"; // useNavigate를 import 합니다.
import { VideoCameraOutlined, VideoCameraAddOutlined, PlusSquareOutlined } from "@ant-design/icons";

const Home = () => {
    const navigate = useNavigate(); // useNavigate 훅 사용

    // 방 생성 버튼 클릭 시
    const handleCreateRoom = () => {
    navigate("/rooms", { state: { action: "create" } });
    };

    // 방 참가 버튼 클릭 시
    const handleJoinRoom = () => {
    navigate("/rooms", { state: { action: "join" } });
    };

  return (
    <div className="Home">
      <div className="container">
        <div className="logo">
          <VideoCameraOutlined /> WebSite Name
        </div>
        <div className="container-button-box">
          <div className="container-buttons">
            <button onClick={handleCreateRoom}>
              <VideoCameraAddOutlined /> 방 생성
            </button>
            <button onClick={handleJoinRoom}>
              <PlusSquareOutlined /> 방 참가
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;
