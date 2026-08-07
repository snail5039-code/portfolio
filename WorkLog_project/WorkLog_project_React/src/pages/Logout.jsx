import React, { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Modal, message } from "antd";
import { AuthContext } from "../context/AuthContext";

const LOGIN_REQUIRED_KEY = "login_required_message";

function Logout() {
  const navigate = useNavigate();

  const { isLoginedId, setIsLoginedId } = useContext(AuthContext);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState("");

  useEffect(() => {
    if (isLoginedId == 0) {
      message.error({
        content: "로그아웃은 로그인 후 이용 가능합니다.",
        key: LOGIN_REQUIRED_KEY,
        duration: 5,
      });
      // 리액트 문제로 충돌이 난다. 그래서 키 값을 줘서 안티 디자인이 인식해서 오류 제거하는 느낌
      navigate("/login");
    }
  }, [isLoginedId, navigate]);
  // 매끄럽게 화면 이동 없으면 깜박인다고 함
  if (isLoginedId == 0) {
    return null;
  }

  const openModal = (message) => {
    setModalMessage(message);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setModalMessage("");
    setIsModalOpen(false);
  };

  const handleLogout = async () => {
    try {
      const response = await fetch(
        "http://localhost:8081/api/usr/member/logout",
        {
          method: "post",
          headers: { "content-type": "application/json" },
          credentials: "include",
        }
      );

      if (response.ok) {
        const data = await response.json();
        openModal("로그아웃 되었습니다.");
        setTimeout(() => {
          setIsLoginedId(data);
          navigate("/");
        }, 1500);
      } else {
        openModal("로그아웃 실패!");
      }
    } catch (error) {
      console.error("오류 발생");
    }
  };
  return (
    <>
      <Button
        className="pr-6 bg-white text-black border-[#e5e5e5]"
        onClick={handleLogout}
      >
        로그아웃
      </Button>

      <Modal
        title={<span className="text-xl font-bold text-gray-900">알림</span>}
        open={isModalOpen}
        onCancel={closeModal}
        footer={[
          <Button
            key="confirm"
            type="primary"
            onClick={closeModal}
            className="bg-indigo-600 hover:!bg-indigo-700 focus:ring-indigo-500"
          >
            확인
          </Button>,
        ]}
        className="!rounded-lg !shadow-2xl"
      >
        <p className="text-gray-700 mb-6">{modalMessage}</p>
      </Modal>
    </>
  );
}
export default Logout;
