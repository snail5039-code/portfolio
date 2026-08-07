import React, { useState, useContext, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import DaumPostcodeEmbed from "react-daum-postcode";
import {
  Button,
  Input,
  Form,
  Checkbox,
  Modal,
  message,
  Select,
  Space,
} from "antd";
import Password from "antd/es/input/Password";
import {
  UserOutlined,
  LockOutlined,
  MailOutlined,
  HomeOutlined,
} from "@ant-design/icons";
import { AuthContext } from "../context/AuthContext";

const LOGIN_REQUIRED_KEY = "login_required_message";
// 디자인은 차후 수정 예정?? 그래도 이정도면 이쁜데
function Join() {
  const navigate = useNavigate();

  const { Option } = Select; //확실하게 select안에 있는 옵션임을 알려주기 위해 안그럼 경고 뜸 ㅠ

  const [loginId, setLoginId] = useState("");
  const [loginPw, setLoginPw] = useState("");
  const [loginPwChk, setLoginPwChk] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [sex, setSex] = useState("C");
  const [address, setAddress] = useState("");

  const [isPostcodeOpen, setIsPostcodeOpen] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState("");

  const [isIdDupChek, setIsIdDupChek] = useState(false);
  const [isIdChekMessage, setIsIdChekMessage] = useState("");

  const { isLoginedId, authLoaded } = useContext(AuthContext);
  useEffect(() => {
    if (!authLoaded) return;
    if (isLoginedId > 0) {
      message.error({
        content: "회원가입은 로그아웃 후 이용 가능합니다.",
        key: LOGIN_REQUIRED_KEY,
        duration: 5,
      });
      // 리액트 문제로 충돌이 난다. 그래서 키 값을 줘서 안티 디자인이 인식해서 오류 제거하는 느낌
      navigate("/");
    }
  }, [authLoaded, isLoginedId, navigate]);
  if (!authLoaded || isLoginedId > 0) {
    return null;
  }

  const handleIdDupChek = async () => {
    if (!loginId) {
      message.error("아이디를 입력해 주세요.");
      setIsIdDupChek(false);
      return;
    }

    // 서버로 보내니깐 서버는 get으로 받아야하고 리퀘스트파람으로 변수 받아서 쿼리 날리면 된다 ㅇㅋ?
    try {
      const response = await fetch(
        `http://localhost:8081/api/usr/member/checkLoginId?loginId=${loginId}`
      );
      const data = await response.json();
      // 굳이 컨트롤러에서 맴버로 안받아도 되서 인트 타입으로 0,1을 반환해서 그냥 넘겨줬음
      if (response.ok) {
        if (data === 0) {
          setIsIdDupChek(true);
          setIsIdChekMessage("사용 가능한 아이디 입니다.");
          message.success("사용 가능한 아이디 입니다.");
        } else {
          setIsIdDupChek(false);
          setIsIdChekMessage("이미 사용중인 아이디 입니다.");
          message.error("이미 사용중인 아이디 입니다.");
        }
      }
    } catch (error) {
      console.error("통신오류", error);
      message.error("서버와 연결이 되지 않고 있습니다.");
      setIsIdDupChek(false);
    }
  };

  const openModal = (message) => {
    setModalMessage(message);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setModalMessage("");
    setIsModalOpen(false);
  };

  const handleComplete = (data) => {
    let fullAddress = data.address;
    let extraAddress = "";

    if (data.addressType === "R") {
      if (data.bname !== "") {
        extraAddress += data.bname;
      }
      if (data.buildingName !== "") {
        extraAddress +=
          extraAddress !== "" ? `, ${data.buildingName}` : data.buildingName;
      }
      fullAddress += extraAddress !== "" ? ` (${extraAddress})` : "";
    }
    setAddress(fullAddress);

    setIsPostcodeOpen(false);
  };

  const handleSubmit = async () => {
    // if(loginPw !== loginPwChk ) {
    //   openModal("비밀번호가 일치하지 않습니다.");
    //   return;
    // }
    if (sex == "C") {
      openModal("성별을 선택해 주세요.");
      return;
    }
    if (!address) {
      openModal("주소 검색을 통해 주소를 입력해 주세요.");
      return;
    }

    const userData = {
      loginId,
      loginPw,
      name,
      email,
      sex,
      address,
    };

    try {
      const response = await fetch(
        "http://localhost:8081/api/usr/member/join",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(userData),
        }
      );

      if (response.ok) {
        openModal("회원가입이 완료 되었습니다. 로그인 페이지로 이동합니다.");
        setTimeout(() => {
          navigate("/login");
        }, 1200);
      } else {
        openModal("회원가입 실패!");
      }
    } catch (error) {
      console.error("통신오류", error);
      openModal("서버와 연결이 되지 않고 있습니다.");
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-50 p-4">
      <div className="p-8 w-full max-w-md bg-white shadow-2xl rounded-xl">
        <h2 className="text-3xl font-extrabold text-gray-900 mb-8 text-center border-b pb-3">
          WorkLog Get Start
        </h2>

        <Form
          layout="vertical"
          onFinish={handleSubmit}
          requiredMark={false}
          className="space-y-4"
        >
          {/* // 자꾸 개발자도구 오류 떠서 결국 스페이스 컴펙트 안에 담고 메세지창을 엑스트라로 만들어서 해결... ㅜ */}
          <Form.Item
            // label={<span className="font-semibold text-gray-700">아이디</span>}
            name="loginId"
            rules={[{ required: true, message: "아이디를 입력해주세요." }]}
            extra={
              isIdChekMessage && (
                <div
                  className={`mt-1 text-sm ${
                    isIdDupChek ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {isIdChekMessage}
                </div>
              )
            }
          >
            <Space.Compact style={{ width: "95%" }} className="gap-x-2">
              <Input
                prefix={<UserOutlined className="site-form-item-icon" />}
                placeholder="아이디"
                value={loginId}
                onChange={(e) => {
                  setLoginId(e.target.value);
                  setIsIdDupChek(false);
                }}
                className="rounded-lg h-10"
              />
              <Button
                type="default"
                onClick={handleIdDupChek}
                style={{ width: "110px" }}
                className="h-10 border-l-0 rounded-r-lg bg-gray-100 hover:!bg-gray-200 "
              >
                중복확인
              </Button>
            </Space.Compact>
          </Form.Item>

          <Form.Item
            // label={<span className="font-semibold text-gray-700">비밀번호</span>}
            name="loginPw"
            // rules={[{ required: true, message: '비밀번호를 입력해주세요.'}]}
          >
            <Password
              prefix={<LockOutlined className="site-form-item-icon" />}
              placeholder="비밀번호"
              value={loginPw}
              onChange={(e) => setLoginPw(e.target.value)}
              className="rounded-lg h-10"
            />
          </Form.Item>

          <Form.Item
            // label={<span className="font-semibold text-gray-700">비밀번호 확인</span>}
            name="loginPwChk"
            dependencies={["loginPw"]}
            rules={[
              { required: true, message: "비밀번호를 입력해주세요." },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("loginPw") == value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(
                    new Error("비밀번호가 일치하지 않습니다.")
                  );
                },
              }),
            ]}
          >
            <Password
              prefix={<LockOutlined className="site-form-item-icon" />}
              placeholder="비밀번호를 다시 입력하세요."
              value={loginPwChk}
              onChange={(e) => setLoginPwChk(e.target.value)}
              className="rounded-lg h-10"
            />
          </Form.Item>

          <Form.Item
            // label={<span className="font-semibold text-gray-700">이름</span>}
            name="name"
            rules={[{ required: true, message: "이름를 입력해주세요." }]}
          >
            <Input
              prefix={<UserOutlined className="site-form-item-icon" />}
              placeholder="이름"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-lg h-10"
            />
          </Form.Item>

          <Form.Item
            // label={<span className="font-semibold text-gray-700">Email</span>}
            name="email"
            rules={[
              { required: true, message: "이메일을 입력해주세요." },
              {
                type: "email",
                message: "올바른 이메일 주소를 입력해주세요.",
              },
            ]}
          >
            <Input
              prefix={<MailOutlined className="site-form-item-icon" />}
              placeholder="이메일"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg h-10"
            />
          </Form.Item>

          <Form.Item
            // label={<span className="font-semibold text-gray-700">성별</span>}
            name="sex"
            rules={[{ required: true, message: "성별을 선택해주세요." }]}
            initialValue="C"
          >
            <Select
              value={sex}
              onChange={(value) => setSex(value)}
              className="rounded-lg h-10"
            >
              <Option value="C" disabled>
                성별 선택
              </Option>
              <Option value="M">남성</Option>
              <Option value="W">여성</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label={<span className="font-semibold text-gray-700">주소</span>}
            required
            className="mb-4"
          >
            <div className="flex space-x-2 mb-2">
              <Button
                type="default"
                onClick={() => setIsPostcodeOpen(true)}
                className="w-1/2 p-2 bg-indigo-500 text-white font-medium rounded-lg hover:bg-indigo-600 transition duration-150 shadow-md border-none !h-10"
              >
                <HomeOutlined /> 우편번호 찾기
              </Button>
            </div>
            <Input
              prefix={<HomeOutlined className="site-form-item-icon" />}
              placeholder="주소는 우편번호 찾기로 입력됩니다."
              value={address}
              readOnly
              className="rounded-lg h-10"
            />
          </Form.Item>

          <Form.Item className="mt-8">
            <Button
              type="primary"
              htmlType="submit"
              className="w-full p-3 bg-indigo-600 text-white text-lg font-bold rounded-lg hover:bg-indigo-700 transition duration-200 shadow-lg transform hover:scale-105 !h-10"
            >
              회원가입
            </Button>
          </Form.Item>
        </Form>

        <div className="text-center mt-4 text-gray-400">
          <Link
            to="/login"
            className="text-sm hover:text-black transition duration-150"
          >
            이미 계정이 있으신가요?
          </Link>
        </div>
      </div>

      <Modal
        title={
          <span className="text-xl font-bold text-gray-900">우편번호 찾기</span>
        }
        open={isPostcodeOpen}
        onCancel={() => setIsPostcodeOpen(false)}
        footer={null}
        width={450}
        className="!rounded-xl !shadow-2xl"
        styles={{ body: { padding: "0px" } }}
      >
        <DaumPostcodeEmbed
          onComplete={handleComplete}
          autoClose={false}
          style={{ width: "100%", height: "400px" }}
        />
      </Modal>

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
    </div>
  );
}
export default Join;
