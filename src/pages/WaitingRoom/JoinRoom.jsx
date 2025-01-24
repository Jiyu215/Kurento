// JoinRoom.js
import React from "react";

const JoinRoom = ({ name, roomId, onNameChange, onRoomIdChange, onJoin }) => {
  return (
    <div className="JoinRoom">
      <input
        type="text"
        id="name"
        value={name}
        onChange={onNameChange}
        placeholder="이름을 입력하세요"
      />
      <input
        type="text"
        id="roomId"
        value={roomId}
        onChange={onRoomIdChange}
        placeholder="방코드를 입력하세요"
      />
      <button className="registerBtn" onClick={onJoin}>방 참가</button>
    </div>
  );
};

export default JoinRoom;
