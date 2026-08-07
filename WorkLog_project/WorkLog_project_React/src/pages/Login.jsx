import React, { useContext, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, Input, Form, Checkbox, Modal, message } from "antd";
import { AuthContext } from "../context/AuthContext";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider, githubProvider } from "../firebaseConfig";

const LOGIN_REQUIRED_KEY = "login_required_message";

function Login() {
  const [form] = Form.useForm();
  const [findIdForm] = Form.useForm();
  const [findPwForm] = Form.useForm();

  const [isFindIdModalOpen, setIsFindIdModalOpen] = useState(false);
  const [isFindPwModalOpen, setIsFindPwModalOpen] = useState(false);

  const [sendingIdCode, setSendingIdCode] = useState(false);
  const [verifyingIdCode, setVerifyingIdCode] = useState(false);
  const [foundLoginId, setFoundLoginId] = useState("");
  const [sendingPwCode, setSendingPwCode] = useState(false);
  const [verifyingPwCode, setVerifyingPwCode] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState("");

  const navigate = useNavigate();

  const { isLoginedId, setIsLoginedId, authLoaded } = useContext(AuthContext);

  const handleSocialLogin = async (providerType) => {
    try {
      const provider =
        providerType === "google" ? googleProvider : githubProvider;

      // 팝업 로그인
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const idToken = await user.getIdToken();

      console.log("파이어베이스 아이디 토큰: ", idToken);

      const response = await fetch(
        "http://localhost:8081/api/auth/firebase-login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ idToken, provider: providerType }),
        }
      );

      const data = await response.json();
      console.log("백엔드 응답: ", data);

      if (!response.ok) {
        message.error(data.error || "소셜 로그인 서버 호출 실패");
        return;
      }
      setIsLoginedId(data);
      message.success(`${providerType} 계정으로 로그인 성공!`);
      navigate("/");
    } catch (error) {
      if (
        error.code === "auth/cancelled-popup-request" ||
        error.code === "auth/popup-closed-by-user"
      ) {
        console.log("사용자가 소셜 로그인 팝업을 닫았거나, 요청이 취소됨.");
        return;
      }

      console.error("소셜 로그인 오류:", error);
      message.error("소셜 로그인 중 오류가 발생했습니다.");
    }
  };

  useEffect(() => {
    if (isLoginedId > 0) {
      message.error({
        content: "로그인은 로그아웃 후 이용 가능합니다.",
        key: LOGIN_REQUIRED_KEY,
        duration: 5,
      });
      navigate("/");
    }
  }, []);
  if (!authLoaded) {
    return null;
  }
  // ✅ 이미 로그인 상태면 아무것도 렌더하지 않음
  if (isLoginedId > 0) {
    return null;
  }

  const openModal = (message) => {
    setModalMessage(message);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setModalMessage("");
  };
  const onFinish = async (values) => {
    const loginData = {
      loginId: values.loginId,
      loginPw: values.loginPw,
    };

    try {
      const response = await fetch(
        "http://localhost:8081/api/usr/member/login",
        {
          method: "post",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(loginData),
          credentials: "include",
        }
      );

      // 응답 바디 먼저 꺼내두기
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        // HTTP 에러 (500, 400 등)
        console.error("로그인 실패:", response.status, data);
        openModal("로그인 요청에 실패했습니다. 잠시 후 다시 시도해주세요.");
        return;
      }

      // ✅ 여기부터는 HTTP 200 이지만,
      //    "진짜 로그인 성공인지" 한 번 더 체크
      //    (data가 숫자라면 0/음수는 실패로 취급)
      if (!data || (typeof data === "number" && data <= 0)) {
        openModal("아이디 또는 비밀번호가 일치하지 않습니다.");
        return;
      }

      // ✅ 여기까지 통과했으면 진짜 성공
      openModal(values.loginId + "님 환영합니다.");
      setTimeout(() => {
        setIsLoginedId(data); // data가 userId면 그대로, 객체면 data.id 이런 식으로
        navigate("/");
      }, 1200);
    } catch (error) {
      console.error("로그인 오류:", error);
      openModal("서버와 연결을 확인하세요.");
    }
  };
  const handleSendIdCode = async () => {
    try {
      const { name, email } = await findIdForm.validateFields([
        "name",
        "email",
      ]);
      setSendingIdCode(true);

      const res = await fetch(
        "http://localhost:8081/api/usr/member/findMyLoginId/sendCode",
        {
          method: "post",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ name, email }),
        }
      );

      const text = await res.text();
      if (!res.ok) {
        throw new Error(text || "인증번호 전송에 실패했습니다.");
      }

      message.success(text || "인증번호를 이메일로 전송했습니다.");
    } catch (error) {
      if (error.errorFields) return; // 폼 validation 에러
      message.error(error.message || "요청 중 오류가 발생했습니다.");
    } finally {
      setSendingIdCode(false);
    }
  };
  const handleVerifyIdCode = async () => {
    try {
      const { name, email, code } = await findIdForm.validateFields([
        "name",
        "email",
        "code",
      ]);
      setVerifyingIdCode(true);

      const res = await fetch(
        "http://localhost:8081/api/usr/member/findMyLoginId/verifyFindIdCode",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ name, email, code }),
        }
      );

      const text = await res.text();
      if (!res.ok) {
        throw new Error(text || "인증번호 확인에 실패했습니다.");
      }

      setFoundLoginId(text); // 서버에서 loginId 문자열로 내려준다 가정
      message.success("아이디를 찾았습니다.");
    } catch (error) {
      if (error.errorFields) return;
      message.error(err.message || "요청 중 오류가 발생했습니다.");
    } finally {
      setVerifyingIdCode(false);
    }
  };

  const handleSendPwCode = async () => {
    try {
      const { loginId, email } = await findPwForm.validateFields([
        "loginId",
        "email",
      ]); // 유효성 검사임
      setSendingPwCode(true);

      const res = await fetch(
        "http://localhost:8081/api/usr/member/findMyLoginPw/sendCode",
        {
          method: "post",
          headers: { "content-type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ loginId, email }),
        }
      );

      const text = await res.text();
      if (!res.ok) {
        throw new Error(text || "인증번호 전송에 실패했습니다.");
      }
    } catch (error) {
      if (error.errorFields) return; // 폼 검증 에러면 그냥 무시
      message.error(err.message || "요청 중 오류가 발생했습니다.");
    } finally {
      setSendingPwCode(false);
    }
  };

  const handleVerifyPwCode = async () => {
    try {
      const { loginId, email, code, newPassword, confirmPassword } =
        await findPwForm.validateFields([
          "loginId",
          "email",
          "code",
          "newPassword",
          "confirmPassword",
        ]);

      setVerifyingPwCode(true);

      const res = await fetch(
        "http://localhost:8081/api/usr/member/findMyLoginPw/verifyCode",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            loginId,
            email,
            code,
            newPassword,
            confirmPassword,
          }),
        }
      );

      const text = await res.text();
      if (!res.ok) {
        throw new Error(text || "비밀번호 변경에 실패했습니다.");
      }

      message.success(text || "비밀번호가 변경되었습니다.");
      // 비번 바꾸고 나면 폼/모달 정리
      findPwForm.resetFields();
      setIsFindPwModalOpen(false);
    } catch (error) {
      if (error.errorFields) return;
      message.error(err.message || "요청 중 오류가 발생했습니다.");
    } finally {
      setVerifyingPwCode(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-xl shadow-2xl relative">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="absolute"
          style={{
            top: 16,
            right: 16,
            padding: "4px 12px",
            borderRadius: "999px",
            border: "1px solid #e5e7eb",
            backgroundColor: "#ffffff",
            color: "#000000", // ← 글자 완전 검정
            fontSize: "12px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          홈으로
        </button>
        <h2 className="text-3xl font-bold text-center text-gray-800">
          Welcome WorkLog
        </h2>

        <Form
          form={form}
          name="login_form"
          initialValues={{ remember: true }}
          onFinish={onFinish}
          layout="vertical"
          className="space-y-4"
        >
          <Form.Item
            label={
              <span className="text-sm font-medium text-gray-700">LoginId</span>
            }
            name="loginId"
            rules={[{ required: true, message: "아이디를 입력해주세요." }]}
            className="mb-0"
          >
            <Input placeholder={"아이디를 입력하세요."} className="w-full" />
          </Form.Item>

          <Form.Item
            label={
              <span className="text-sm font-medium text-gray-700">
                Password
              </span>
            }
            name="loginPw"
            rules={[{ required: true, message: "비밀번호를 입력해주세요." }]}
            className="mb-0"
          >
            <Input.Password
              placeholder={"비밀번호를 입력하세요."}
              className="w-full"
            />
          </Form.Item>

          <Form.Item name="remember" valuePropName="checked" className="mb-0">
            <div className="flex items-center w-full">
              {/* 왼쪽 : 계정 기억하기 */}
              <div className="flex items-center">
                <Checkbox>
                  <span className="ml-2 block text-sm text-gray-500 dark:text-gray-400">
                    계정 기억하기
                  </span>
                </Checkbox>
              </div>

              {/* 오른쪽 : 아이디 / 비밀번호 찾기 */}
              <div className="ml-auto flex items-center text-sm gap-1">
                <button
                  type="button"
                  onClick={() => setIsFindIdModalOpen(true)}
                  className="bg-transparent border-0 p-0 text-indigo-500 hover:text-indigo-600 cursor-pointer"
                >
                  아이디 찾기
                </button>

                <span className="text-gray-400">|</span>

                <button
                  type="button"
                  onClick={() => setIsFindPwModalOpen(true)}
                  className="bg-transparent border-0 p-0 text-indigo-500 hover:text-indigo-600 cursor-pointer"
                >
                  비밀번호 찾기
                </button>
              </div>
            </div>
          </Form.Item>

          <Form.Item className="mt-6 mb-0">
            <Button
              type="primary"
              htmlType="submit"
              block
              size="large"
              className="shadow-md hover:bg-blue-700 focus:ring-offset-2 transition duration-150"
            >
              로그인
            </Button>
          </Form.Item>
        </Form>
        {/* 아이디 찾기 모달 */}
        <Modal
          title="아이디 찾기"
          open={isFindIdModalOpen}
          onCancel={() => {
            setIsFindIdModalOpen(false);
            setFoundLoginId("");
            findIdForm.resetFields();
          }}
          footer={null}
        >
          <Form form={findIdForm} layout="vertical">
            <Form.Item
              label="이름"
              name="name"
              rules={[{ required: true, message: "이름을 입력해주세요." }]}
            >
              <Input placeholder="가입 당시 이름" />
            </Form.Item>

            <Form.Item
              label="이메일"
              name="email"
              rules={[
                { required: true, message: "이메일을 입력해주세요." },
                { type: "email", message: "올바른 이메일 형식이 아닙니다." },
              ]}
            >
              <Input placeholder="가입한 이메일" />
            </Form.Item>

            <Form.Item
              label="이메일 인증번호"
              name="code"
              rules={[{ required: true, message: "인증번호를 입력해주세요." }]}
            >
              <div className="flex gap-2">
                <Input placeholder="인증번호 6자리" />
                <Button
                  type="default"
                  onClick={handleSendIdCode}
                  loading={sendingIdCode}
                >
                  인증번호 보내기
                </Button>
              </div>
            </Form.Item>

            <Button
              type="primary"
              block
              onClick={handleVerifyIdCode}
              loading={verifyingIdCode}
            >
              아이디 찾기
            </Button>

            {foundLoginId && (
              <div className="mt-3 text-center">
                <p>회원님의 아이디는</p>
                <p className="font-bold text-lg mt-1">{foundLoginId}</p>
                <p>입니다.</p>
              </div>
            )}
          </Form>
        </Modal>

        {/* 비밀번호 찾기(재설정) 모달 */}
        <Modal
          title="비밀번호 재설정"
          open={isFindPwModalOpen}
          onCancel={() => {
            setIsFindPwModalOpen(false);
            findPwForm.resetFields();
          }}
          footer={null}
        >
          <Form form={findPwForm} layout="vertical">
            <Form.Item
              label="아이디"
              name="loginId"
              rules={[{ required: true, message: "아이디를 입력해주세요." }]}
            >
              <Input placeholder="로그인 아이디" />
            </Form.Item>

            <Form.Item
              label="이메일"
              name="email"
              rules={[
                { required: true, message: "이메일을 입력해주세요." },
                { type: "email", message: "올바른 이메일 형식이 아닙니다." },
              ]}
            >
              <Input placeholder="가입한 이메일" />
            </Form.Item>

            <Form.Item
              label="이메일 인증번호"
              name="code"
              rules={[{ required: true, message: "인증번호를 입력해주세요." }]}
            >
              <div className="flex gap-2">
                <Input placeholder="인증번호 6자리" />
                <Button
                  type="default"
                  onClick={handleSendPwCode}
                  loading={sendingPwCode}
                >
                  인증번호 보내기
                </Button>
              </div>
            </Form.Item>

            <Form.Item
              label="새 비밀번호"
              name="newPassword"
              rules={[
                { required: true, message: "새 비밀번호를 입력해주세요." },
              ]}
            >
              <Input.Password placeholder="새 비밀번호" />
            </Form.Item>

            <Form.Item
              label="새 비밀번호 확인"
              name="confirmPassword"
              rules={[
                { required: true, message: "비밀번호 확인을 입력해주세요." },
              ]}
            >
              <Input.Password placeholder="새 비밀번호 확인" />
            </Form.Item>

            <Button
              type="primary"
              block
              onClick={handleVerifyPwCode}
              loading={verifyingPwCode}
            >
              비밀번호 변경
            </Button>
          </Form>
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

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white dark:bg-[#1E2028] text-gray-500 dark:text-gray-400">
              Or continue with
            </span>
          </div>
        </div>
        <button
          onClick={() => handleSocialLogin("github")}
          className="w-full btn bg-black text-white border-black"
        >
          <svg
            aria-label="GitHub logo"
            width="16"
            height="16"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
          >
            <path
              fill="white"
              d="M12,2A10,10 0 0,0 2,12C2,16.42 4.87,20.17 8.84,21.5C9.34,21.58 9.5,21.27 9.5,21C9.5,20.77 9.5,20.14 9.5,19.31C6.73,19.91 6.14,17.97 6.14,17.97C5.68,16.81 5.03,16.5 5.03,16.5C4.12,15.88 5.1,15.9 5.1,15.9C6.1,15.97 6.63,16.93 6.63,16.93C7.5,18.45 8.97,18 9.54,17.76C9.63,17.11 9.89,16.67 10.17,16.42C7.95,16.17 5.62,15.31 5.62,11.5C5.62,10.39 6,9.5 6.65,8.79C6.55,8.54 6.2,7.5 6.75,6.15C6.75,6.15 7.59,5.88 9.5,7.17C10.29,6.95 11.15,6.84 12,6.84C12.85,6.84 13.71,6.95 14.5,7.17C16.41,5.88 17.25,6.15 17.25,6.15C17.8,7.5 17.45,8.54 17.35,8.79C18,9.5 18.38,10.39 18.38,11.5C18.38,15.32 16.04,16.16 13.81,16.41C14.17,16.72 14.5,17.33 14.5,18.26C14.5,19.6 14.5,20.68 14.5,21C14.5,21.27 14.66,21.59 15.17,21.5C19.14,20.16 22,16.42 22,12A10,10 0 0,0 12,2Z"
            ></path>
          </svg>
          Login with GitHub
        </button>
        <button
          onClick={() => handleSocialLogin("google")}
          className="w-full btn bg-white text-black border-[#e5e5e5]"
        >
          <svg
            aria-label="Google logo"
            width="16"
            height="16"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 512 512"
          >
            <g>
              <path d="m0 0H512V512H0" fill="#fff"></path>
              <path
                fill="#34a853"
                d="M153 292c30 82 118 95 171 60h62v48A192 192 0 0190 341"
              ></path>
              <path
                fill="#4285f4"
                d="m386 400a140 175 0 0053-179H260v74h102q-7 37-38 57"
              ></path>
              <path
                fill="#fbbc02"
                d="m90 341a208 200 0 010-171l63 49q-12 37 0 73"
              ></path>
              <path
                fill="#ea4335"
                d="m153 219c22-69 116-109 179-50l55-54c-78-75-230-72-297 55"
              ></path>
            </g>
          </svg>
          Login with Google
        </button>

        <div className="text-center text-sm text-gray-600">
          <Link to="/join" className="text-black hover:text-blue-800">
            회원가입
          </Link>
        </div>
      </div>
    </div>
  );
}
export default Login;
