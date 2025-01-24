import React from "react";

const CreateRoom = ({ name, onNameChange, onCreate }) => {
  return (
    <div className="CreateRoom">
      <input
        type="text"
        id="name"
        value={name}
        onChange={onNameChange}
        placeholder="이름을 입력하세요"
      />
      <button className="registerBtn" onClick={onCreate}>방 만들기</button>
    </div>
  );
};

export default CreateRoom;
