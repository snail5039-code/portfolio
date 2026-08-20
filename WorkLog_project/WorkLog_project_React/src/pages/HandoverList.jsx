// src/pages/HandoverList.jsx
import React, { useEffect, useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Table, Button, message } from 'antd';
import { AuthContext } from "../context/AuthContext";
import { API_BASE } from "../config/api";

const LOGIN_REQUIRED_KEY = "login_required_message";

function HandoverList() {
  const [items, setItems] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);
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

  const columns = [
    {
      title: '번호',
      dataIndex: 'id',
      key: 'id',
      width: 80,
      render: (value, row, index) =>
        (page - 1) * pageSize + index + 1, // 1,2,3... 순번
    },
    {
      title: '제목',
      dataIndex: 'title',
      key: 'title',
      width: 80,
      render: (text) => text || '(제목 없음)',
    },
    {
      title: '인수자',
      dataIndex: 'toName',
      key: 'toName',
      width: 140,
      render: (text) => text || '-',
    },
    {
      title: '인수자 부서/직위',
      dataIndex: 'toJob',
      key: 'toJob',
      width: 210,
      render: (text) => text || '-',
    },
    {
      title: '기간',
      key: 'period',
      width: 220,
      render: (_, record) => {
        const from = record.fromDate || '';
        const to = record.toDate || '';
        if (!from && !to) return '-';
        return `${from || '미지정'} ~ ${to || '미지정'}`;
      },
    },
    {
      title: '작성일',
      dataIndex: 'regDate',
      key: 'regDate',
      width: 180,
      render: (value) => {
        if (!value) return '-';
        // "2025-12-10 01:23:45" → 앞에 날짜만
        return value.length >= 10 ? value.substring(0, 10) : value;
      },
    },
    {
      title: '다운로드',
      key: 'actions',
      width: 140,
      render: (_, record) => (
        <Button size="small" onClick={() => handleDownload(record)}>
          인수인계서 다운로드
        </Button>
      ),
    },
  ];

  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        marginTop: 24,
      }}
    >
      <Card
        title="인수인계 게시판 목록"
        variant="outlined"
        style={{
          width: '100%',
          maxWidth: 900,
        }}
      >
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
      </Card>
    </div>
  );
}

export default HandoverList;
