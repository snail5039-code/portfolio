// src/pages/HandoverList.jsx
import React, { useEffect, useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Button, message } from 'antd';
import { AuthContext } from "../context/AuthContext";
import { API_BASE } from "../config/api";

const LOGIN_REQUIRED_KEY = "login_required_message";
const STATUS_META = {
  DRAFT: { label: "작성 중", className: "bg-[#f2f4f7] text-[#596274]" },
  DELIVERED: { label: "전달", className: "bg-[#fff0e9] text-[#c84f31]" },
  CONFIRMED: { label: "확인", className: "bg-[#edf4ff] text-[#3563a8]" },
  COMPLETED: { label: "완료", className: "bg-[#eef7ef] text-[#3d7650]" },
};

function HandoverList() {
  const [items, setItems] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState("");
  const { isLoginedId, authLoaded } = useContext(AuthContext);
  const navigate = useNavigate();
  
  useEffect(() => {
      if (!authLoaded) return; // 세션 확인 전에는 아무것도 안 함
  
      if (isLoginedId === 0) {
        message.error({
          content: "게시글 보기는 로그인 후 이용 가능합니다.",
          key: LOGIN_REQUIRED_KEY,
          duration: 5,
        });
        navigate("/login");
      }
    }, [authLoaded, isLoginedId, navigate]);
  
  // 🔹 목록 불러오기
  const fetchList = async (pageNo = 1, size = 10) => {
    try {
      setLoading(true);
      const res = await fetch(
        `${API_BASE}/api/handover/list?page=${pageNo}&size=${size}`,
        {
          method: 'GET',
          credentials: 'include', // 세션 유지
        }
      );

      if (!res.ok) {
        throw new Error('서버 에러: ' + res.status);
      }

      const data = await res.json();
      setItems(data.items || []);
      setTotalCount(data.totalCount || 0);
    } catch (err) {
      console.error(err);
      message.error('인수인계 내역을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoaded) return;
    if (isLoginedId === 0) return;
    fetchList(page, pageSize);
  }, [authLoaded, isLoginedId, page, pageSize]);

  // 🔹 개별 행 다운로드 (id로 다운로드)
  const handleDownload = async (record) => {
    try {
      const res = await fetch(
        `${API_BASE}/api/handover/download/${record.id}`,
        {
          method: 'GET',
          credentials: 'include',
        }
      );

      if (!res.ok) {
        throw new Error('다운로드 실패: ' + res.status);
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      // 파일 이름 예: 인수인계서_3_김인수.docx
      const fileName = `인수인계서_${record.id}_${record.toName || '인수자'}.docx`;
      a.download = fileName;

      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      message.error('인수인계서 다운로드 중 오류가 발생했습니다.');
    }
  };

  const changeStatus = async (record, action, successMessage) => {
    const actionKey = `${record.id}-${action}`;
    try {
      setActionLoading(actionKey);
      const res = await fetch(`${API_BASE}/api/handover/${record.id}/${action}`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "상태 변경에 실패했습니다.");
      message.success(successMessage);
      await fetchList(page, pageSize);
    } catch (error) {
      message.error(error.message || "상태 변경에 실패했습니다.");
    } finally {
      setActionLoading("");
    }
  };

  const columns = [
    {
      title: '제목',
      dataIndex: 'title',
      key: 'title',
      width: 210,
      render: (text, record) => (
        <div><p className="font-semibold text-[#26344a]">{text || '(제목 없음)'}</p><p className="mt-1 text-[11px] text-[#8a817b]">작성 {record.regDate?.substring(0, 10) || '-'}</p></div>
      ),
    },
    {
      title: '인수자',
      dataIndex: 'toName',
      key: 'toName',
      width: 150,
      render: (text, record) => (
        <div><p className="font-semibold">{text || '-'}</p><p className="mt-1 text-[11px] text-[#8a817b]">{record.toJob || '부서/직위 미지정'}</p></div>
      ),
    },
    {
      title: '기간',
      key: 'period',
      width: 190,
      render: (_, record) => {
        const from = record.fromDate || '';
        const to = record.toDate || '';
        if (!from && !to) return '-';
        return `${from || '미지정'} ~ ${to || '미지정'}`;
      },
    },
    {
      title: '진행 상태',
      key: 'status',
      width: 170,
      render: (_, record) => {
        const meta = STATUS_META[record.status] || STATUS_META.DRAFT;
        const history = record.completedAt || record.confirmedAt || record.deliveredAt;
        return (
          <div>
            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${meta.className}`}>{meta.label}</span>
            {history && <p className="mt-1 text-[11px] text-[#8a817b]">{history.substring(0, 16)}</p>}
            {record.confirmedAt && <p className="text-[11px] text-[#697386]">확인: {record.confirmerName || record.toName}</p>}
          </div>
        );
      },
    },
    {
      title: '다운로드',
      key: 'actions',
      width: 175,
      render: (_, record) => (
        <div className="flex flex-wrap gap-2">
          <Button size="small" onClick={() => handleDownload(record)}>다운로드</Button>
          {record.canDeliver && (
            <Button size="small" type="primary" loading={actionLoading === `${record.id}-deliver`} onClick={() => changeStatus(record, 'deliver', '인수자에게 전달 상태로 변경했습니다.')}>전달하기</Button>
          )}
          {record.canConfirm && (
            <Button size="small" type="primary" loading={actionLoading === `${record.id}-confirm`} onClick={() => changeStatus(record, 'confirm', '인수인계를 확인했습니다.')}>확인하기</Button>
          )}
          {record.canComplete && (
            <Button size="small" type="primary" loading={actionLoading === `${record.id}-complete`} onClick={() => changeStatus(record, 'complete', '인수인계를 완료 처리했습니다.')}>완료하기</Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-7xl rounded-[24px] border border-[#eadfd7] bg-white p-6 shadow-[0_14px_45px_rgba(70,49,35,0.06)] md:p-8">
      <p className="text-xs font-bold tracking-[0.18em] text-[#d95d3b]">HANDOVER FLOW</p>
      <div className="mb-6 mt-2 flex flex-col justify-between gap-3 border-b border-[#eee5de] pb-5 sm:flex-row sm:items-end">
        <div><h1 className="font-serif text-3xl font-bold text-[#1f2e45]">인수인계 진행 현황</h1><p className="mt-2 text-sm text-[#747b87]">문서를 전달하고 인수자의 확인을 거쳐 업무 승계를 완료하세요.</p></div>
        <Button type="primary" onClick={() => navigate('/handoverWrite')}>새 인수인계</Button>
      </div>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={items}
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total: totalCount,
            showSizeChanger: true,
            onChange: (p, s) => {
              setPage(p);
              setPageSize(s);
            },
          }}
        />
    </div>
  );
}

export default HandoverList;
